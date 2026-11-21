-- S17: Hub de Conectores — fundação comum para redes sociais, lojas e infoprodutos.
--
-- Constrói sobre o que já existe (source_connections / external_events do S11) em vez de
-- criar uma camada paralela:
-- 1. source_connections aceita os novos provedores de receita: Hotmart, Shopify e Stripe.
-- 2. social_accounts: contas de redes sociais por workspace (Business/Creator, Página, Canal),
--    conectadas via Metricool (fase 1) ou API nativa (fase 2). Sem tokens nesta tabela.
-- 3. external_action_requests: toda escrita externa (post, bio, foto, link) passa por um pedido
--    com payload imutável e hash; só executa depois de aprovação humana do hash exato.
--
-- Preparação apenas: não aplicar no banco hospedado sem autorização do Owner.

-- ---------------------------------------------------------------------------
-- 1. Novos provedores de receita
-- ---------------------------------------------------------------------------
alter table public.source_connections drop constraint source_connections_provider_check;
alter table public.source_connections drop constraint source_connections_check;

alter table public.source_connections
  add constraint source_connections_provider_check check (provider in (
    'meta_ads', 'google_ads', 'mercado_livre', 'tiktok_shop_seller', 'tiktok_shop_affiliate',
    'amazon_associates', 'hotmart', 'shopify', 'stripe'
  ));

-- Hotmart: produtor (venda própria) ou afiliado (comissão). Shopify e Stripe: venda própria.
alter table public.source_connections
  add constraint source_connections_check check (
    (provider in ('meta_ads', 'google_ads') and domain = 'paid_media')
    or (provider in ('mercado_livre', 'tiktok_shop_seller', 'shopify', 'stripe') and domain = 'owned_sales')
    or (provider in ('tiktok_shop_affiliate', 'amazon_associates') and domain = 'affiliate')
    or (provider = 'hotmart' and domain in ('owned_sales', 'affiliate'))
  );

-- ---------------------------------------------------------------------------
-- 2. Contas sociais
-- ---------------------------------------------------------------------------
create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  network text not null check (network in (
    'instagram', 'facebook', 'tiktok', 'youtube', 'pinterest', 'linkedin', 'threads', 'x'
  )),
  account_type text not null check (account_type in ('business', 'creator', 'page', 'channel', 'personal')),
  via text not null check (via in ('metricool', 'native')),
  external_account_id text not null check (length(external_account_id) between 1 and 200),
  handle text check (handle is null or length(handle) between 1 and 100),
  display_name text check (display_name is null or length(display_name) <= 200),
  status public.smkon_connection_status not null default 'pending',
  -- Capacidades detectadas na conexão (ex.: publish, read_metrics, update_bio).
  capabilities text[] not null default '{}'
    check (capabilities <@ array['publish', 'read_metrics', 'update_bio', 'update_photo', 'update_link', 'read_comments']),
  last_synced_at timestamptz,
  last_error_code text check (last_error_code is null or last_error_code ~ '^[a-z0-9_]{1,64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, network, external_account_id),
  unique (id, organization_id),
  -- Instagram e Threads exigem conta profissional para publicar por API.
  check (network not in ('instagram', 'threads') or account_type in ('business', 'creator')),
  check (network <> 'facebook' or account_type = 'page'),
  check (network <> 'youtube' or account_type = 'channel'),
  -- O X não é atendido pelo Metricool.
  check (network <> 'x' or via = 'native')
);

create index social_accounts_org_idx on public.social_accounts (organization_id, network);

alter table public.social_accounts enable row level security;
revoke all on public.social_accounts from public, anon, authenticated;
grant select on public.social_accounts to authenticated;
grant select, insert, update, delete on public.social_accounts to service_role;

create policy "members read social accounts" on public.social_accounts
for select to authenticated using (exists (
  select 1 from public.organization_members m
  where m.organization_id = social_accounts.organization_id and m.user_id = (select auth.uid())
));

create or replace function public.social_accounts_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.social_accounts_touch() from public, anon, authenticated;

create trigger social_accounts_touch before update on public.social_accounts
for each row execute function public.social_accounts_touch();

