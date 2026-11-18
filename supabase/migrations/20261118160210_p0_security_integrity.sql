-- SMKON P0: integridade de tenant, aprovação da versão exata, trilha de auditoria
-- e ledger financeiro imutável.
-- Revisado em Git. NÃO aplicar no Supabase hospedado sem autorização explícita.
-- Depende de: split_01_revenue_domains, content_studio, product_intelligence.
-- Observação: organizations não possui DELETE para authenticated; com histórico
-- append-only (aprovações, ledger), a exclusão física de um tenant é bloqueada por desenho.

-- ---------------------------------------------------------------------------
-- 1. Bootstrap atômico de workspace
-- ---------------------------------------------------------------------------
-- Antes: o app inseria em organizations e lia de volta (insert ... returning).
-- A policy de SELECT exige membership, que ainda não existe nesse momento, então
-- o bootstrap falhava por RLS. Agora a criação acontece numa única função,
-- serializada por usuário, e o cliente perde o INSERT direto nas duas tabelas.

drop policy if exists "signed in user can create own organization" on public.organizations;
drop policy if exists "creator can bootstrap own owner membership" on public.organization_members;
revoke insert on public.organizations, public.organization_members from authenticated;

create or replace function public.ensure_workspace()
returns table (workspace_id uuid, member_role text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Serializa chamadas concorrentes do mesmo usuário (evita workspaces duplicados).
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  return query
    select m.organization_id, m.role
    from public.organization_members m
    where m.user_id = v_uid
    order by m.created_at
    limit 1;
  if found then
    return;
  end if;

  insert into public.organizations (name, slug, created_by)
  values ('SMKON Workspace', 'smkon-' || substr(replace(v_uid::text, '-', ''), 1, 12), v_uid)
  returning id into v_org;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org, v_uid, 'owner');

  return query select v_org, 'owner'::text;
end;
$$;

revoke all on function public.ensure_workspace() from public, anon;
grant execute on function public.ensure_workspace() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Trilha de auditoria append-only
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid,
  actor_id uuid,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE', 'APPROVE')),
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  occurred_at timestamptz not null default now()
);

create index audit_log_org_occurred_idx on public.audit_log (organization_id, occurred_at desc);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

create policy "owners and admins read audit log"
on public.audit_log for select to authenticated
using (exists (
  select 1 from public.organization_members m
  where m.organization_id = audit_log.organization_id
    and m.user_id = (select auth.uid())
    and m.role in ('owner', 'admin')
));

-- Nenhum papel (inclusive service_role e owner) altera ou apaga registros de auditoria.
create or replace function public.reject_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end;
$$;

create trigger audit_log_append_only
before update or delete on public.audit_log
for each row execute function public.reject_mutation();

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_org text;
  v_record text;
begin
  v_org := coalesce(
    v_row ->> 'organization_id',
    case when tg_table_name = 'organizations' then v_row ->> 'id' end
  );
  v_record := coalesce(
    v_row ->> 'id',
    case when tg_table_name = 'organization_members'
      then (v_row ->> 'organization_id') || ':' || (v_row ->> 'user_id') end
  );

  insert into public.audit_log (organization_id, actor_id, action, table_name, record_id, old_data, new_data)
  values (v_org::uuid, auth.uid(), tg_op, tg_table_name, v_record, v_old, v_new);

  return null;
end;
$$;

revoke all on function public.audit_row_change() from public, anon, authenticated;

create trigger audit_organizations after insert or update or delete on public.organizations
for each row execute function public.audit_row_change();
create trigger audit_organization_members after insert or update or delete on public.organization_members
for each row execute function public.audit_row_change();
create trigger audit_source_connections after insert or update or delete on public.source_connections
for each row execute function public.audit_row_change();
create trigger audit_sales_orders after insert or update or delete on public.sales_orders
for each row execute function public.audit_row_change();
create trigger audit_affiliate_conversions after insert or update or delete on public.affiliate_conversions
for each row execute function public.audit_row_change();
create trigger audit_financial_ledger_entries after insert on public.financial_ledger_entries
for each row execute function public.audit_row_change();
create trigger audit_content_items after insert or update or delete on public.content_items
for each row execute function public.audit_row_change();
create trigger audit_products after insert or update or delete on public.products
for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- 3. Ledger financeiro imutável
-- ---------------------------------------------------------------------------
-- Lançamentos são append-only: correções entram como novos lançamentos de estorno.
-- A escrita fica restrita à ingestão server-side (service_role), a ser criada no S8.

