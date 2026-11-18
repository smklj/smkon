-- SMKON S10b: mídia no Supabase Storage e registro de licenças de uso.
-- - Bucket privado `content-media`: um diretório por workspace (`<organization_id>/<uuid>.<ext>`).
-- - Upload direto do navegador, permitido só para owner/admin no diretório do próprio workspace.
-- - Arquivos não são sobrescritos nem apagados pela API.
-- - media_assets registra o arquivo depois de conferir no Storage: dono, tipo e tamanho.
-- - media_licenses: append-only, revogação com motivo.
-- - A mídia entra no hash da versão aprovada; a fila de publicação exige mídia com licença válida.

-- ---------------------------------------------------------------------------
-- 1. Bucket e políticas do Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content-media', 'content-media', false, 52428800,
        array['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Papel do usuário no workspace dono do diretório (null = sem acesso ou nome fora do padrão).
create or replace function public.media_folder_role(p_name text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.organization_members m
  -- CASE garante que o cast só roda para nomes no padrão (AND não garante ordem de avaliação).
  where m.organization_id = case
      when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(p_name, '/', 1)::uuid
    end
    and m.user_id = auth.uid();
$$;

revoke all on function public.media_folder_role(text) from public, anon;
grant execute on function public.media_folder_role(text) to authenticated;

drop policy if exists "smkon media: members read" on storage.objects;
create policy "smkon media: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'content-media' and public.media_folder_role(name) is not null);

drop policy if exists "smkon media: editors upload" on storage.objects;
create policy "smkon media: editors upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'content-media'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp4|mov|jpg|jpeg|png|webp)$'
    and public.media_folder_role(name) in ('owner', 'admin')
  );

-- ---------------------------------------------------------------------------
-- 2. media_assets
-- ---------------------------------------------------------------------------
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  storage_path text not null unique
    check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp4|mov|jpg|jpeg|png|webp)$'),
  kind text not null check (kind in ('video', 'image')),
  mime_type text not null check (mime_type in ('video/mp4', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  original_name text not null check (char_length(original_name) between 1 and 255),
  uploaded_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid references auth.users (id) on delete restrict,
  unique (id, organization_id),
  check (split_part(storage_path, '/', 1) = organization_id::text),
  check ((archived_at is null) = (archived_by is null))
);

create index media_assets_org_idx on public.media_assets (organization_id, created_at desc);
create index media_assets_uploaded_by_idx on public.media_assets (uploaded_by);
create index media_assets_archived_by_idx on public.media_assets (archived_by);

alter table public.media_assets enable row level security;
revoke all on public.media_assets from anon, authenticated;
grant select on public.media_assets to authenticated;

create policy "members read media" on public.media_assets
  for select to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = media_assets.organization_id and m.user_id = (select auth.uid())
  ));

create trigger media_assets_no_delete before delete on public.media_assets
for each row execute function public.reject_mutation();
create trigger audit_media_assets after insert or update on public.media_assets
for each row execute function public.audit_row_change();

