-- SMKON S10a: calendário editorial e fila de publicação em DRY-RUN.
-- - Só agenda conteúdo aprovado, fixando a versão e o hash aprovados.
-- - O dry-run (Verifier) confere tudo que uma publicação real exigiria, sem chamar nenhuma API externa.
-- - mode é sempre 'dry_run' nesta fase: não existe caminho para publicar de verdade.
-- - Toda mudança de estado gera evento append-only.

create table public.publication_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  content_item_id uuid not null references public.content_items (id) on delete restrict,
  content_version integer not null check (content_version > 0),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  channel text not null check (channel in ('YouTube', 'Instagram', 'TikTok')),
  scheduled_for timestamptz not null,
  mode text not null default 'dry_run' check (mode = 'dry_run'),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'dry_run_passed', 'dry_run_failed', 'cancelled')),
  checks jsonb not null default '[]'::jsonb,
  last_run_at timestamptz,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  cancelled_by uuid references auth.users (id) on delete restrict,
  cancelled_at timestamptz,
  cancel_reason text check (cancel_reason is null or char_length(cancel_reason) between 3 and 500),
  constraint publication_jobs_cancel_coherent check ((status = 'cancelled') = (cancelled_at is not null))
);

-- Mesmo conteúdo, canal e horário não entram duas vezes na fila ativa.
create unique index publication_jobs_active_uidx
  on public.publication_jobs (content_item_id, channel, scheduled_for)
  where status <> 'cancelled';
create index publication_jobs_org_schedule_idx on public.publication_jobs (organization_id, scheduled_for);
create index publication_jobs_created_by_idx on public.publication_jobs (created_by);
create index publication_jobs_cancelled_by_idx on public.publication_jobs (cancelled_by);

create table public.publication_job_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null references public.publication_jobs (id) on delete restrict,
  event text not null check (event in ('scheduled', 'dry_run_passed', 'dry_run_failed', 'cancelled')),
  detail jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users (id) on delete restrict,
  occurred_at timestamptz not null default now()
);

create index publication_job_events_job_idx on public.publication_job_events (job_id, occurred_at desc);
create index publication_job_events_org_idx on public.publication_job_events (organization_id, occurred_at desc);
create index publication_job_events_actor_idx on public.publication_job_events (actor_id);

create trigger publication_job_events_append_only
before update or delete on public.publication_job_events
for each row execute function public.reject_mutation();

-- Jobs não são apagados: cancelados ficam no histórico.
create trigger publication_jobs_no_delete
before delete on public.publication_jobs
for each row execute function public.reject_mutation();

create trigger audit_publication_jobs after insert or update on public.publication_jobs
for each row execute function public.audit_row_change();

alter table public.publication_jobs enable row level security;
alter table public.publication_job_events enable row level security;
revoke all on public.publication_jobs, public.publication_job_events from anon, authenticated;
grant select on public.publication_jobs, public.publication_job_events to authenticated;

create policy "members read publication jobs" on public.publication_jobs
  for select to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = publication_jobs.organization_id and m.user_id = (select auth.uid())
  ));

create policy "members read publication job events" on public.publication_job_events
  for select to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = publication_job_events.organization_id and m.user_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- Papel do usuário no workspace do conteúdo (null = não é membro).
