begin;

do $s11_order_versioning_structure$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'external_events'
      and column_name = 'source_updated_at'
      and data_type = 'timestamp with time zone'
  ) then
    raise exception 'external_events.source_updated_at must exist as timestamptz';
  end if;

  if has_function_privilege('anon', 'public.mercado_livre_persist_order_snapshots(uuid,uuid,jsonb,timestamp with time zone)', 'execute')
     or has_function_privilege('authenticated', 'public.mercado_livre_persist_order_snapshots(uuid,uuid,jsonb,timestamp with time zone)', 'execute')
     or not has_function_privilege('service_role', 'public.mercado_livre_persist_order_snapshots(uuid,uuid,jsonb,timestamp with time zone)', 'execute') then
    raise exception 'versioned snapshot RPC privilege boundary is incorrect';
  end if;
end;
$s11_order_versioning_structure$;

do $s11_order_versioning_behavior$
declare
  v_user uuid := 'f1100000-0000-4000-8000-000000000021';
  v_org uuid := 'f2200000-0000-4000-8000-000000000021';
  v_connection uuid := 'f3300000-0000-4000-8000-000000000021';
  v_orders jsonb;
  v_processed integer;
  v_status text;
  v_gross numeric(18,4);
  v_source_updated_at timestamptz;
  v_payload_hash text;
begin
  insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values (v_user, 'authenticated', 'authenticated', 's11-order-versioning@example.invalid', '', now(), now(), now());

  insert into public.organizations (id, name, slug, created_by)
  values (v_org, 'S11 Order Versioning', 's11-order-versioning', v_user);

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org, v_user, 'owner');

  insert into public.source_connections (
    id, organization_id, domain, provider, external_account_id, status
  ) values (
    v_connection, v_org, 'owned_sales', 'mercado_livre', 'ml-seller-version-123', 'connected'
  );

  v_orders := jsonb_build_array(jsonb_build_object(
    'external_order_id', '920001',
    'order_status', 'paid',
    'currency', 'BRL',
    'gross_amount', 100.00,
    'discount_amount', 0,
    'fee_amount', 5.00,
    'shipping_amount', 0,
    'refund_amount', 0,
    'occurred_at', '2026-11-20T00:00:00Z',
    'source_updated_at', '2026-11-21T00:00:00Z',
    'payload_hash', repeat('a', 64),
    'normalization_version', 2
  ));

  v_processed := public.mercado_livre_persist_order_snapshots(v_connection, v_org, v_orders, now());
  if v_processed <> 1 then
    raise exception 'initial provider snapshot must be inserted';
  end if;

  v_orders := jsonb_build_array(jsonb_build_object(
    'external_order_id', '920001',
    'order_status', 'cancelled',
    'currency', 'BRL',
    'gross_amount', 10.00,
    'discount_amount', 0,
    'fee_amount', 0,
    'shipping_amount', 0,
    'refund_amount', 0,
    'occurred_at', '2026-11-20T00:00:00Z',
    'source_updated_at', '2026-11-20T12:00:00Z',
    'payload_hash', repeat('b', 64),
    'normalization_version', 2
  ));

  v_processed := public.mercado_livre_persist_order_snapshots(v_connection, v_org, v_orders, now());
  if v_processed <> 0 then
    raise exception 'stale provider snapshot must be ignored';
  end if;

  select so.order_status, so.gross_amount
    into v_status, v_gross
  from public.sales_orders so
  where so.organization_id = v_org
    and so.provider = 'mercado_livre'
    and so.external_order_id = '920001';

  select ee.source_updated_at, ee.payload_hash
    into v_source_updated_at, v_payload_hash
  from public.external_events ee
  where ee.organization_id = v_org
    and ee.provider = 'mercado_livre'
    and ee.external_id = '920001'
    and ee.event_type = 'order_snapshot';

  if v_status <> 'paid' or v_gross <> 100.00
     or v_source_updated_at <> '2026-11-21T00:00:00Z'::timestamptz
     or v_payload_hash <> repeat('a', 64) then
    raise exception 'stale snapshot regressed the order or event watermark';
  end if;

  v_orders := jsonb_build_array(jsonb_build_object(
    'external_order_id', '920001',
    'order_status', 'fulfilled',
    'currency', 'BRL',
    'gross_amount', 120.00,
    'discount_amount', 0,
    'fee_amount', 6.00,
    'shipping_amount', 0,
    'refund_amount', 0,
    'occurred_at', '2026-11-20T00:00:00Z',
    'source_updated_at', '2026-11-22T00:00:00Z',
    'payload_hash', repeat('c', 64),
    'normalization_version', 2
  ));

  v_processed := public.mercado_livre_persist_order_snapshots(v_connection, v_org, v_orders, now());
  if v_processed <> 1 then
    raise exception 'newer provider snapshot must update the order';
  end if;

  select so.order_status, so.gross_amount
    into v_status, v_gross
  from public.sales_orders so
  where so.organization_id = v_org
    and so.provider = 'mercado_livre'
    and so.external_order_id = '920001';

  select ee.source_updated_at
    into v_source_updated_at
  from public.external_events ee
  where ee.organization_id = v_org
    and ee.provider = 'mercado_livre'
    and ee.external_id = '920001'
    and ee.event_type = 'order_snapshot';

  if v_status <> 'fulfilled' or v_gross <> 120.00
     or v_source_updated_at <> '2026-11-22T00:00:00Z'::timestamptz then
    raise exception 'newer provider snapshot was not applied';
  end if;
end;
$s11_order_versioning_behavior$;

rollback;