-- Registra um arquivo já enviado ao Storage. Idempotente por caminho.
create or replace function public.register_media_asset(p_storage_path text, p_original_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_object storage.objects%rowtype;
  v_mime text;
  v_size bigint;
  v_name text := btrim(coalesce(p_original_name, ''));
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_storage_path is null or p_storage_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp4|mov|jpg|jpeg|png|webp)$' then
    raise exception 'invalid_media_path' using errcode = 'P0001';
  end if;
  v_role := public.media_folder_role(p_storage_path);
  if v_role is null or v_role not in ('owner', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select a.id into v_id from public.media_assets a where a.storage_path = p_storage_path;
  if v_id is not null then
    return v_id;
  end if;

  select * into v_object from storage.objects o
  where o.bucket_id = 'content-media' and o.name = p_storage_path;
  if v_object.id is null then
    raise exception 'media_upload_not_found' using errcode = 'P0001';
  end if;
  if coalesce(v_object.owner_id, v_object.owner::text) is distinct from v_uid::text then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_mime := lower(coalesce(v_object.metadata ->> 'mimetype', ''));
  v_size := nullif(v_object.metadata ->> 'size', '')::bigint;
  if v_mime not in ('video/mp4', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp') then
    raise exception 'invalid_media_type' using errcode = 'P0001';
  end if;
  if v_size is null or v_size <= 0 or v_size > 52428800 then
    raise exception 'invalid_media_size' using errcode = 'P0001';
  end if;
  if char_length(v_name) < 1 then
    v_name := split_part(p_storage_path, '/', 2);
  end if;

  insert into public.media_assets (organization_id, storage_path, kind, mime_type, size_bytes, original_name, uploaded_by)
  values (split_part(p_storage_path, '/', 1)::uuid, p_storage_path,
          case when v_mime like 'video/%' then 'video' else 'image' end,
          v_mime, v_size, left(v_name, 255), v_uid)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.archive_media_asset(p_media_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_asset public.media_assets%rowtype;
  v_role text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_asset from public.media_assets a where a.id = p_media_id for update;
  v_role := case when v_asset.id is null then null else public.publication_member_role(v_asset.organization_id) end;
  if v_role is null then
    raise exception 'media_not_found' using errcode = 'P0001';
  end if;
  if v_role not in ('owner', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_asset.archived_at is null then
    update public.media_assets a set archived_at = now(), archived_by = v_uid where a.id = p_media_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. media_licenses
-- ---------------------------------------------------------------------------
create table public.media_licenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  media_asset_id uuid not null,
  license_type text not null
    check (license_type in ('own_production', 'creator_authorization', 'licensed', 'stock', 'public_domain')),
  licensor text not null check (char_length(btrim(licensor)) between 2 and 200),
  proof_url text check (proof_url is null or (char_length(proof_url) <= 2048 and proof_url ~ '^https://[^[:space:]/?#]+\.[^[:space:]]*$')),
  allows_commercial_use boolean not null,
  allows_modification boolean not null,
  territory text not null default 'Mundial' check (char_length(btrim(territory)) between 2 and 100),
  valid_from date not null default current_date,
  valid_until date,
  notes text check (notes is null or char_length(notes) <= 1000),
  recorded_by uuid not null default auth.uid() references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete restrict,
  revoke_reason text check (revoke_reason is null or char_length(revoke_reason) between 3 and 500),
  foreign key (media_asset_id, organization_id) references public.media_assets (id, organization_id) on delete restrict,
  constraint media_licenses_proof_required check (license_type = 'own_production' or proof_url is not null),
  constraint media_licenses_period check (valid_until is null or valid_until >= valid_from),
  constraint media_licenses_revoke_coherent check ((revoked_at is null) = (revoked_by is null) and (revoked_at is null) = (revoke_reason is null))
);

create index media_licenses_asset_idx on public.media_licenses (media_asset_id, created_at desc);
create index media_licenses_org_idx on public.media_licenses (organization_id);
create index media_licenses_recorded_by_idx on public.media_licenses (recorded_by);
create index media_licenses_revoked_by_idx on public.media_licenses (revoked_by);

alter table public.media_licenses enable row level security;
revoke all on public.media_licenses from anon, authenticated;
grant select on public.media_licenses to authenticated;
grant insert (organization_id, media_asset_id, license_type, licensor, proof_url, allows_commercial_use,
              allows_modification, territory, valid_from, valid_until, notes)
  on public.media_licenses to authenticated;

create policy "members read licenses" on public.media_licenses
  for select to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = media_licenses.organization_id and m.user_id = (select auth.uid())
  ));

create policy "editors record licenses" on public.media_licenses
  for insert to authenticated with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = media_licenses.organization_id and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  ));

-- Inserção com autoria real e sem revogação; depois disso só a revogação muda, uma vez.
create or replace function public.media_licenses_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'license_immutable' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.recorded_by := auth.uid();
    end if;
    new.licensor := btrim(new.licensor);
    new.created_at := now();
    new.revoked_at := null;
    new.revoked_by := null;
    new.revoke_reason := null;
    return new;
  end if;
  if old.revoked_at is not null then
    raise exception 'license_already_revoked' using errcode = 'P0001';
  end if;
  if (new.id, new.organization_id, new.media_asset_id, new.license_type, new.licensor, new.proof_url,
      new.allows_commercial_use, new.allows_modification, new.territory, new.valid_from, new.valid_until,
      new.notes, new.recorded_by, new.created_at)
     is distinct from
     (old.id, old.organization_id, old.media_asset_id, old.license_type, old.licensor, old.proof_url,
      old.allows_commercial_use, old.allows_modification, old.territory, old.valid_from, old.valid_until,
      old.notes, old.recorded_by, old.created_at) then
    raise exception 'license_immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.media_licenses_guard() from public, anon, authenticated;

create trigger media_licenses_guard before insert or update or delete on public.media_licenses
for each row execute function public.media_licenses_guard();
create trigger audit_media_licenses after insert or update on public.media_licenses
for each row execute function public.audit_row_change();