-- ---------------------------------------------------------------------------
create or replace function public.publication_member_role(p_org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.organization_members m
  where m.organization_id = p_org and m.user_id = auth.uid();
$$;

revoke all on function public.publication_member_role(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Verifier: checagens que uma publicação real exigiria. Sem efeitos colaterais.
-- severity 'error' bloqueia; 'warning' informa.
-- ---------------------------------------------------------------------------
create or replace function public.publication_checks(p_job public.publication_jobs)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_item public.content_items%rowtype;
  v_checks jsonb := '[]'::jsonb;
  v_text text;
  v_hashtags integer;
  v_approved boolean;
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

  v_checks := v_checks || jsonb_build_object(
    'check', 'media', 'severity', 'warning', 'ok', false,
    'detail', 'Arquivo de mídia ainda não é anexado ao conteúdo (chega no S10b). A publicação real vai exigir.');

  v_checks := v_checks || jsonb_build_object(
    'check', 'schedule', 'severity', 'error', 'ok', p_job.scheduled_for > now(),
    'detail', case when p_job.scheduled_for > now() then 'Horário no futuro.' else 'O horário agendado já passou.' end);

  return v_checks;
end;
$$;

revoke all on function public.publication_checks(public.publication_jobs) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Agendar
-- ---------------------------------------------------------------------------
create or replace function public.schedule_publication(p_content_id uuid, p_channel text, p_scheduled_for timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_item public.content_items%rowtype;
  v_role text;
  v_job_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_item from public.content_items c where c.id = p_content_id for update;
  v_role := case when v_item.id is null then null else public.publication_member_role(v_item.organization_id) end;
  if v_role is null then
    raise exception 'content_not_found' using errcode = 'P0001';
  end if;
  if v_role not in ('owner', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_item.status <> 'approved' or v_item.approved_version is distinct from v_item.version or not exists (
    select 1 from public.content_approvals a
    where a.content_item_id = v_item.id and a.version = v_item.version
      and a.content_hash = v_item.content_hash and a.decision = 'approved'
  ) then
    raise exception 'approval_required' using errcode = 'P0001';
  end if;
  if p_channel is null or not (p_channel = any (v_item.channels)) then
    raise exception 'invalid_channel' using errcode = 'P0001';
  end if;
  if p_scheduled_for is null or p_scheduled_for <= now() + interval '1 minute'
     or p_scheduled_for > now() + interval '365 days' then
    raise exception 'invalid_schedule' using errcode = 'P0001';
  end if;

  insert into public.publication_jobs (organization_id, content_item_id, content_version, content_hash, channel, scheduled_for, created_by)
  values (v_item.organization_id, v_item.id, v_item.version, v_item.content_hash, p_channel, p_scheduled_for, v_uid)
  returning id into v_job_id;

  insert into public.publication_job_events (organization_id, job_id, event, detail, actor_id)
  values (v_item.organization_id, v_job_id, 'scheduled',
          jsonb_build_object('channel', p_channel, 'scheduled_for', p_scheduled_for, 'version', v_item.version), v_uid);

  return v_job_id;
exception
  when unique_violation then
    raise exception 'already_scheduled' using errcode = 'P0001';
end;
$$;

-- ---------------------------------------------------------------------------
-- Dry-run (Verifier). Nunca publica.
-- ---------------------------------------------------------------------------
create or replace function public.run_publication_dry_run(p_job_id uuid)
returns table (job_status text, checks jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_job public.publication_jobs%rowtype;
  v_role text;
  v_checks jsonb;
  v_status text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_job from public.publication_jobs j where j.id = p_job_id for update;
  v_role := case when v_job.id is null then null else public.publication_member_role(v_job.organization_id) end;
  if v_role is null then
    raise exception 'publication_not_found' using errcode = 'P0001';
  end if;
  if v_role not in ('owner', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_job.status = 'cancelled' then
    raise exception 'publication_cancelled' using errcode = 'P0001';
  end if;

  v_checks := public.publication_checks(v_job);
  v_status := case when exists (
    select 1 from jsonb_array_elements(v_checks) c
    where c ->> 'severity' = 'error' and (c ->> 'ok')::boolean = false
  ) then 'dry_run_failed' else 'dry_run_passed' end;

  update public.publication_jobs j
  set status = v_status, checks = v_checks, last_run_at = now()
  where j.id = p_job_id;

  insert into public.publication_job_events (organization_id, job_id, event, detail, actor_id)
  values (v_job.organization_id, p_job_id, v_status, jsonb_build_object('checks', v_checks), v_uid);

  return query select v_status, v_checks;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancelar (com motivo)
-- ---------------------------------------------------------------------------
create or replace function public.cancel_publication(p_job_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_job public.publication_jobs%rowtype;
  v_role text;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_job from public.publication_jobs j where j.id = p_job_id for update;
  v_role := case when v_job.id is null then null else public.publication_member_role(v_job.organization_id) end;
  if v_role is null then
    raise exception 'publication_not_found' using errcode = 'P0001';
  end if;
  if v_role not in ('owner', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_job.status = 'cancelled' then
    raise exception 'publication_cancelled' using errcode = 'P0001';
  end if;
  if char_length(v_reason) < 3 or char_length(v_reason) > 500 then
    raise exception 'cancel_reason_required' using errcode = 'P0001';
  end if;

  update public.publication_jobs j
  set status = 'cancelled', cancelled_by = v_uid, cancelled_at = now(), cancel_reason = v_reason
  where j.id = p_job_id;

  insert into public.publication_job_events (organization_id, job_id, event, detail, actor_id)
  values (v_job.organization_id, p_job_id, 'cancelled', jsonb_build_object('reason', v_reason), v_uid);
end;
$$;

revoke all on function public.schedule_publication(uuid, text, timestamptz) from public, anon;
revoke all on function public.run_publication_dry_run(uuid) from public, anon;
revoke all on function public.cancel_publication(uuid, text) from public, anon;
grant execute on function public.schedule_publication(uuid, text, timestamptz) to authenticated;
grant execute on function public.run_publication_dry_run(uuid) to authenticated;
grant execute on function public.cancel_publication(uuid, text) to authenticated;
