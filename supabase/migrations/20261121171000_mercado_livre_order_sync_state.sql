-- S11: durable, single-worker checkpoint for manual Mercado Livre order history.
-- The cursor advances in the same transaction as the corresponding order/event upserts.
create table public.mercado_livre_order_sync_state (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null,
  domain public.smkon_revenue_domain not null default 'owned_sales' check (domain = 'owned_sales'),
  created_from timestamptz not null,
  created_to timestamptz not null,
  next_offset integer not null default 0 check (next_offset between 0 and 10050),
  page_size integer not null default 50 check (page_size = 50),
  provider_total integer check (provider_total is null or provider_total >= 0),
  status text not null default 'ready' check (status in ('ready', 'running', 'completed', 'blocked')),
  lease_id uuid,
  lease_expires_at timestamptz,
  last_error_code text check (last_error_code is null or last_error_code ~ '^[a-z0-9_]{1,80}$'),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mercado_livre_order_sync_state_window check (created_from < created_to),
  constraint mercado_livre_order_sync_state_lease_pair check ((lease_id is null) = (lease_expires_at is null)),
  constraint mercado_livre_order_sync_state_connection_fk
    foreign key (connection_id, organization_id, domain)
    references public.source_connections(id, organization_id, domain)
    on delete cascade,
  constraint mercado_livre_order_sync_state_connection_unique unique (organization_id, connection_id)
);

create index mercado_livre_order_sync_state_connection_fk_idx
  on public.mercado_livre_order_sync_state (connection_id, organization_id, domain);

alter table public.mercado_livre_order_sync_state enable row level security;
revoke all on table public.mercado_livre_order_sync_state from public, anon, authenticated;
grant select, insert, update, delete on table public.mercado_livre_order_sync_state to service_role;

create or replace function public.mercado_livre_claim_order_sync(
  p_connection_id uuid,
  p_organization_id uuid,
  p_action text default 'next',
  p_now timestamptz default now(),
  p_lease_seconds integer default 300
)
returns table (
  sync_id uuid,
  sync_status text,
  created_from timestamptz,
  created_to timestamptz,
  next_offset integer,
  page_size integer,
  provider_total integer,
  lease_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.mercado_livre_order_sync_state%rowtype;
  v_window_to timestamptz;
  v_window_from timestamptz;
  v_lease_id uuid;
begin
  if p_connection_id is null or p_organization_id is null
     or p_action is null or p_action not in ('next', 'restart')
     or p_now is null or p_now > now() + interval '5 minutes'
     or p_lease_seconds is null or p_lease_seconds not between 30 and 600 then
    raise exception 'invalid_order_sync_claim' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.source_connections sc
    where sc.id = p_connection_id
      and sc.organization_id = p_organization_id
      and sc.provider = 'mercado_livre'
      and sc.domain = 'owned_sales'
      and sc.status = 'connected'
      and sc.external_account_id is not null
  ) then
    raise exception 'connected_marketplace_account_not_found' using errcode = '42501';
  end if;

  v_window_to := date_trunc('hour', p_now at time zone 'UTC') at time zone 'UTC';
  v_window_from := v_window_to - interval '1 year';

  insert into public.mercado_livre_order_sync_state (
    organization_id, connection_id, domain, created_from, created_to, next_offset, page_size, status
  ) values (
    p_organization_id, p_connection_id, 'owned_sales', v_window_from, v_window_to, 0, 50, 'ready'
  )
  on conflict (organization_id, connection_id) do nothing;

  select s.* into v_state
  from public.mercado_livre_order_sync_state s
  where s.organization_id = p_organization_id
    and s.connection_id = p_connection_id
  for update;

  if v_state.lease_id is not null and v_state.lease_expires_at > p_now then
    return query select v_state.id, 'busy'::text, v_state.created_from, v_state.created_to,
      v_state.next_offset, v_state.page_size, v_state.provider_total, null::uuid;
    return;
  end if;

  if p_action = 'restart' then
    update public.mercado_livre_order_sync_state s
    set created_from = v_window_from,
        created_to = v_window_to,
        next_offset = 0,
        provider_total = null,
        status = 'ready',
        lease_id = null,
        lease_expires_at = null,
        last_error_code = null,
        last_synced_at = null,
        updated_at = now()
    where s.id = v_state.id;

    select s.* into v_state
    from public.mercado_livre_order_sync_state s
    where s.id = v_state.id;
  end if;

  if v_state.status in ('completed', 'blocked') then
    return query select v_state.id, v_state.status, v_state.created_from, v_state.created_to,
      v_state.next_offset, v_state.page_size, v_state.provider_total, null::uuid;
    return;
  end if;

  v_lease_id := pg_catalog.gen_random_uuid();
  update public.mercado_livre_order_sync_state s
  set status = 'running',
      lease_id = v_lease_id,
      lease_expires_at = p_now + make_interval(secs => p_lease_seconds),
      last_error_code = null,
      updated_at = now()
  where s.id = v_state.id;

  return query
  select s.id, s.status, s.created_from, s.created_to, s.next_offset,
    s.page_size, s.provider_total, s.lease_id
  from public.mercado_livre_order_sync_state s
  where s.id = v_state.id;
