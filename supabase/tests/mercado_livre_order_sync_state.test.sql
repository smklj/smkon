begin;

do $s11_order_sync_state_structure$
declare
  v_definer boolean;
  v_config text[];
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'mercado_livre_order_sync_state'
      and c.relrowsecurity
  ) then
    raise exception 'order sync state must keep RLS enabled';
  end if;

  if has_table_privilege('anon', 'public.mercado_livre_order_sync_state', 'select')
     or has_table_privilege('authenticated', 'public.mercado_livre_order_sync_state', 'select')
     or not has_table_privilege('service_role', 'public.mercado_livre_order_sync_state', 'select') then
    raise exception 'order sync state table privilege boundary is incorrect';
  end if;

  if has_table_privilege('anon', 'public.mercado_livre_order_sync_state', 'insert')
     or has_table_privilege('authenticated', 'public.mercado_livre_order_sync_state', 'update')
     or not has_table_privilege('service_role', 'public.mercado_livre_order_sync_state', 'update') then
    raise exception 'order sync state write privilege boundary is incorrect';
  end if;

  if has_function_privilege('anon', 'public.mercado_livre_claim_order_sync(uuid,uuid,text,timestamp with time zone,integer)', 'execute')
     or has_function_privilege('authenticated', 'public.mercado_livre_claim_order_sync(uuid,uuid,text,timestamp with time zone,integer)', 'execute')
     or not has_function_privilege('service_role', 'public.mercado_livre_claim_order_sync(uuid,uuid,text,timestamp with time zone,integer)', 'execute') then
    raise exception 'claim RPC privilege boundary is incorrect';
  end if;

  if has_function_privilege('anon', 'public.mercado_livre_persist_order_sync_page(uuid,uuid,uuid,integer,jsonb,integer,boolean,timestamp with time zone)', 'execute')
     or has_function_privilege('authenticated', 'public.mercado_livre_persist_order_sync_page(uuid,uuid,uuid,integer,jsonb,integer,boolean,timestamp with time zone)', 'execute')
     or not has_function_privilege('service_role', 'public.mercado_livre_persist_order_sync_page(uuid,uuid,uuid,integer,jsonb,integer,boolean,timestamp with time zone)', 'execute') then
    raise exception 'page persistence RPC privilege boundary is incorrect';
  end if;

  if has_function_privilege('anon', 'public.mercado_livre_release_order_sync(uuid,uuid,uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'public.mercado_livre_release_order_sync(uuid,uuid,uuid,text)', 'execute')
     or not has_function_privilege('service_role', 'public.mercado_livre_release_order_sync(uuid,uuid,uuid,text)', 'execute') then
    raise exception 'release RPC privilege boundary is incorrect';
  end if;

  for v_definer, v_config in
    select p.prosecdef, p.proconfig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'mercado_livre_claim_order_sync',
        'mercado_livre_persist_order_sync_page',
        'mercado_livre_release_order_sync'
      )
  loop
    if v_definer is distinct from true
       or not ('search_path=""' = any(coalesce(v_config, array[]::text[]))) then
      raise exception 'order sync state RPC must be SECURITY DEFINER with empty search_path';
    end if;
  end loop;
end;
$s11_order_sync_state_structure$;

do $s11_order_sync_state_behavior$
declare
  v_user uuid := 'f1100000-0000-4000-8000-000000000011';
  v_org uuid := 'f2200000-0000-4000-8000-000000000011';
  v_other_org uuid := 'f2200000-0000-4000-8000-000000000012';
  v_connection uuid := 'f3300000-0000-4000-8000-000000000011';
  v_claim record;
  v_second_claim record;
  v_restart_claim record;
  v_orders jsonb;
  v_final_page jsonb;
  v_processed integer;
  v_order_count integer;
  v_event_count integer;
  v_ledger_count integer;
  v_unsettled_count integer;
  v_status text;
  v_next_offset integer;
  v_error_code text;
  v_lease_id uuid;
  v_rejected boolean := false;