drop policy if exists "owners and admins manage financial ledger" on public.financial_ledger_entries;
revoke insert, update, delete on public.financial_ledger_entries from authenticated;

create trigger financial_ledger_append_only
before update or delete on public.financial_ledger_entries
for each row execute function public.reject_mutation();

-- ---------------------------------------------------------------------------
-- 4. Aprovação humana da versão exata do conteúdo
-- ---------------------------------------------------------------------------

alter table public.content_items
  add column version integer not null default 1 check (version > 0),
  add column content_hash text not null default '',
  add column approved_version integer,
  add column approved_at timestamptz,
  add column approved_by uuid references auth.users(id) on delete restrict;

-- Histórico imutável de cada versão do conteúdo.
create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  version integer not null check (version > 0),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  snapshot jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (content_item_id, version)
);

-- Decisões humanas sobre uma versão específica (hash).
-- ON DELETE RESTRICT: conteúdo com aprovação registrada não pode ser apagado, só arquivado.
create table public.content_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_item_id uuid not null references public.content_items(id) on delete restrict,
  version integer not null check (version > 0),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  decision text not null check (decision in ('approved', 'rejected')),
  decided_by uuid not null references auth.users(id) on delete restrict,
  decided_at timestamptz not null default now(),
  note text check (note is null or char_length(note) <= 1000)
);

create index content_versions_item_idx on public.content_versions (content_item_id, version desc);
create index content_approvals_item_idx on public.content_approvals (content_item_id, version desc);

alter table public.content_versions enable row level security;
alter table public.content_approvals enable row level security;
revoke all on public.content_versions, public.content_approvals from anon, authenticated;
grant select on public.content_versions, public.content_approvals to authenticated;

create policy "members read content versions"
on public.content_versions for select to authenticated
using (exists (
  select 1 from public.organization_members m
  where m.organization_id = content_versions.organization_id
    and m.user_id = (select auth.uid())
));

create policy "members read content approvals"
on public.content_approvals for select to authenticated
using (exists (
  select 1 from public.organization_members m
  where m.organization_id = content_approvals.organization_id
    and m.user_id = (select auth.uid())
));

create trigger content_versions_append_only
before update or delete on public.content_versions
for each row when (pg_trigger_depth() = 0)
execute function public.reject_mutation();

create trigger content_approvals_append_only
before update or delete on public.content_approvals
for each row execute function public.reject_mutation();

-- Hash canônico (SHA-256) de tudo que será publicado.
create or replace function public.content_canonical_hash(item public.content_items)
returns text
language sql
stable
set search_path = ''
as $$
  select encode(
    sha256(convert_to(jsonb_build_array(
      item.title, item.product, item.source_url, item.asset_url, item.script,
      item.caption, item.cta, item.hashtags, to_jsonb(item.channels), item.rights_confirmed
    )::text, 'UTF8')),
    'hex'
  );
$$;

-- Versiona a cada mudança de conteúdo, invalida aprovação ao editar e impede
-- que o status "approved" seja gravado sem uma decisão registrada para a versão atual.
create or replace function public.content_items_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text := public.content_canonical_hash(new);
begin
  new.updated_at := now();

  if tg_op = 'INSERT' then
    new.version := 1;
    new.content_hash := v_hash;
  else
    -- Campos de identidade e propriedade são imutáveis.
    new.id := old.id;
    new.organization_id := old.organization_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;

    if v_hash <> old.content_hash then
      new.version := old.version + 1;
      new.content_hash := v_hash;
      -- Conteúdo alterado depois de aprovado volta para rascunho.
      if new.status = 'approved' then
        new.status := 'draft';
      end if;
    else
      new.version := old.version;
      new.content_hash := old.content_hash;
    end if;
  end if;

  if new.status = 'approved' then
    if not exists (
      select 1 from public.content_approvals a
      where a.content_item_id = new.id
        and a.version = new.version
        and a.content_hash = new.content_hash
        and a.decision = 'approved'
    ) then
      raise exception 'approval_required'
        using errcode = 'P0001', hint = 'Use approve_content() com o hash da versão atual.';
    end if;
    if tg_op = 'UPDATE' and old.status = 'approved' and old.version = new.version then
      new.approved_version := old.approved_version;
      new.approved_at := old.approved_at;
      new.approved_by := old.approved_by;
    else
      select a.version, a.decided_at, a.decided_by
        into new.approved_version, new.approved_at, new.approved_by
      from public.content_approvals a
      where a.content_item_id = new.id
        and a.version = new.version
        and a.content_hash = new.content_hash
        and a.decision = 'approved'
      order by a.decided_at desc
      limit 1;
    end if;
  else
    new.approved_version := null;
    new.approved_at := null;
    new.approved_by := null;
  end if;

  return new;
