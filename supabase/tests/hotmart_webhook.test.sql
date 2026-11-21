begin;

do $s18_hotmart_structure$
declare
  v_definer boolean;
  v_config text[];
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'hotmart_credentials' and c.relrowsecurity
  ) then
    raise exception 'hotmart_credentials must keep RLS enabled';
  end if;

  -- 1. hotmart_lookup_connection_by_token_hash
  select p.prosecdef, p.proconfig
    into v_definer, v_config
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'hotmart_lookup_connection_by_token_hash';

  if v_definer is distinct from true
     or not ('search_path=""' = any(coalesce(v_config, array[]::text[]))) then
    raise exception 'lookup RPC must be SECURITY DEFINER with empty search_path';
  end if;

  if has_function_privilege('anon', 'public.hotmart_lookup_connection_by_token_hash(text)', 'execute')
     or has_function_privilege('authenticated', 'public.hotmart_lookup_connection_by_token_hash(text)', 'execute')
     or not has_function_privilege('service_role', 'public.hotmart_lookup_connection_by_token_hash(text)', 'execute') then
    raise exception 'lookup RPC privilege boundary is incorrect';
  end if;

  -- 2. hotmart_persist_webhook_event
  select p.prosecdef, p.proconfig
    into v_definer, v_config
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'hotmart_persist_webhook_event';

  if v_definer is distinct from true
     or not ('search_path=""' = any(coalesce(v_config, array[]::text[]))) then
    raise exception 'persist webhook RPC must be SECURITY DEFINER with empty search_path';
  end if;

  if has_function_privilege('anon', 'public.hotmart_persist_webhook_event(uuid,uuid,jsonb,timestamp with time zone)', 'execute')
     or has_function_privilege('authenticated', 'public.hotmart_persist_webhook_event(uuid,uuid,jsonb,timestamp with time zone)', 'execute')
     or not has_function_privilege('service_role', 'public.hotmart_persist_webhook_event(uuid,uuid,jsonb,timestamp with time zone)', 'execute') then
    raise exception 'persist webhook RPC privilege boundary is incorrect';
  end if;
end;
$s18_hotmart_structure$;

do $s18_hotmart_behavior$
declare
  v_user uuid := 'f1800000-0000-4000-8000-000000000001';
  v_org uuid := 'f1800000-0000-4000-8000-000000000002';
  v_other_org uuid := 'f1800000-0000-4000-8000-000000000003';
  v_conn_producer uuid := 'f1800000-0000-4000-8000-000000000004';
  v_conn_affiliate uuid := 'f1800000-0000-4000-8000-000000000005';
  v_event_result jsonb;
  v_count integer;
  v_ledger_count integer;
  v_gross numeric;
  v_rejected boolean;
  v_hottok_hash text := encode(sha256('secret_test_token_123'::bytea), 'hex');
