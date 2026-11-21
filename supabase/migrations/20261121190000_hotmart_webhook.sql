-- S18: Hotmart Webhook & Financial Normalization (Frente C)
--
-- 1. hotmart_credentials:
--    Server-side storage of encrypted webhook secret / Hottok hash.
--    No raw secrets exposed to client. RLS revoked from anon and authenticated; service_role only.
-- 2. hotmart_lookup_connection_by_token_hash:
--    Fast lookup for incoming webhooks authenticated via Hottok.
-- 3. hotmart_persist_webhook_event:
--    Atomic RPC for processing normalized, strictly PII-free Hotmart webhook events:
--    - Records external_events (idempotent on conflict)
--    - For 'owned_sales': records sales_orders and generates financial_ledger_entries (sales_gross, sales_fee, sales_refund)
--    - For 'affiliate': records affiliate_conversions (triggers automatic status history & ledger entries via S8 lifecycle)
--    - Updates source_connections.last_synced_at and status = 'connected'

-- ---------------------------------------------------------------------------
-- 1. Tabela de credenciais / segredos do webhook Hotmart
-- ---------------------------------------------------------------------------
create table public.hotmart_credentials (
  connection_id uuid primary key,
  organization_id uuid not null,
  domain public.smkon_revenue_domain not null check (domain in ('owned_sales', 'affiliate')),
  hottok_hash text not null check (hottok_hash ~ '^[a-f0-9]{64}$'),
  encrypted_hottok jsonb not null check (jsonb_typeof(encrypted_hottok) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (connection_id, organization_id, domain)
    references public.source_connections(id, organization_id, domain) on delete cascade
);

create index hotmart_credentials_lookup_idx
  on public.hotmart_credentials (hottok_hash, organization_id);

alter table public.hotmart_credentials enable row level security;
revoke all on public.hotmart_credentials from public, anon, authenticated;
grant select, insert, update, delete on public.hotmart_credentials to service_role;

-- ---------------------------------------------------------------------------
-- 2. Lookup de conexão por hash de token (Hottok)
-- ---------------------------------------------------------------------------
create or replace function public.hotmart_lookup_connection_by_token_hash(
  p_hottok_hash text
)
returns table (
  connection_id uuid,
  organization_id uuid,
  domain public.smkon_revenue_domain,
  external_account_id text,
  status public.smkon_connection_status
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_hottok_hash is null or p_hottok_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_token_hash' using errcode = '22023';
  end if;

  return query
  select c.connection_id, c.organization_id, c.domain, sc.external_account_id, sc.status
  from public.hotmart_credentials c
  join public.source_connections sc
    on sc.id = c.connection_id
   and sc.organization_id = c.organization_id
   and sc.domain = c.domain
  where c.hottok_hash = p_hottok_hash
  limit 1;
end;
$$;

revoke all on function public.hotmart_lookup_connection_by_token_hash(text) from public, anon, authenticated;
grant execute on function public.hotmart_lookup_connection_by_token_hash(text) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Configuração de credenciais (service_role)
-- ---------------------------------------------------------------------------
create or replace function public.hotmart_set_connection_credentials(
  p_connection_id uuid,
  p_organization_id uuid,
  p_domain public.smkon_revenue_domain,
  p_hottok_hash text,
  p_encrypted_hottok jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_hottok_hash is null or p_hottok_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_token_hash' using errcode = '22023';
  end if;

  insert into public.hotmart_credentials (
    connection_id, organization_id, domain, hottok_hash, encrypted_hottok, updated_at
  ) values (
    p_connection_id, p_organization_id, p_domain, p_hottok_hash, coalesce(p_encrypted_hottok, '{}'::jsonb), now()
  )
  on conflict (connection_id)
  do update set
    organization_id = excluded.organization_id,
    domain = excluded.domain,
    hottok_hash = excluded.hottok_hash,
    encrypted_hottok = excluded.encrypted_hottok,
    updated_at = now();
end;
$$;

revoke all on function public.hotmart_set_connection_credentials(uuid, uuid, public.smkon_revenue_domain, text, jsonb) from public, anon, authenticated;
grant execute on function public.hotmart_set_connection_credentials(uuid, uuid, public.smkon_revenue_domain, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Persistência atômica do webhook (PII-free, idempotente)
-- ---------------------------------------------------------------------------
create or replace function public.hotmart_persist_webhook_event(
  p_connection_id uuid,
  p_organization_id uuid,
  p_event jsonb,
  p_received_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection record;
  v_domain public.smkon_revenue_domain;
  v_external_id text;
  v_event_type text;
  v_currency text;
  v_gross_amount numeric(18,4);
  v_commission_amount numeric(18,4);
  v_fee_amount numeric(18,4);
  v_refund_amount numeric(18,4);
  v_occurred_at timestamptz;
  v_payload_hash text;
  v_normalization_version integer;
  v_order_status text;
  v_commission_status text;
  v_event_id uuid;
  v_target_id uuid;
  v_current_affiliate_status text;
  v_key text;
begin
  if p_connection_id is null or p_organization_id is null then
    raise exception 'invalid_connection_context' using errcode = '22023';
  end if;

  if p_event is null or jsonb_typeof(p_event) <> 'object' then
    raise exception 'invalid_event_payload' using errcode = '22023';
  end if;

  -- Guarda estrita contra PII e formato inválido:
  -- Rejeita qualquer chave ligada a dados pessoais (nome, email, telefone, documento, etc.)
  for v_key in select jsonb_object_keys(p_event)
  loop
    if v_key in ('buyer', 'email', 'name', 'phone', 'document', 'cpf', 'cnpj', 'address', 'customer') then
      raise exception 'hotmart_event_pii_forbidden' using errcode = '22023', hint = 'Dados pessoais não podem ser armazenados.';
    end if;
    if v_key not in (
      'external_id', 'event_type', 'domain', 'currency', 'gross_amount',
      'commission_amount', 'fee_amount', 'refund_amount', 'occurred_at',
      'payload_hash', 'normalization_version', 'order_status', 'commission_status',
      'product_id', 'product_name'
    ) then
      raise exception 'invalid_event_attribute' using errcode = '22023', detail = v_key;
    end if;
  end loop;

  -- Campos obrigatórios
  if not (p_event ?& array[
    'external_id', 'event_type', 'domain', 'currency', 'gross_amount',
    'occurred_at', 'payload_hash', 'normalization_version'
  ]) then
    raise exception 'missing_required_event_attributes' using errcode = '22023';
  end if;

  v_external_id := p_event->>'external_id';
  v_event_type := p_event->>'event_type';
  v_currency := p_event->>'currency';
  v_gross_amount := coalesce((p_event->>'gross_amount')::numeric(18,4), 0);
  v_commission_amount := coalesce((p_event->>'commission_amount')::numeric(18,4), 0);
  v_fee_amount := coalesce((p_event->>'fee_amount')::numeric(18,4), 0);
  v_refund_amount := coalesce((p_event->>'refund_amount')::numeric(18,4), 0);
  v_occurred_at := (p_event->>'occurred_at')::timestamptz;
  v_payload_hash := p_event->>'payload_hash';
  v_normalization_version := (p_event->>'normalization_version')::integer;
  v_order_status := p_event->>'order_status';
  v_commission_status := p_event->>'commission_status';

  if v_external_id is null or length(v_external_id) < 1 or length(v_external_id) > 100 then
    raise exception 'invalid_external_id' using errcode = '22023';
  end if;

  if v_event_type is null or length(v_event_type) < 1 or length(v_event_type) > 64 then
    raise exception 'invalid_event_type' using errcode = '22023';
  end if;

  if v_currency is null or v_currency !~ '^[A-Z]{3}$' then
    raise exception 'invalid_currency' using errcode = '22023';
  end if;

  if v_gross_amount < 0 or v_commission_amount < 0 or v_fee_amount < 0 or v_refund_amount < 0 then
    raise exception 'invalid_monetary_amount' using errcode = '22023';
  end if;

  if v_occurred_at is null then
    raise exception 'invalid_occurred_at' using errcode = '22023';
  end if;

  if v_payload_hash is null or v_payload_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_payload_hash' using errcode = '22023';
  end if;

  if v_normalization_version is null or v_normalization_version < 1 then
    raise exception 'invalid_normalization_version' using errcode = '22023';
  end if;

  -- Valida a conexão na tabela source_connections
  select sc.id, sc.organization_id, sc.domain, sc.status
    into v_connection
  from public.source_connections sc
  where sc.id = p_connection_id
    and sc.organization_id = p_organization_id
    and sc.provider = 'hotmart'
  for share;

  if v_connection.id is null then
    raise exception 'source_connection_not_found' using errcode = 'P0002';
  end if;

  v_domain := v_connection.domain;

  -- 1. Inserção / atualização em external_events (idempotente)
  insert into public.external_events (
    organization_id, connection_id, domain, provider, external_id,
    event_type, occurred_at, received_at, payload_hash, normalization_version
  ) values (
    p_organization_id, p_connection_id, v_domain, 'hotmart',
    v_external_id, v_event_type, v_occurred_at, coalesce(p_received_at, now()),
    v_payload_hash, v_normalization_version
  )
  on conflict (organization_id, provider, external_id, event_type)
  do update set
    occurred_at = excluded.occurred_at,
    payload_hash = excluded.payload_hash,
    normalization_version = excluded.normalization_version,
    received_at = excluded.received_at
  where public.external_events.connection_id = excluded.connection_id
  returning id into v_event_id;

  if v_event_id is null then
    raise exception 'external_event_connection_conflict' using errcode = '23505';
  end if;

  -- 2. Processamento por domínio
  if v_domain = 'owned_sales' then
    if v_order_status is null or v_order_status not in ('pending', 'paid', 'fulfilled', 'cancelled', 'refunded', 'partially_refunded') then
      raise exception 'invalid_order_status' using errcode = '22023';
    end if;

    insert into public.sales_orders (
      organization_id, connection_id, domain, external_event_id, provider,
      external_order_id, order_status, currency, gross_amount, discount_amount,
      fee_amount, shipping_amount, refund_amount, occurred_at, settled_at
    ) values (
      p_organization_id, p_connection_id, 'owned_sales', v_event_id, 'hotmart',
      v_external_id, v_order_status, v_currency, v_gross_amount, 0,
      v_fee_amount, 0, v_refund_amount, v_occurred_at,
      case when v_order_status = 'paid' then v_occurred_at end
    )
    on conflict (organization_id, provider, external_order_id)
    do update set
      external_event_id = excluded.external_event_id,
      order_status = excluded.order_status,
      gross_amount = excluded.gross_amount,
      fee_amount = excluded.fee_amount,
      refund_amount = excluded.refund_amount,
      occurred_at = excluded.occurred_at,
      settled_at = coalesce(public.sales_orders.settled_at, excluded.settled_at)
    where public.sales_orders.connection_id = excluded.connection_id
    returning id into v_target_id;

    if v_target_id is null then
      raise exception 'sales_order_connection_conflict' using errcode = '23505';
    end if;

    -- Lançamentos contábeis no ledger para venda própria (idempotentes via unique constraint)
    if v_order_status in ('paid', 'fulfilled') and v_gross_amount > 0 then
      insert into public.financial_ledger_entries (
        organization_id, domain, entry_type, source_table, source_id, currency, amount, effective_at
      ) values (
        p_organization_id, 'owned_sales', 'sales_gross', 'sales_orders', v_target_id, v_currency, v_gross_amount, v_occurred_at
      ) on conflict (organization_id, source_table, source_id, entry_type) do nothing;

      if v_fee_amount > 0 then
        insert into public.financial_ledger_entries (
          organization_id, domain, entry_type, source_table, source_id, currency, amount, effective_at
        ) values (
          p_organization_id, 'owned_sales', 'sales_fee', 'sales_orders', v_target_id, v_currency, -v_fee_amount, v_occurred_at
        ) on conflict (organization_id, source_table, source_id, entry_type) do nothing;
      end if;
    elsif v_order_status = 'refunded' and v_refund_amount > 0 then
      insert into public.financial_ledger_entries (
        organization_id, domain, entry_type, source_table, source_id, currency, amount, effective_at
      ) values (
        p_organization_id, 'owned_sales', 'sales_refund', 'sales_orders', v_target_id, v_currency, -v_refund_amount, v_occurred_at
      ) on conflict (organization_id, source_table, source_id, entry_type) do nothing;
    end if;

  elsif v_domain = 'affiliate' then
    if v_commission_status is null or v_commission_status not in ('pending', 'approved', 'settled', 'paid', 'cancelled', 'reversed') then
      raise exception 'invalid_commission_status' using errcode = '22023';
    end if;

    -- Verifica se já existe e qual o estado atual
    select ac.status::text, ac.id into v_current_affiliate_status, v_target_id
    from public.affiliate_conversions ac
    where ac.organization_id = p_organization_id
      and ac.provider = 'hotmart'
      and ac.external_conversion_id = v_external_id;

    -- Se o estado já é terminal ('reversed' ou 'cancelled'), eventos tardios não regridem o estado
    if v_current_affiliate_status in ('reversed', 'cancelled') then
      -- Mantém o estado terminal intacto
      null;
    elsif v_target_id is null then
      -- Primeira inserção
      insert into public.affiliate_conversions (
        organization_id, connection_id, domain, external_event_id, provider,
        external_conversion_id, currency, order_amount, commission_amount,
        status, occurred_at
      ) values (
        p_organization_id, p_connection_id, 'affiliate', v_event_id, 'hotmart',
        v_external_id, v_currency, v_gross_amount, v_commission_amount,
        v_commission_status::public.smkon_commission_status, v_occurred_at
      ) returning id into v_target_id;
    else
      -- Atualização respeitando a máquina de estados do S8
      update public.affiliate_conversions
      set external_event_id = v_event_id,
          status = v_commission_status::public.smkon_commission_status,
          updated_at = now()
      where id = v_target_id
        and organization_id = p_organization_id
        and connection_id = p_connection_id;
    end if;
  end if;

  -- 3. Atualiza timestamps da conexão
  update public.source_connections
  set last_synced_at = greatest(coalesce(last_synced_at, '-infinity'::timestamptz), coalesce(p_received_at, now())),
      status = 'connected',
      updated_at = now()
  where id = p_connection_id
    and organization_id = p_organization_id;

  return jsonb_build_object(
    'ok', true,
    'event_id', v_event_id,
    'domain', v_domain::text,
    'target_id', v_target_id,
    'status', coalesce(v_commission_status, v_order_status)
  );
end;
$$;

revoke all on function public.hotmart_persist_webhook_event(uuid, uuid, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.hotmart_persist_webhook_event(uuid, uuid, jsonb, timestamptz) to service_role;