-- ---------------------------------------------------------------------------
-- 3. Pedidos de ação externa com aprovação pelo hash exato
-- ---------------------------------------------------------------------------
create table public.external_action_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  social_account_id uuid not null,
  action text not null check (action in ('publish_post', 'update_bio', 'update_photo', 'update_link')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 65536),
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending_approval' check (status in (
    'pending_approval', 'approved', 'rejected', 'cancelled', 'executing', 'executed', 'failed'
  )),
  requested_by uuid not null references auth.users(id),
  requested_at timestamptz not null default now(),
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  approved_hash text check (approved_hash is null or approved_hash ~ '^[a-f0-9]{64}$'),
  decision_note text check (decision_note is null or length(decision_note) <= 1000),
  executed_at timestamptz,
  external_ref text check (external_ref is null or length(external_ref) <= 300),
  error_code text check (error_code is null or error_code ~ '^[a-z0-9_]{1,64}$'),
  foreign key (social_account_id, organization_id)
    references public.social_accounts(id, organization_id) on delete restrict,
  -- Aprovação sempre registra quem, quando e o hash aprovado, igual ao payload.
  check (status not in ('approved', 'executing', 'executed', 'failed')
         or (decided_by is not null and decided_at is not null and approved_hash = payload_hash)),
  check (status <> 'executed' or executed_at is not null)
);

create index external_action_requests_org_status_idx
  on public.external_action_requests (organization_id, status, requested_at desc);
create index external_action_requests_account_idx
  on public.external_action_requests (social_account_id, organization_id);

alter table public.external_action_requests enable row level security;
revoke all on public.external_action_requests from public, anon, authenticated;
grant select on public.external_action_requests to authenticated;
grant select, insert, update on public.external_action_requests to service_role;

create policy "members read external action requests" on public.external_action_requests
for select to authenticated using (exists (
  select 1 from public.organization_members m
  where m.organization_id = external_action_requests.organization_id and m.user_id = (select auth.uid())
));

create or replace function public.external_action_hash(p_action text, p_payload jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(jsonb_build_array(p_action, p_payload)::text, 'UTF8')), 'hex');
$$;
grant execute on function public.external_action_hash(text, jsonb) to authenticated, service_role;

-- Guarda: hash sempre recalculado no servidor; payload, ação e alvo imutáveis;
-- transições de status só na ordem permitida; sem delete.
create or replace function public.external_action_requests_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.payload_hash := public.external_action_hash(new.action, new.payload);
    if new.status <> 'pending_approval' then
      raise exception 'invalid_initial_status' using errcode = '22023';
    end if;
    return new;
  end if;

  if new.organization_id <> old.organization_id
     or new.social_account_id <> old.social_account_id
     or new.action <> old.action
     or new.payload <> old.payload
     or new.payload_hash <> old.payload_hash
     or new.requested_by <> old.requested_by
     or new.requested_at <> old.requested_at then
    raise exception 'action_request_immutable' using errcode = '42501';
  end if;

  if new.status <> old.status and not (
       (old.status = 'pending_approval' and new.status in ('approved', 'rejected', 'cancelled'))
    or (old.status = 'approved' and new.status in ('executing', 'cancelled'))
    or (old.status = 'executing' and new.status in ('executed', 'failed'))
  ) then
    raise exception 'invalid_status_transition' using errcode = '22023';
  end if;

  -- Uma decisão registrada não é reescrita.
  if old.decided_by is not null and (
       new.decided_by is distinct from old.decided_by
    or new.decided_at is distinct from old.decided_at
    or new.approved_hash is distinct from old.approved_hash) then
    raise exception 'decision_immutable' using errcode = '42501';
  end if;

  return new;
end;
$$;
revoke all on function public.external_action_requests_guard() from public, anon, authenticated;

create trigger external_action_requests_guard before insert or update on public.external_action_requests
for each row execute function public.external_action_requests_guard();
create trigger external_action_requests_no_delete before delete on public.external_action_requests
for each row execute function public.reject_mutation();

create or replace function public.external_action_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (organization_id, actor_id, action, table_name, record_id, old_data, new_data)
  values (
    new.organization_id, auth.uid(), tg_op, 'external_action_requests', new.id::text,
    case when tg_op = 'UPDATE' then jsonb_build_object('status', old.status) end,
    jsonb_build_object('status', new.status, 'action', new.action, 'payload_hash', new.payload_hash,
                       'social_account_id', new.social_account_id, 'error_code', new.error_code)
  );
  return new;
end;
$$;
revoke all on function public.external_action_audit() from public, anon, authenticated;

create trigger external_action_requests_audit after insert or update on public.external_action_requests
for each row execute function public.external_action_audit();