begin
  -- Setup de usuários e workspaces
  insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values (v_user, 'authenticated', 'authenticated', 's18-hotmart@example.invalid', '', now(), now(), now());

  insert into public.organizations (id, name, slug, created_by)
  values
    (v_org, 'S18 Hotmart Org', 's18-hotmart-org', v_user),
    (v_other_org, 'S18 Other Org', 's18-other-org', v_user);

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org, v_user, 'owner'), (v_other_org, v_user, 'owner');

  -- Conexão Produtor (owned_sales)
  insert into public.source_connections (
    id, organization_id, domain, provider, external_account_id, status
  ) values (
    v_conn_producer, v_org, 'owned_sales', 'hotmart', 'producer-123', 'connected'
  );

  -- Conexão Afiliado (affiliate)
  insert into public.source_connections (
    id, organization_id, domain, provider, external_account_id, status
  ) values (
    v_conn_affiliate, v_org, 'affiliate', 'hotmart', 'affiliate-456', 'connected'
  );

  -- Configuração de credenciais
  perform public.hotmart_set_connection_credentials(
    v_conn_producer, v_org, 'owned_sales', v_hottok_hash, '{"v":1}'::jsonb
  );

  -- 1. Teste de lookup por hash de token
  select count(*) into v_count
  from public.hotmart_lookup_connection_by_token_hash(v_hottok_hash)
  where connection_id = v_conn_producer and organization_id = v_org;

  if v_count <> 1 then
    raise exception 'token hash lookup must find connection';
  end if;

  -- 2. Teste de rejeição estrita de PII (email, buyer, etc.)
  v_rejected := false;
  begin
    perform public.hotmart_persist_webhook_event(
      v_conn_producer, v_org,
      jsonb_build_object(
        'external_id', 'HP999001',
        'event_type', 'PURCHASE_APPROVED',
        'domain', 'owned_sales',
        'currency', 'BRL',
        'gross_amount', 197.00,
        'commission_amount', 0,
        'fee_amount', 19.70,
        'refund_amount', 0,
        'occurred_at', '2026-11-21T12:00:00Z',
        'payload_hash', repeat('b', 64),
        'normalization_version', 1,
        'order_status', 'paid',
        'buyer', jsonb_build_object('name', 'João Silva', 'email', 'joao@example.com')
      ),
      now()
    );
  exception when others then
    if sqlerrm like '%Dados pessoais não podem ser armazenados%' or sqlstate = '22023' then
      v_rejected := true;
    end if;
  end;

  if not v_rejected then
    raise exception 'RPC must strictly reject payloads containing PII attributes';
  end if;

  -- 3. Fluxo de Venda Própria (owned_sales) - PURCHASE_APPROVED
  select public.hotmart_persist_webhook_event(
    v_conn_producer, v_org,
    jsonb_build_object(
      'external_id', 'HP00000001',
      'event_type', 'PURCHASE_APPROVED',
      'domain', 'owned_sales',
      'currency', 'BRL',
      'gross_amount', 297.00,
      'commission_amount', 0,
      'fee_amount', 29.70,
      'refund_amount', 0,
      'occurred_at', '2026-11-21T12:00:00Z',
      'payload_hash', repeat('c', 64),
      'normalization_version', 1,
      'order_status', 'paid'
    ),
    now()
  ) into v_event_result;

  if (v_event_result->>'ok')::boolean is not true then
    raise exception 'owned_sales event must persist successfully';
  end if;

  -- Verifica persistência em sales_orders
  select count(*), max(gross_amount) into v_count, v_gross
  from public.sales_orders
  where organization_id = v_org and provider = 'hotmart' and external_order_id = 'HP00000001';

  if v_count <> 1 or v_gross <> 297.00 then
    raise exception 'sales_order must be created with correct gross amount';
  end if;

  -- Verifica ledger entries gerados para owned_sales
  select count(*) into v_ledger_count
  from public.financial_ledger_entries
  where organization_id = v_org and source_table = 'sales_orders'
    and entry_type in ('sales_gross', 'sales_fee');

  if v_ledger_count <> 2 then
    raise exception 'financial ledger must record sales_gross and sales_fee';
  end if;

  -- Replay idêntico não pode duplicar eventos nem ledger
  perform public.hotmart_persist_webhook_event(
    v_conn_producer, v_org,
    jsonb_build_object(
      'external_id', 'HP00000001',
      'event_type', 'PURCHASE_APPROVED',
      'domain', 'owned_sales',
      'currency', 'BRL',
      'gross_amount', 297.00,
      'commission_amount', 0,
      'fee_amount', 29.70,
      'refund_amount', 0,
      'occurred_at', '2026-11-21T12:00:00Z',
      'payload_hash', repeat('c', 64),
      'normalization_version', 1,
      'order_status', 'paid'
    ),
    now()
  );

  select count(*) into v_ledger_count
  from public.financial_ledger_entries
  where organization_id = v_org and source_table = 'sales_orders'
    and entry_type in ('sales_gross', 'sales_fee');

  if v_ledger_count <> 2 then
    raise exception 'replay must be idempotent on financial ledger';
  end if;

  -- 4. Fluxo de Afiliado (affiliate) - PURCHASE_APPROVED
  select public.hotmart_persist_webhook_event(
    v_conn_affiliate, v_org,
    jsonb_build_object(
      'external_id', 'HP00000002',
      'event_type', 'PURCHASE_APPROVED',
      'domain', 'affiliate',
      'currency', 'BRL',
      'gross_amount', 500.00,
      'commission_amount', 150.00,
      'fee_amount', 0,
      'refund_amount', 0,
      'occurred_at', '2026-11-21T13:00:00Z',
      'payload_hash', repeat('d', 64),
      'normalization_version', 1,
      'commission_status', 'approved'
    ),
    now()
  ) into v_event_result;

  -- Verifica affiliate_conversions
  select count(*) into v_count
  from public.affiliate_conversions
  where organization_id = v_org and provider = 'hotmart' and external_conversion_id = 'HP00000002'
    and status = 'approved';

  if v_count <> 1 then
    raise exception 'affiliate conversion must be created with status approved';
  end if;

  -- Trigger S8 deve ter registrado ledger entry affiliate_commission_approved automaticamente
  select count(*) into v_ledger_count
  from public.financial_ledger_entries
  where organization_id = v_org and source_table = 'affiliate_conversions'
    and entry_type = 'affiliate_commission_approved';

  if v_ledger_count <> 1 then
    raise exception 'affiliate commission approved ledger entry must be created';
  end if;

  -- Transição S8: PURCHASE_COMPLETE -> settled
  perform public.hotmart_persist_webhook_event(
    v_conn_affiliate, v_org,
    jsonb_build_object(
      'external_id', 'HP00000002',
      'event_type', 'PURCHASE_COMPLETE',
      'domain', 'affiliate',
      'currency', 'BRL',
      'gross_amount', 500.00,
      'commission_amount', 150.00,
      'fee_amount', 0,
      'refund_amount', 0,
      'occurred_at', '2026-11-21T13:00:00Z',
      'payload_hash', repeat('e', 64),
      'normalization_version', 1,
      'commission_status', 'settled'
    ),
    now()
  );

  select count(*) into v_ledger_count
  from public.financial_ledger_entries
  where organization_id = v_org and source_table = 'affiliate_conversions'
    and entry_type = 'affiliate_commission_settled';

  if v_ledger_count <> 1 then
    raise exception 'affiliate commission settled ledger entry must be created';
  end if;

  -- Transição S8: PURCHASE_REFUNDED -> reversed
  perform public.hotmart_persist_webhook_event(
    v_conn_affiliate, v_org,
    jsonb_build_object(
      'external_id', 'HP00000002',
      'event_type', 'PURCHASE_REFUNDED',
      'domain', 'affiliate',
      'currency', 'BRL',
      'gross_amount', 500.00,
      'commission_amount', 150.00,
      'fee_amount', 0,
      'refund_amount', 500.00,
      'occurred_at', '2026-11-21T13:00:00Z',
      'payload_hash', repeat('f', 64),
      'normalization_version', 1,
      'commission_status', 'reversed'
    ),
    now()
  );

  select count(*) into v_ledger_count
  from public.financial_ledger_entries
  where organization_id = v_org and source_table = 'affiliate_conversions'
    and entry_type = 'affiliate_commission_reversed';

  if v_ledger_count <> 1 then
    raise exception 'affiliate commission reversed ledger entry must be created';
  end if;

  -- 5. Isolamento entre tenants: tentar gravar na conexão de outra org falha
  v_rejected := false;
  begin
    perform public.hotmart_persist_webhook_event(
      v_conn_producer, v_other_org,
      jsonb_build_object(
        'external_id', 'HP999999',
        'event_type', 'PURCHASE_APPROVED',
        'domain', 'owned_sales',
        'currency', 'BRL',
        'gross_amount', 100.00,
        'commission_amount', 0,
        'fee_amount', 10.00,
        'refund_amount', 0,
        'occurred_at', '2026-11-21T14:00:00Z',
        'payload_hash', repeat('0', 64),
        'normalization_version', 1,
        'order_status', 'paid'
      ),
      now()
    );
  exception when others then
    v_rejected := true;
  end;

  if not v_rejected then
    raise exception 'cross-tenant execution must be rejected';
  end if;
end;
$s18_hotmart_behavior$;

rollback;
