begin;

do $s11_order_sync_structure$
declare
  v_definer boolean;
  v_config text[];
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'sales_orders' and c.relrowsecurity
  ) then
    raise exception 'sales_orders must keep RLS enabled';
  end if;

  select p.prosecdef, p.proconfig
    into v_definer, v_config
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'mercado_livre_persist_order_snapshots';

  if v_definer is distinct from true
     or not ('search_path=""' = any(coalesce(v_config, array[]::text[]))) then
    raise exception 'order sync RPC must be SECURITY DEFINER with empty search_path';
  end if;

  if has_function_privilege('anon', 'public.mercado_livre_persist_order_snapshots(uuid,uuid,jsonb,timestamp with time zone)', 'execute')
     or has_function_privilege('authenticated', 'public.mercado_livre_persist_order_snapshots(uuid,uuid,jsonb,timestamp with time zone)', 'execute')
     or not has_function_privilege('service_role', 'public.mercado_livre_persist_order_snapshots(uuid,uuid,jsonb,timestamp with time zone)', 'execute') then
    raise exception 'order sync RPC privilege boundary is incorrect';
  end if;
end;
$s11_order_sync_structure$;

do $s11_order_sync_behavior$
declare
  v_user uuid := 'f1100000-0000-4000-8000-000000000001';
  v_org uuid := 'f2200000-0000-4000-8000-000000000001';
  v_other_org uuid := 'f2200000-0000-4000-8000-000000000002';
  v_connection uuid := 'f3300000-0000-4000-8000-000000000001';
  v_orders jsonb;
  v_updated jsonb;
  v_processed integer;
  v_order_count integer;
  v_event_count integer;
  v_ledger_count integer;
  v_status text;
  v_gross numeric;
  v_refund numeric;
  v_settled_at timestamptz;
  v_rejected boolean;
begin
  insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values (v_user, 'authenticated', 'authenticated', 's11-order-sync@example.invalid', '', now(), now(), now());

  insert into public.organizations (id, name, slug, created_by)
  values
    (v_org, 'S11 Order Sync', 's11-order-sync', v_user),
    (v_other_org, 'S11 Other Tenant', 's11-other-tenant', v_user);

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org, v_user, 'owner'), (v_other_org, v_user, 'owner');

  insert into public.source_connections (
    id, organization_id, domain, provider, external_account_id, status
  ) values (
    v_connection, v_org, 'owned_sales', 'mercado_livre', 'ml-seller-123', 'connected'
  );

  v_orders := jsonb_build_array(jsonb_build_object(
    'external_order_id', '900001',
    'order_status', 'paid',
    'currency', 'BRL',
    'gross_amount', 149.90,
    'discount_amount', 0,
    'fee_amount', 12.50,
    'shipping_amount', 0,
    'refund_amount', 0,
    'occurred_at', '2026-11-21T01:00:00Z',
    'payload_hash', repeat('a', 64),
    'normalization_version', 1
  ));

  select public.mercado_livre_persist_order_snapshots(v_connection, v_org, v_orders, now())
    into v_processed;
  if v_processed <> 1 then raise exception 'first snapshot must process one order'; end if;

  -- Replaying the same snapshot must upsert, not duplicate event or order rows.
  select public.mercado_livre_persist_order_snapshots(v_connection, v_org, v_orders, now())
    into v_processed;
  select count(*) into v_order_count from public.sales_orders
    where organization_id = v_org and provider = 'mercado_livre' and external_order_id = '900001';
  select count(*) into v_event_count from public.external_events
    where organization_id = v_org and provider = 'mercado_livre' and external_id = '900001' and event_type = 'order_snapshot';
  if v_processed <> 1 or v_order_count <> 1 or v_event_count <> 1 then
    raise exception 'replay must remain idempotent';
  end if;

  -- A newer normalized snapshot updates the same rows and never infers settlement.
  v_updated := jsonb_build_array(jsonb_build_object(
    'external_order_id', '900001',
    'order_status', 'partially_refunded',
    'currency', 'BRL',
    'gross_amount', 149.90,
    'discount_amount', 0,
    'fee_amount', 12.50,
    'shipping_amount', 0,
    'refund_amount', 20.00,
    'occurred_at', '2026-11-21T01:00:00Z',
    'payload_hash', repeat('b', 64),
    'normalization_version', 1
  ));
  select public.mercado_livre_persist_order_snapshots(v_connection, v_org, v_updated, now())
    into v_processed;

  select order_status, gross_amount, refund_amount, settled_at
    into v_status, v_gross, v_refund, v_settled_at
  from public.sales_orders
  where organization_id = v_org and provider = 'mercado_livre' and external_order_id = '900001';
  if v_status <> 'partially_refunded' or v_gross <> 149.90 or v_refund <> 20.00 or v_settled_at is not null then
    raise exception 'snapshot update must preserve unsettled semantics';
  end if;

  select count(*) into v_ledger_count from public.financial_ledger_entries
  where organization_id = v_org and source_table = 'sales_orders';
  if v_ledger_count <> 0 then raise exception 'snapshot import must not create ledger entries'; end if;

  -- Tenant mismatch, invalid amount and non-allowlisted PII must reject the whole call.
  v_rejected := false;
  begin
    perform public.mercado_livre_persist_order_snapshots(v_connection, v_other_org, v_orders, now());
  exception when others then v_rejected := true;
  end;
  if not v_rejected then raise exception 'cross-tenant connection must be rejected'; end if;

  v_rejected := false;
  begin
    perform public.mercado_livre_persist_order_snapshots(
      v_connection, v_org,
      jsonb_build_array((v_orders->0) || jsonb_build_object('gross_amount', -1)),
      now()
    );
  exception when others then v_rejected := true;
  end;
  if not v_rejected then raise exception 'negative amount must be rejected'; end if;

  v_rejected := false;
  begin
    perform public.mercado_livre_persist_order_snapshots(
      v_connection, v_org,
      jsonb_build_array((v_orders->0) || jsonb_build_object('buyer_email', 'pii@example.invalid')),
      now()
    );
  exception when others then v_rejected := true;
  end;
  if not v_rejected then raise exception 'PII/unknown fields must be rejected'; end if;

  if not exists (
    select 1 from public.source_connections
    where id = v_connection and last_synced_at is not null
  ) then
    raise exception 'successful sync must update the connection checkpoint timestamp';
  end if;
end;
$s11_order_sync_behavior$;

rollback;