-- Pedido: owner, admin ou analyst. A conta precisa estar conectada e ter a capacidade.
create or replace function public.request_external_action(
  p_social_account_id uuid,
  p_action text,
  p_payload jsonb
)
returns table (request_id uuid, payload_hash text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_account public.social_accounts%rowtype;
  v_role text;
  v_capability text;
  v_row public.external_action_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_account from public.social_accounts where id = p_social_account_id;
  v_role := case when v_account.id is null then null else public.publication_member_role(v_account.organization_id) end;
  if v_account.id is null or v_role is null then
    raise exception 'social_account_not_found' using errcode = 'P0002';
  end if;
  if v_role not in ('owner', 'admin', 'analyst') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_account.status <> 'connected' then
    raise exception 'social_account_not_connected' using errcode = 'P0001';
  end if;

  v_capability := case p_action
    when 'publish_post' then 'publish'
    when 'update_bio' then 'update_bio'
    when 'update_photo' then 'update_photo'
    when 'update_link' then 'update_link'
  end;
  if v_capability is null then
    raise exception 'invalid_action' using errcode = '22023';
  end if;
  if not (v_capability = any (v_account.capabilities)) then
    raise exception 'capability_not_supported' using errcode = 'P0001';
  end if;

  insert into public.external_action_requests (organization_id, social_account_id, action, payload, payload_hash, requested_by)
  values (v_account.organization_id, v_account.id, p_action, p_payload, repeat('0', 64), v_uid)
  returning * into v_row;

  return query select v_row.id, v_row.payload_hash;
end;
$$;
revoke all on function public.request_external_action(uuid, text, jsonb) from public, anon;
grant execute on function public.request_external_action(uuid, text, jsonb) to authenticated;

-- Decisão: só owner/admin, conferindo o hash exato que viu na tela.
create or replace function public.decide_external_action(
  p_request_id uuid,
  p_decision text,
  p_expected_hash text,
  p_note text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.external_action_requests%rowtype;
  v_role text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'invalid_decision' using errcode = '22023';
  end if;

  select * into v_req from public.external_action_requests where id = p_request_id for update;
  v_role := case when v_req.id is null then null else public.publication_member_role(v_req.organization_id) end;
  if v_req.id is null or v_role is null then
    raise exception 'action_request_not_found' using errcode = 'P0002';
  end if;
  if v_role not in ('owner', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_expected_hash is null or p_expected_hash <> v_req.payload_hash then
    raise exception 'hash_mismatch' using errcode = 'P0001';
  end if;

  -- Idempotente para a mesma decisão.
  if v_req.status = p_decision then
    return v_req.status;
  end if;
  if v_req.status <> 'pending_approval' then
    raise exception 'action_request_closed' using errcode = 'P0001';
  end if;

  update public.external_action_requests
  set status = p_decision,
      decided_by = v_uid,
      decided_at = now(),
      approved_hash = case when p_decision = 'approved' then v_req.payload_hash end,
      decision_note = left(p_note, 1000)
  where id = v_req.id;

  return p_decision;
end;
$$;
revoke all on function public.decide_external_action(uuid, text, text, text) from public, anon;
grant execute on function public.decide_external_action(uuid, text, text, text) to authenticated;

-- Cancelamento antes da execução: quem pediu, owner ou admin.
create or replace function public.cancel_external_action(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.external_action_requests%rowtype;
  v_role text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_req from public.external_action_requests where id = p_request_id for update;
  v_role := case when v_req.id is null then null else public.publication_member_role(v_req.organization_id) end;
  if v_req.id is null or v_role is null then
    raise exception 'action_request_not_found' using errcode = 'P0002';
  end if;
  if not (v_role in ('owner', 'admin') or v_req.requested_by = v_uid) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_req.status not in ('pending_approval', 'approved') then
    raise exception 'action_request_closed' using errcode = 'P0001';
  end if;
  update public.external_action_requests set status = 'cancelled' where id = v_req.id;
end;
$$;
revoke all on function public.cancel_external_action(uuid) from public, anon;
grant execute on function public.cancel_external_action(uuid) to authenticated;

-- Executor (service_role): só reivindica pedido aprovado cujo hash ainda confere.
create or replace function public.claim_external_action(p_request_id uuid)
returns public.external_action_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.external_action_requests%rowtype;
begin
  update public.external_action_requests
  set status = 'executing'
  where id = p_request_id
    and status = 'approved'
    and approved_hash = payload_hash
    and approved_hash = public.external_action_hash(action, payload)
  returning * into v_req;
  if v_req.id is null then
    raise exception 'action_request_not_claimable' using errcode = 'P0001';
  end if;
  return v_req;
end;
$$;

create or replace function public.finish_external_action(
  p_request_id uuid,
  p_ok boolean,
  p_external_ref text default null,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  update public.external_action_requests
  set status = case when p_ok then 'executed' else 'failed' end,
      executed_at = case when p_ok then now() end,
      external_ref = case when p_ok then left(p_external_ref, 300) end,
      error_code = case when p_ok then null else coalesce(p_error_code, 'unknown_error') end
  where id = p_request_id and status = 'executing';
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'action_request_not_executing' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.claim_external_action(uuid) from public, anon, authenticated;
revoke all on function public.finish_external_action(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.claim_external_action(uuid) to service_role;
grant execute on function public.finish_external_action(uuid, boolean, text, text) to service_role;
