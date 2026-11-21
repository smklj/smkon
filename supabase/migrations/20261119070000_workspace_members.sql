-- SMKON S5.1: gestão de membros e seletor de organização.
-- - Listar membros: owner/admin do workspace (e-mail vem de auth.users, só via função).
-- - Alterar papel e remover membro: somente owner; nunca deixa o workspace sem owner.
-- - Alterações serializadas por workspace (advisory lock) e auditadas pelo trigger
--   audit_organization_members (UPDATE/DELETE com o ator em auth.uid()).
-- - Workspace ativo lembrado no servidor (user_active_workspace). A escolha só seleciona
--   entre memberships existentes: a autorização continua sendo a RLS por membership.
--   A FK composta para organization_members apaga a preferência quando o membro sai.

-- ---------------------------------------------------------------------------
-- 1. Workspace ativo por usuário
-- ---------------------------------------------------------------------------
create table public.user_active_workspace (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null,
  updated_at timestamptz not null default now(),
  foreign key (organization_id, user_id)
    references public.organization_members (organization_id, user_id) on delete cascade
);

create index user_active_workspace_member_fk_idx on public.user_active_workspace (organization_id, user_id);

alter table public.user_active_workspace enable row level security;
revoke all on public.user_active_workspace from anon, authenticated;
grant select on public.user_active_workspace to authenticated;

create policy "users read their own active workspace"
on public.user_active_workspace for select to authenticated
using (user_id = (select auth.uid()));

-- Escrita só pela função: confere a membership no banco, nunca confia no cliente.
create or replace function public.set_active_workspace(p_organization_id uuid)
returns table (workspace_id uuid, member_role text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_role text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select m.role into v_role
  from public.organization_members m
  where m.organization_id = p_organization_id and m.user_id = v_uid;

  -- Workspace inexistente ou de outro tenant: mesma resposta (sem enumeração).
  if v_role is null then
    raise exception 'workspace_not_found' using errcode = 'P0002';
  end if;

  insert into public.user_active_workspace (user_id, organization_id, updated_at)
  values (v_uid, p_organization_id, now())
  on conflict (user_id) do update
    set organization_id = excluded.organization_id, updated_at = excluded.updated_at;

  return query select p_organization_id, v_role;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Listagem de membros (owner/admin)
-- ---------------------------------------------------------------------------
create or replace function public.list_workspace_members(p_organization_id uuid)
returns table (user_id uuid, email text, member_role text, joined_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = v_uid
      and m.role in ('owner', 'admin')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select m.user_id, lower(u.email)::text, m.role, m.created_at
    from public.organization_members m
    left join auth.users u on u.id = m.user_id
    where m.organization_id = p_organization_id
    order by
      case m.role when 'owner' then 0 when 'admin' then 1 when 'analyst' then 2 else 3 end,
      m.created_at,
      m.user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Alterar papel (somente owner; nunca rebaixa o último owner)
-- ---------------------------------------------------------------------------
create or replace function public.change_member_role(
  p_organization_id uuid,
  p_user_id uuid,
  p_role text
)
returns table (user_id uuid, member_role text, changed boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_target_role text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('owner', 'admin', 'analyst', 'viewer') then
    raise exception 'invalid_member_role' using errcode = 'P0001';
  end if;

  -- Serializa mudanças de membership do workspace. A permissão é conferida depois
  -- do lock, para que dois owners não se rebaixem ao mesmo tempo.
  perform pg_advisory_xact_lock(hashtextextended('organization_members:' || coalesce(p_organization_id::text, ''), 0));

  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = p_organization_id and m.user_id = v_uid and m.role = 'owner'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select m.role into v_target_role
  from public.organization_members m
  where m.organization_id = p_organization_id and m.user_id = p_user_id
  for update;

  if v_target_role is null then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;

  if v_target_role = p_role then
    return query select p_user_id, v_target_role, false;
    return;
  end if;

  if v_target_role = 'owner' and (
    select count(*) from public.organization_members m
    where m.organization_id = p_organization_id and m.role = 'owner'
  ) <= 1 then
    raise exception 'last_owner' using errcode = 'P0001';
  end if;

  update public.organization_members m
  set role = p_role
  where m.organization_id = p_organization_id and m.user_id = p_user_id;

  return query select p_user_id, p_role, true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Remover membro (somente owner; nunca remove o último owner)
-- ---------------------------------------------------------------------------
create or replace function public.remove_member(p_organization_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_target_role text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('organization_members:' || coalesce(p_organization_id::text, ''), 0));

  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = p_organization_id and m.user_id = v_uid and m.role = 'owner'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select m.role into v_target_role
  from public.organization_members m
  where m.organization_id = p_organization_id and m.user_id = p_user_id
  for update;

  if v_target_role is null then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;

  if v_target_role = 'owner' and (
    select count(*) from public.organization_members m
    where m.organization_id = p_organization_id and m.role = 'owner'
  ) <= 1 then
    raise exception 'last_owner' using errcode = 'P0001';
  end if;

  delete from public.organization_members m
  where m.organization_id = p_organization_id and m.user_id = p_user_id;
end;
$$;

revoke all on function public.set_active_workspace(uuid) from public, anon;
revoke all on function public.list_workspace_members(uuid) from public, anon;
revoke all on function public.change_member_role(uuid, uuid, text) from public, anon;
revoke all on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.set_active_workspace(uuid) to authenticated;
grant execute on function public.list_workspace_members(uuid) to authenticated;
grant execute on function public.change_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