end;
$$;

-- Backfill de linhas existentes antes de ligar os triggers: hash da versão 1,
-- snapshot inicial e nenhum item aprovado sem decisão registrada.
update public.content_items c
set content_hash = public.content_canonical_hash(c),
    status = case when c.status = 'approved' then 'draft' else c.status end;

insert into public.content_versions (organization_id, content_item_id, version, content_hash, snapshot, created_by)
select c.organization_id, c.id, c.version, c.content_hash,
  jsonb_build_object(
    'title', c.title, 'product', c.product, 'source_url', c.source_url,
    'asset_url', c.asset_url, 'script', c.script, 'caption', c.caption,
    'cta', c.cta, 'hashtags', c.hashtags, 'channels', to_jsonb(c.channels),
    'rights_confirmed', c.rights_confirmed
  ),
  c.created_by
from public.content_items c;

create trigger content_items_guard
before insert or update on public.content_items
for each row execute function public.content_items_guard();

create or replace function public.content_items_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.version <> old.version then
    insert into public.content_versions (organization_id, content_item_id, version, content_hash, snapshot, created_by)
    values (
      new.organization_id, new.id, new.version, new.content_hash,
      jsonb_build_object(
        'title', new.title, 'product', new.product, 'source_url', new.source_url,
        'asset_url', new.asset_url, 'script', new.script, 'caption', new.caption,
        'cta', new.cta, 'hashtags', new.hashtags, 'channels', to_jsonb(new.channels),
        'rights_confirmed', new.rights_confirmed
      ),
      auth.uid()
    );
  end if;
  return null;
end;
$$;

create trigger content_items_snapshot
after insert or update on public.content_items
for each row execute function public.content_items_snapshot();

revoke all on function public.content_items_guard() from public, anon, authenticated;
revoke all on function public.content_items_snapshot() from public, anon, authenticated;

-- Único caminho para aprovar: confere papel, hash esperado e direitos.
create or replace function public.approve_content(
  p_content_id uuid,
  p_expected_hash text,
  p_note text default null
)
returns table (content_id uuid, approved_version integer, approved_hash text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_item public.content_items%rowtype;
  v_role text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_item from public.content_items where id = p_content_id for update;

  select m.role into v_role
  from public.organization_members m
  where m.organization_id = v_item.organization_id and m.user_id = v_uid;

  -- Conteúdo inexistente ou de outro tenant: mesma resposta, sem revelar existência.
  if v_item.id is null or v_role is null then
    raise exception 'content_not_found' using errcode = 'P0002';
  end if;
  if v_role not in ('owner', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_item.status = 'archived' then
    raise exception 'content_archived' using errcode = 'P0001';
  end if;
  if p_expected_hash is null or p_expected_hash <> v_item.content_hash then
    raise exception 'hash_mismatch' using errcode = 'P0001';
  end if;
  if v_item.source_url <> '' and not v_item.rights_confirmed then
    raise exception 'rights_required' using errcode = 'P0001';
  end if;

  -- Idempotente: a mesma versão já aprovada não gera novo registro.
  if v_item.status = 'approved' and v_item.approved_version = v_item.version then
    return query select v_item.id, v_item.version, v_item.content_hash;
    return;
  end if;

  insert into public.content_approvals (organization_id, content_item_id, version, content_hash, decision, decided_by, note)
  values (v_item.organization_id, v_item.id, v_item.version, v_item.content_hash, 'approved', v_uid, left(p_note, 1000));

  update public.content_items set status = 'approved' where id = v_item.id;

  insert into public.audit_log (organization_id, actor_id, action, table_name, record_id, new_data)
  values (
    v_item.organization_id, v_uid, 'APPROVE', 'content_items', v_item.id::text,
    jsonb_build_object('version', v_item.version, 'content_hash', v_item.content_hash)
  );

  return query select v_item.id, v_item.version, v_item.content_hash;
end;
$$;

revoke all on function public.approve_content(uuid, text, text) from public, anon;
grant execute on function public.approve_content(uuid, text, text) to authenticated;
