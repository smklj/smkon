-- S11: one-time OAuth attempts. Server/service-role only; no browser-readable verifier.
create table public.mercado_livre_oauth_attempts (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique check (state_hash ~ '^[a-f0-9]{64}$'),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  encrypted_verifier jsonb not null
    check (jsonb_typeof(encrypted_verifier) = 'object')
    check (encrypted_verifier ?& array['v','alg','kid','iv','tag','ciphertext']),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (connection_id, organization_id, 'owned_sales'::public.smkon_revenue_domain)
    references public.source_connections(id, organization_id, domain) on delete cascade
);

create index mercado_livre_oauth_attempts_expiry_idx
  on public.mercado_livre_oauth_attempts(expires_at);

alter table public.mercado_livre_oauth_attempts enable row level security;
revoke all on public.mercado_livre_oauth_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.mercado_livre_oauth_attempts to service_role;

create or replace function public.mercado_livre_consume_oauth_attempt(
  p_state_hash text,
  p_user_id uuid
)
returns table (
  organization_id uuid,
  connection_id uuid,
  encrypted_verifier jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.mercado_livre_oauth_attempts a
  set consumed_at = now()
  where a.state_hash = p_state_hash
    and a.created_by = p_user_id
    and a.consumed_at is null
    and a.expires_at > now()
  returning a.organization_id, a.connection_id, a.encrypted_verifier;
end;
$$;

revoke all on function public.mercado_livre_consume_oauth_attempt(text, uuid) from public, anon, authenticated;
grant execute on function public.mercado_livre_consume_oauth_attempt(text, uuid) to service_role;