create or replace function public.revoke_media_license(p_license_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_license public.media_licenses%rowtype;
  v_role text;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_license from public.media_licenses l where l.id = p_license_id for update;
  v_role := case when v_license.id is null then null else public.publication_member_role(v_license.organization_id) end;
  if v_role is null then
    raise exception 'license_not_found' using errcode = 'P0001';
  end if;
  if v_role not in ('owner', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_license.revoked_at is not null then
    raise exception 'license_already_revoked' using errcode = 'P0001';
  end if;
  if char_length(v_reason) < 3 or char_length(v_reason) > 500 then
    raise exception 'revoke_reason_required' using errcode = 'P0001';
  end if;
  update public.media_licenses l
  set revoked_at = now(), revoked_by = v_uid, revoke_reason = v_reason
  where l.id = p_license_id;
end;
$$;

-- Licença válida para uso comercial numa data (null = nenhuma).
create or replace function public.media_active_license(p_media_id uuid, p_on date)
returns public.media_licenses
language sql
stable
set search_path = ''
as $$
  select l.* from public.media_licenses l
  where l.media_asset_id = p_media_id
    and l.revoked_at is null
    and l.allows_commercial_use
    and l.valid_from <= p_on
    and (l.valid_until is null or l.valid_until >= p_on)
  order by l.created_at desc
  limit 1;
$$;

revoke all on function public.media_active_license(uuid, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Mídia na versão do conteúdo
-- ---------------------------------------------------------------------------
alter table public.content_items
  add column media_asset_id uuid references public.media_assets (id) on delete restrict;

create index content_items_media_asset_idx on public.content_items (media_asset_id);

-- A mídia passa a fazer parte do hash: trocar o arquivo cria versão nova e exige nova aprovação.
create or replace function public.content_canonical_hash(item public.content_items)
returns text
language sql
stable
set search_path = ''
as $$
  select encode(
    sha256(convert_to(jsonb_build_array(
      item.title, item.product, item.source_url, item.asset_url, item.script,
      item.caption, item.cta, item.hashtags, to_jsonb(item.channels), item.rights_confirmed,
      item.media_asset_id
    )::text, 'UTF8')),
    'hex'
  );
$$;

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
        'rights_confirmed', new.rights_confirmed, 'media_asset_id', new.media_asset_id
      ),
      auth.uid()
    );
  end if;
  return null;
end;
$$;

-- A mídia vinculada precisa ser do mesmo workspace e não estar arquivada.
create or replace function public.content_media_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.media_asset_id is not null
     and (tg_op = 'INSERT' or new.media_asset_id is distinct from old.media_asset_id)
     and not exists (
       select 1 from public.media_assets a
       where a.id = new.media_asset_id and a.organization_id = new.organization_id and a.archived_at is null
     ) then
    raise exception 'invalid_media' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.content_media_guard() from public, anon, authenticated;

-- Roda antes do content_items_guard (ordem alfabética dos triggers BEFORE).
create trigger content_items_a_media_guard
before insert or update on public.content_items
for each row execute function public.content_media_guard();

-- ---------------------------------------------------------------------------
-- 5. Fila de publicação: mídia e licença passam a bloquear
-- ---------------------------------------------------------------------------
create or replace function public.publication_checks(p_job public.publication_jobs)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_item public.content_items%rowtype;
  v_asset public.media_assets%rowtype;
  v_license public.media_licenses%rowtype;
  v_checks jsonb := '[]'::jsonb;
  v_text text;
  v_hashtags integer;
  v_approved boolean;
  v_on date := (p_job.scheduled_for at time zone 'America/Sao_Paulo')::date;
begin
  select * into v_item from public.content_items c where c.id = p_job.content_item_id;

  v_approved := v_item.status = 'approved'
    and v_item.version = p_job.content_version
    and v_item.content_hash = p_job.content_hash
    and exists (
      select 1 from public.content_approvals a
      where a.content_item_id = v_item.id and a.version = p_job.content_version
        and a.content_hash = p_job.content_hash and a.decision = 'approved'
    );
  v_checks := v_checks || jsonb_build_object(
    'check', 'approved_version', 'severity', 'error', 'ok', v_approved,
    'detail', case when v_approved
      then format('Versão %s aprovada e inalterada.', p_job.content_version)
      else 'O conteúdo mudou ou deixou de estar aprovado depois do agendamento. Aprove a nova versão e agende de novo.' end);

  v_checks := v_checks || jsonb_build_object(
    'check', 'rights', 'severity', 'error',
    'ok', v_item.source_url = '' or v_item.rights_confirmed,
    'detail', case when v_item.source_url = '' then 'Sem vídeo de referência de terceiros.'
      when v_item.rights_confirmed then 'Direitos de uso do vídeo de referência confirmados.'
      else 'Vídeo de referência sem confirmação de direitos.' end);

  v_checks := v_checks || jsonb_build_object(
    'check', 'channel_enabled', 'severity', 'error',
    'ok', p_job.channel = any (v_item.channels),
    'detail', case when p_job.channel = any (v_item.channels)
      then format('%s está entre os canais da peça.', p_job.channel)
      else format('%s não está entre os canais da peça.', p_job.channel) end);

  v_text := btrim(concat_ws(E'\n\n', nullif(v_item.caption, ''), nullif(v_item.cta, ''), nullif(v_item.hashtags, '')));
  v_hashtags := (select count(*) from regexp_matches(v_text, '#[[:alnum:]_]+', 'g'));

  if p_job.channel = 'YouTube' then
    v_checks := v_checks || jsonb_build_object(
      'check', 'title_length', 'severity', 'error', 'ok', char_length(v_item.title) <= 100,
      'detail', format('Título com %s de 100 caracteres.', char_length(v_item.title)));
    v_checks := v_checks || jsonb_build_object(
      'check', 'text_length', 'severity', 'error', 'ok', char_length(v_text) <= 5000,
      'detail', format('Descrição com %s de 5000 caracteres.', char_length(v_text)));
  else
    v_checks := v_checks || jsonb_build_object(
      'check', 'text_length', 'severity', 'error', 'ok', char_length(v_text) <= 2200,
      'detail', format('Legenda, CTA e hashtags com %s de 2200 caracteres.', char_length(v_text)));
    if p_job.channel = 'Instagram' then
      v_checks := v_checks || jsonb_build_object(
        'check', 'hashtag_count', 'severity', 'error', 'ok', v_hashtags <= 30,
        'detail', format('%s de 30 hashtags.', v_hashtags));
    end if;
  end if;

  v_checks := v_checks || jsonb_build_object(
    'check', 'caption_present', 'severity', 'warning', 'ok', btrim(v_item.caption) <> '',
    'detail', case when btrim(v_item.caption) <> '' then 'Legenda preenchida.' else 'Legenda vazia.' end);

  if v_item.media_asset_id is not null then
    select * into v_asset from public.media_assets a where a.id = v_item.media_asset_id;
  end if;
  v_checks := v_checks || jsonb_build_object(
    'check', 'media', 'severity', 'error',
    'ok', v_asset.id is not null and v_asset.archived_at is null,
    'detail', case
      when v_asset.id is null then 'Nenhuma mídia anexada à peça.'
      when v_asset.archived_at is not null then format('A mídia %s foi arquivada.', v_asset.original_name)
      else format('Mídia anexada: %s.', v_asset.original_name) end);

  if v_asset.id is not null then
    v_license := public.media_active_license(v_asset.id, v_on);
  end if;
  v_checks := v_checks || jsonb_build_object(
    'check', 'license', 'severity', 'error',
    'ok', v_license.id is not null,
    'detail', case
      when v_asset.id is null then 'Sem mídia, sem licença.'
      when v_license.id is null then format('Nenhuma licença para uso comercial válida em %s.', to_char(v_on, 'DD/MM/YYYY'))
      else format('Licença de %s válida em %s.', v_license.licensor, to_char(v_on, 'DD/MM/YYYY')) end);

  v_checks := v_checks || jsonb_build_object(
    'check', 'schedule', 'severity', 'error', 'ok', p_job.scheduled_for > now(),
    'detail', case when p_job.scheduled_for > now() then 'Horário no futuro.' else 'O horário agendado já passou.' end);

  return v_checks;
end;
$$;

revoke all on function public.publication_checks(public.publication_jobs) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Permissões das funções
-- ---------------------------------------------------------------------------
revoke all on function public.register_media_asset(text, text) from public, anon;
revoke all on function public.archive_media_asset(uuid) from public, anon;
revoke all on function public.revoke_media_license(uuid, text) from public, anon;
grant execute on function public.register_media_asset(text, text) to authenticated;
grant execute on function public.archive_media_asset(uuid) to authenticated;
grant execute on function public.revoke_media_license(uuid, text) to authenticated;
