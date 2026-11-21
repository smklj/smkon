-- S11: encrypted Mercado Livre credentials. Preparation only; do not apply to hosted DB
-- until Owner approval and staging review.
create table public.mercado_livre_credentials (
  connection_id uuid primary key,
  organization_id uuid not null,
  domain public.smkon_revenue_domain not null default 'owned_sales' check (domain = 'owned_sales'),
  encrypted_tokens jsonb not null
    check (jsonb_typeof(encrypted_tokens) = 'object')
    check (encrypted_tokens ?& array['v','alg','kid','iv','tag','ciphertext']),
  token_expires_at timestamptz not null,
  token_version bigint not null default 1 check (token_version > 0),
  refresh_lease_until timestamptz,
  updated_at timestamptz not null default now(),
  foreign key (connection_id, organization_id)
    references public.source_connections(id, organization_id, domain) on delete cascade
);

create index mercado_livre_credentials_refresh_idx
  on public.mercado_livre_credentials (token_expires_at, refresh_lease_until);

alter table public.mercado_livre_credentials enable row level security;
revoke all on public.mercado_livre_credentials from public, anon, authenticated;
grant select, insert, update, delete on public.mercado_livre_credentials to service_role;

-- Service-only lease prevents two workers from consuming the same rotating refresh token.
-- Caller must first authenticate the initiating user and validate owner/admin membership.
create or replace function public.mercado_livre_claim_refresh(
  p_connection_id uuid,
  p_lease_seconds integer default 60
)
returns table (
  organization_id uuid,
  encrypted_tokens jsonb,
  token_version bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_lease_seconds < 10 or p_lease_seconds > 300 then
    raise exception 'invalid_lease' using errcode = '22023';
  end if;

  return query
  update public.mercado_livre_credentials c
  set refresh_lease_until = now() + make_interval(secs => p_lease_seconds),
      updated_at = now()
  where c.connection_id = p_connection_id
    and (c.refresh_lease_until is null or c.refresh_lease_until < now())
  returning c.organization_id, c.encrypted_tokens, c.token_version;
end;
$$;

create or replace function public.mercado_livre_save_refreshed_tokens(
  p_connection_id uuid,
  p_expected_version bigint,
  p_encrypted_tokens jsonb,
  p_token_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if jsonb_typeof(p_encrypted_tokens) <> 'object'
     or not (p_encrypted_tokens ?& array['v','alg','kid','iv','tag','ciphertext']) then
    raise exception 'invalid_token_envelope' using errcode = '22023';
  end if;

  update public.mercado_livre_credentials c
  set encrypted_tokens = p_encrypted_tokens,
      token_expires_at = p_token_expires_at,
      token_version = c.token_version + 1,
      refresh_lease_until = null,
      updated_at = now()
  where c.connection_id = p_connection_id
    and c.token_version = p_expected_version
    and c.refresh_lease_until > now();

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.mercado_livre_release_refresh(p_connection_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.mercado_livre_credentials
  set refresh_lease_until = null, updated_at = now()
  where connection_id = p_connection_id;
$$;

revoke all on function public.mercado_livre_claim_refresh(uuid, integer) from public, anon, authenticated;
revoke all on function public.mercado_livre_save_refreshed_tokens(uuid, bigint, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.mercado_livre_release_refresh(uuid) from public, anon, authenticated;
grant execute on function public.mercado_livre_claim_refresh(uuid, integer) to service_role;
grant execute on function public.mercado_livre_save_refreshed_tokens(uuid, bigint, jsonb, timestamptz) to service_role;
grant execute on function public.mercado_livre_release_refresh(uuid) to service_role;