begin
  insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values (v_user, 'authenticated', 'authenticated', 's11-order-sync-state@example.invalid', '', now(), now(), now());

  insert into public.organizations (id, name, slug, created_by)
  values
    (v_org, 'S11 Order Sync State', 's11-order-sync-state', v_user),
    (v_other_org, 'S11 Order Sync Other', 's11-order-sync-other', v_user);

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org, v_user, 'owner'), (v_other_org, v_user, 'owner');

  insert into public.source_connections (
    id, organization_id, domain, provider, external_account_id, status
  ) values (
    v_connection, v_org, 'owned_sales', 'mercado_livre', 'ml-seller-state-123', 'connected'
  );

  select * into v_claim
  from public.mercado_livre_claim_order_sync(v_connection, v_org, 'next', now(), 300);

  if v_claim.sync_status <> 'running'
     or v_claim.next_offset <> 0
     or v_claim.lease_id is null
     or v_claim.page_size <> 50 then
    raise exception 'first claim must create and lease the initial durable cursor';
  end if;

  select * into v_second_claim
  from public.mercado_livre_claim_order_sync(v_connection, v_org, 'next', now(), 300);
  if v_second_claim.sync_status <> 'busy' or v_second_claim.lease_id is not null then
    raise exception 'parallel order sync claim must be blocked';
  end if;

  select jsonb_agg(jsonb_build_object(
    'external_order_id', (910000 + g.i)::text,
    'order_status', 'paid',
    'currency', 'BRL',
    'gross_amount', 10.00,
    'discount_amount', 0,
    'fee_amount', 1.00,
    'shipping_amount', 0,
    'refund_amount', 0,
    'occurred_at', now(),
    'payload_hash', repeat('a', 64),
    'normalization_version', 1
  ) order by g.i)
  into v_orders
  from generate_series(1, 50) as g(i);

  v_processed := public.mercado_livre_persist_order_sync_page(
    v_connection, v_org, v_claim.lease_id, 0, v_orders, 51, true, now()
  );
  if v_processed <> 50 then
    raise exception 'first page must persist all 50 normalized snapshots';
  end if;

  select s.status, s.next_offset into v_status, v_next_offset
  from public.mercado_livre_order_sync_state s
  where s.connection_id = v_connection and s.organization_id = v_org;
  if v_status <> 'ready' or v_next_offset <> 50 then
    raise exception 'checkpoint must advance only after the first page is persisted';
  end if;

  v_rejected := false;
  begin
    perform public.mercado_livre_persist_order_sync_page(
      v_connection, v_org, v_claim.lease_id, 0, v_orders, 51, true, now()
    );
  exception when sqlstate '40001' then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'replay with a consumed lease/old offset must be rejected';
  end if;

  select * into v_second_claim
  from public.mercado_livre_claim_order_sync(v_connection, v_org, 'next', now(), 300);
  if v_second_claim.sync_status <> 'running'
     or v_second_claim.next_offset <> 50
     or v_second_claim.lease_id is null then
    raise exception 'next claim must resume from the durable offset';
  end if;

  v_final_page := jsonb_build_array(jsonb_build_object(
    'external_order_id', '910051',
    'order_status', 'fulfilled',
    'currency', 'BRL',
    'gross_amount', 20.00,
    'discount_amount', 0,
    'fee_amount', 2.00,
    'shipping_amount', 0,
    'refund_amount', 0,
    'occurred_at', now(),
    'payload_hash', repeat('b', 64),
    'normalization_version', 1
  ));

  v_processed := public.mercado_livre_persist_order_sync_page(
    v_connection, v_org, v_second_claim.lease_id, 50, v_final_page, 51, false, now()
  );
  if v_processed <> 1 then
    raise exception 'final page must persist one normalized snapshot';
  end if;

  select s.status, s.next_offset into v_status, v_next_offset
  from public.mercado_livre_order_sync_state s
  where s.connection_id = v_connection and s.organization_id = v_org;
  if v_status <> 'completed' or v_next_offset <> 51 then
    raise exception 'final page must mark the durable cursor completed';
  end if;

  select count(*) into v_order_count
  from public.sales_orders
  where organization_id = v_org and provider = 'mercado_livre';
  select count(*) into v_event_count
  from public.external_events
  where organization_id = v_org and provider = 'mercado_livre';
  select count(*) into v_ledger_count
  from public.financial_ledger_entries
  where organization_id = v_org and source_table = 'sales_orders';
  select count(*) into v_unsettled_count
  from public.sales_orders
  where organization_id = v_org and provider = 'mercado_livre' and settled_at is null;

  if v_order_count <> 51 or v_event_count <> 51 or v_ledger_count <> 0 or v_unsettled_count <> 51 then
    raise exception 'durable cursor must preserve idempotent snapshots without ledger or inferred settlement';
  end if;

  select * into v_restart_claim
  from public.mercado_livre_claim_order_sync(v_connection, v_org, 'restart', now(), 300);
  if v_restart_claim.sync_status <> 'running'
     or v_restart_claim.next_offset <> 0
     or v_restart_claim.lease_id is null then
    raise exception 'explicit restart must reset the window and offset';
  end if;

  if not public.mercado_livre_release_order_sync(v_connection, v_org, v_restart_claim.lease_id, 'test_failure') then
    raise exception 'release must clear the active lease';
  end if;

  select s.status, s.lease_id, s.last_error_code, s.next_offset
    into v_status, v_lease_id, v_error_code, v_next_offset
  from public.mercado_livre_order_sync_state s
  where s.connection_id = v_connection and s.organization_id = v_org;
  if v_status <> 'ready' or v_lease_id is not null or v_error_code <> 'test_failure' or v_next_offset <> 0 then
    raise exception 'release must clear the lease without advancing the durable checkpoint';
  end if;

  v_rejected := false;
  begin
    perform public.mercado_livre_claim_order_sync(v_connection, v_other_org, 'next', now(), 300);
  exception when sqlstate '42501' then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'a different tenant must not claim another organization connection';
  end if;
end;
$s11_order_sync_state_behavior$;

rollback;
