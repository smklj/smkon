-- SMKON S5: convites de workspace (acesso somente por convite).
-- Contrato: docs/INVITATIONS_AND_IDEMPOTENCY_PLAN.md.
-- - Só owner/admin convidam; papel owner nunca é convidável.
-- - Token aleatório gerado no servidor da aplicação; o banco guarda só o SHA-256 (token_hash).
-- - Convite pendente é idempotente por (workspace, e-mail); expira; uso único.
-- - Aceite exige sessão cujo e-mail confirmado seja o convidado.
-- - Criação, aceite e revogação ficam na auditoria (trigger audit_row_change).

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (
    email = lower(btrim(email))
    and char_length(email) <= 254
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  role text not null check (role in ('admin', 'analyst', 'viewer')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  invited_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  check (expires_at > created_at),
  check (accepted_at is null or revoked_at is null),
  check ((accepted_at is null) = (accepted_by is null))
);

-- No máximo um convite pendente por workspace e e-mail.
create unique index organization_invitations_pending_uidx
  on public.organization_invitations (organization_id, email)
  where accepted_at is null and revoked_at is null;
create index organization_invitations_org_created_idx on public.organization_invitations (organization_id, created_at desc);
create index organization_invitations_invited_by_fk_idx on public.organization_invitations (invited_by);
create index organization_invitations_accepted_by_fk_idx on public.organization_invitations (accepted_by);
create index organization_invitations_revoked_by_fk_idx on public.organization_invitations (revoked_by);

alter table public.organization_invitations enable row level security;
revoke all on public.organization_invitations from anon, authenticated;

-- token_hash nunca é legível pela API: grant por coluna, sem token_hash.
grant select (id, organization_id, email, role, invited_by, created_at, expires_at, accepted_at, accepted_by, revoked_at, revoked_by)
  on public.organization_invitations to authenticated;

create policy "owners and admins read invitations"
on public.organization_invitations for select to authenticated
using (exists (
  select 1 from public.organization_members m
  where m.organization_id = organization_invitations.organization_id
    and m.user_id = (select auth.uid())
    and m.role in ('owner', 'admin')
));

create trigger audit_organization_invitations
after insert or update or delete on public.organization_invitations
for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- create_invitation: idempotente por convite pendente e não expirado.
-- ---------------------------------------------------------------------------
create or replace function public.create_invitation(
  p_organization_id uuid,
  p_email text,
  p_role text,
  p_token_hash text
)
returns table (invitation_id uuid, created boolean, invitation_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_caller_role text;
  v_existing public.organization_invitations%rowtype;
  v_new_id uuid;
  v_new_expires timestamptz;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select m.role into v_caller_role
  from public.organization_members m
  where m.organization_id = p_organization_id and m.user_id = v_uid;

  if v_caller_role is null or v_caller_role not in ('owner', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('admin', 'analyst', 'viewer') then
    raise exception 'invalid_role' using errcode = 'P0001';
  end if;
  if char_length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid_email' using errcode = 'P0001';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_token' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.organization_members m
    join auth.users u on u.id = m.user_id
    where m.organization_id = p_organization_id and lower(u.email) = v_email
  ) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;

  -- Serializa convites para o mesmo workspace/e-mail.
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || v_email, 0));

  select * into v_existing
  from public.organization_invitations i
  where i.organization_id = p_organization_id
    and i.email = v_email
    and i.accepted_at is null
    and i.revoked_at is null
  for update;

  if v_existing.id is not null then
    if v_existing.expires_at > now() then
      -- Idempotente: devolve o convite existente sem gerar novo token.
      return query select v_existing.id, false, v_existing.expires_at;
      return;
    end if;
    -- Expirado: encerra antes de criar outro.
    update public.organization_invitations
    set revoked_at = now(), revoked_by = v_uid
    where id = v_existing.id;
  end if;

  insert into public.organization_invitations (organization_id, email, role, token_hash, invited_by)
  values (p_organization_id, v_email, p_role, p_token_hash, v_uid)
  returning id, expires_at into v_new_id, v_new_expires;

  return query select v_new_id, true, v_new_expires;
end;
$$;

-- ---------------------------------------------------------------------------
-- accept_invitation: uso único, e-mail confirmado e igual ao convidado.
-- ---------------------------------------------------------------------------
create or replace function public.accept_invitation(p_token_hash text)
returns table (workspace_id uuid, member_role text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
  v_inv public.organization_invitations%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed
  from auth.users u where u.id = v_uid;

  if v_confirmed is null then
    raise exception 'email_not_verified' using errcode = 'P0001';
  end if;

  select * into v_inv
  from public.organization_invitations i
  where i.token_hash = p_token_hash
  for update;

  -- Inexistente, revogado ou expirado: mesma resposta (sem enumeração).
  if v_inv.id is null or v_inv.revoked_at is not null
     or (v_inv.accepted_at is null and v_inv.expires_at <= now()) then
    raise exception 'invitation_invalid' using errcode = 'P0001';
  end if;

  if v_inv.accepted_at is not null then
    -- Replay pelo mesmo usuário é idempotente; por outro usuário é inválido.
    if v_inv.accepted_by = v_uid then
      return query select v_inv.organization_id, v_inv.role;
      return;
    end if;
    raise exception 'invitation_invalid' using errcode = 'P0001';
  end if;

  if v_email is distinct from v_inv.email then
    raise exception 'invitation_email_mismatch' using errcode = 'P0001';
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_inv.organization_id, v_uid, v_inv.role)
  on conflict (organization_id, user_id) do nothing;

  update public.organization_invitations
  set accepted_at = now(), accepted_by = v_uid
  where id = v_inv.id;

  return query
    select m.organization_id, m.role
    from public.organization_members m
    where m.organization_id = v_inv.organization_id and m.user_id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- revoke_invitation: owner/admin do workspace, apenas convites pendentes.
-- ---------------------------------------------------------------------------
create or replace function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.organization_invitations%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_inv from public.organization_invitations where id = p_invitation_id for update;

  if v_inv.id is null or not exists (
    select 1 from public.organization_members m
    where m.organization_id = v_inv.organization_id
      and m.user_id = v_uid
      and m.role in ('owner', 'admin')
  ) then
    raise exception 'invitation_not_found' using errcode = 'P0002';
  end if;
  if v_inv.accepted_at is not null or v_inv.revoked_at is not null then
    raise exception 'invitation_not_pending' using errcode = 'P0001';
  end if;

  update public.organization_invitations
  set revoked_at = now(), revoked_by = v_uid
  where id = v_inv.id;
end;
$$;

revoke all on function public.create_invitation(uuid, text, text, text) from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;
revoke all on function public.revoke_invitation(uuid) from public, anon;
grant execute on function public.create_invitation(uuid, text, text, text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