end;
$$;

create or replace function public.mercado_livre_persist_order_sync_page(
  p_connection_id uuid,
  p_organization_id uuid,
  p_lease_id uuid,
  p_expected_offset integer,
  p_orders jsonb,
  p_provider_total integer,
  p_has_more boolean,
  p_synced_at timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.mercado_livre_order_sync_state%rowtype;
  v_page_count integer;
  v_next_offset integer;
  v_processed integer;
  v_next_status text;
  v_error_code text;
begin
  if p_connection_id is null or p_organization_id is null or p_lease_id is null
     or p_expected_offset is null or p_expected_offset < 0
     or p_expected_offset > 10000 or p_expected_offset % 50 <> 0
     or p_orders is null or jsonb_typeof(p_orders) <> 'array'
     or p_provider_total is not null and p_provider_total < 0
     or p_has_more is null
     or p_synced_at is null or p_synced_at > now() + interval '5 minutes' then
    raise exception 'invalid_order_sync_page' using errcode = '22023';
  end if;

  select s.* into v_state
  from public.mercado_livre_order_sync_state s
  where s.connection_id = p_connection_id
    and s.organization_id = p_organization_id
    and s.lease_id = p_lease_id
    and s.status = 'running'
    and s.lease_expires_at > now()
    and s.next_offset = p_expected_offset
  for update;

  if v_state.id is null then
    raise exception 'order_sync_lease_or_offset_mismatch' using errcode = '40001';
  end if;

  v_page_count := jsonb_array_length(p_orders);
  if v_page_count > v_state.page_size then
    raise exception 'order_sync_page_size_exceeded' using errcode = '22023';
  end if;
  if p_has_more and v_page_count = 0 then
    raise exception 'order_sync_page_made_no_progress' using errcode = '22023';
  end if;

  v_processed := public.mercado_livre_persist_order_snapshots(
    p_connection_id, p_organization_id, p_orders, p_synced_at
  );

  v_next_offset := p_expected_offset + v_page_count;
  v_next_status := case when p_has_more then 'ready' else 'completed' end;
  v_error_code := null;

  if p_has_more and v_next_offset > 10000 then
    v_next_status := 'blocked';
    v_error_code := 'offset_limit_reached';
  end if;

  update public.mercado_livre_order_sync_state s
  set next_offset = v_next_offset,
      provider_total = coalesce(p_provider_total, s.provider_total),
      status = v_next_status,
      lease_id = null,
      lease_expires_at = null,
      last_error_code = v_error_code,
      last_synced_at = p_synced_at,
      updated_at = now()
  where s.id = v_state.id;

  return v_processed;
end;
$$;

create or replace function public.mercado_livre_release_order_sync(
  p_connection_id uuid,
  p_organization_id uuid,
  p_lease_id uuid,
  p_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if p_connection_id is null or p_organization_id is null or p_lease_id is null
     or p_error_code is not null and p_error_code !~ '^[a-z0-9_]{1,80}$' then
    raise exception 'invalid_order_sync_release' using errcode = '22023';
  end if;

  update public.mercado_livre_order_sync_state s
  set status = 'ready',
      lease_id = null,
      lease_expires_at = null,
      last_error_code = p_error_code,
      updated_at = now()
  where s.connection_id = p_connection_id
    and s.organization_id = p_organization_id
    and s.lease_id = p_lease_id
    and s.status = 'running';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.mercado_livre_claim_order_sync(uuid, uuid, text, timestamptz, integer)
  from public, anon, authenticated;
revoke all on function public.mercado_livre_persist_order_sync_page(uuid, uuid, uuid, integer, jsonb, integer, boolean, timestamptz)
  from public, anon, authenticated;
revoke all on function public.mercado_livre_release_order_sync(uuid, uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.mercado_livre_claim_order_sync(uuid, uuid, text, timestamptz, integer) to service_role;
grant execute on function public.mercado_livre_persist_order_sync_page(uuid, uuid, uuid, integer, jsonb, integer, boolean, timestamptz) to service_role;
grant execute on function public.mercado_livre_release_order_sync(uuid, uuid, uuid, text) to service_role;
