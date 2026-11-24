-- SMKON S24: missões de agentes (execuções recorrentes por agenda).
-- - Uma missão é um objetivo permanente de um agente com agenda própria: diária, semanal ou a cada N horas,
--   no fuso do workspace. Quando vence, o worker do servidor cria UMA execução comum na fila (agent_runs),
--   que passa por todas as barreiras do S13/S14: kill switch, limite diário, passos, allowlist e Verifier.
-- - A execução é criada em nome do responsável pela missão (quem criou ou retomou por último), que precisa
--   continuar owner/admin: quem perdeu o acesso deixa de ter missões rodando em seu nome (a missão é pausada).
-- - Sem acúmulo: a próxima execução é calculada a partir de agora, não da hora perdida, e uma missão não
--   cria execução nova enquanto a anterior ainda está ativa.
-- - Missões não publicam nada: só criam execuções, e nenhum agente tem ferramenta de publicação.
-- - Leitura para membros; escrita só pelas funções (owner/admin criam, pausam, retomam e arquivam;
--   só o worker com service_role enfileira). Sem DELETE: missão arquivada fica no histórico.
-- - Migration aditiva: tabela nova e coluna anulável em agent_runs; nenhuma linha existente muda.

-- ---------------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------------
create table public.agent_missions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 3 and 120),
  agent text not null check (agent in ('product_research', 'content_drafting', 'operations_review')),
  goal text not null check (char_length(trim(goal)) between 3 and 2000),
  max_steps integer not null check (max_steps between 3 and 50),
  schedule_kind text not null check (schedule_kind in ('daily', 'weekly', 'interval')),
  run_hour smallint check (run_hour between 0 and 23),
  run_minute smallint check (run_minute between 0 and 59),
  run_weekday smallint check (run_weekday between 0 and 6),
  interval_hours smallint check (interval_hours between 1 and 168),
  timezone text not null default 'America/Sao_Paulo' check (char_length(timezone) between 1 and 64),
  enabled boolean not null default true,
  archived_at timestamptz,
  next_run_at timestamptz,
  last_enqueued_at timestamptz,
  last_run_id uuid references public.agent_runs (id) on delete restrict,
  last_skip_reason text check (last_skip_reason is null or last_skip_reason ~ '^[a-z][a-z0-9_]{2,63}$'),
  last_skipped_at timestamptz,
  owner_id uuid not null references auth.users (id) on delete restrict,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint agent_missions_interval_coherent check ((schedule_kind = 'interval') = (interval_hours is not null)),
  constraint agent_missions_weekday_coherent check ((schedule_kind = 'weekly') = (run_weekday is not null)),
  constraint agent_missions_time_coherent
    check ((schedule_kind in ('daily', 'weekly')) = (run_hour is not null and run_minute is not null)),
  constraint agent_missions_archived_disabled check (archived_at is null or not enabled),
  constraint agent_missions_enabled_scheduled check (not enabled or next_run_at is not null)
);

create index agent_missions_org_idx on public.agent_missions (organization_id, created_at desc);
create index agent_missions_due_idx on public.agent_missions (next_run_at) where enabled;
create index agent_missions_owner_idx on public.agent_missions (owner_id);
create index agent_missions_created_by_idx on public.agent_missions (created_by);
create index agent_missions_updated_by_idx on public.agent_missions (updated_by);
create index agent_missions_last_run_idx on public.agent_missions (last_run_id);

create trigger agent_missions_no_delete
before delete on public.agent_missions
for each row execute function public.reject_mutation();

create trigger audit_agent_missions after insert or update on public.agent_missions
for each row execute function public.audit_row_change();

alter table public.agent_missions enable row level security;
revoke all on public.agent_missions from anon, authenticated, service_role;
grant select on public.agent_missions to authenticated, service_role;

create policy "members read agent missions" on public.agent_missions
  for select to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = agent_missions.organization_id and m.user_id = (select auth.uid())
  ));

-- Execução criada por uma missão aponta para ela (manual = nulo).
alter table public.agent_runs
  add column mission_id uuid references public.agent_missions (id) on delete restrict;

create index agent_runs_mission_idx on public.agent_runs (mission_id, created_at desc) where mission_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Agenda: próxima ocorrência estritamente depois de p_after, no fuso da missão
-- ---------------------------------------------------------------------------
create or replace function public.agent_mission_next_run(
  p_kind text,
  p_hour integer,
  p_minute integer,
  p_weekday integer,
  p_interval_hours integer,
  p_timezone text,
  p_after timestamptz
)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v_local timestamp := p_after at time zone p_timezone;
  v_candidate timestamp;
begin
  if p_kind = 'interval' then
    if p_interval_hours is null or p_interval_hours not between 1 and 168 then
      raise exception 'invalid_mission_schedule' using errcode = '22023';
    end if;
    return p_after + make_interval(hours => p_interval_hours);
  end if;

  if p_hour is null or p_hour not between 0 and 23 or p_minute is null or p_minute not between 0 and 59 then
    raise exception 'invalid_mission_schedule' using errcode = '22023';
  end if;

  if p_kind = 'daily' then
    v_candidate := date_trunc('day', v_local) + make_interval(hours => p_hour, mins => p_minute);
    if v_candidate <= v_local then
      v_candidate := v_candidate + interval '1 day';
    end if;
  elsif p_kind = 'weekly' then
    if p_weekday is null or p_weekday not between 0 and 6 then
      raise exception 'invalid_mission_schedule' using errcode = '22023';
    end if;
    v_candidate := date_trunc('day', v_local)
      + make_interval(days => ((p_weekday - extract(dow from v_local)::integer + 7) % 7))
      + make_interval(hours => p_hour, mins => p_minute);
    if v_candidate <= v_local then
      v_candidate := v_candidate + interval '7 days';
    end if;
  else
    raise exception 'invalid_mission_schedule' using errcode = '22023';
  end if;

  return v_candidate at time zone p_timezone;
end;
$$;

revoke all on function public.agent_mission_next_run(text, integer, integer, integer, integer, text, timestamptz)
  from public, anon;
grant execute on function public.agent_mission_next_run(text, integer, integer, integer, integer, text, timestamptz)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Ações de usuários (owner/admin)
-- ---------------------------------------------------------------------------
create or replace function public.agent_create_mission(
  p_organization_id uuid,
  p_name text,
  p_agent text,
  p_goal text,
  p_max_steps integer,
  p_schedule_kind text,
  p_run_hour integer default null,
  p_run_minute integer default null,
  p_run_weekday integer default null,
  p_interval_hours integer default null,
  p_timezone text default 'America/Sao_Paulo'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.agent_settings%rowtype;
  v_count integer;
  v_kind text := p_schedule_kind;
  v_hour integer := case when p_schedule_kind in ('daily', 'weekly') then p_run_hour end;
  v_minute integer := case when p_schedule_kind in ('daily', 'weekly') then p_run_minute end;
  v_weekday integer := case when p_schedule_kind = 'weekly' then p_run_weekday end;
  v_interval integer := case when p_schedule_kind = 'interval' then p_interval_hours end;
  v_tz text := coalesce(nullif(trim(p_timezone), ''), 'America/Sao_Paulo');
  v_id uuid;
begin
  perform public.agent_require_role(p_organization_id, array['owner', 'admin']);

  if p_name is null or char_length(trim(p_name)) not between 3 and 120 then
    raise exception 'invalid_mission_name' using errcode = '22023';
  end if;
  if p_agent is null or p_agent not in ('product_research', 'content_drafting', 'operations_review') then
    raise exception 'invalid_agent' using errcode = '22023';
  end if;
  if p_goal is null or char_length(trim(p_goal)) not between 3 and 2000 then
    raise exception 'invalid_goal' using errcode = '22023';
  end if;
  if v_kind is null or v_kind not in ('daily', 'weekly', 'interval') then
    raise exception 'invalid_mission_schedule' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = v_tz) then
    raise exception 'invalid_timezone' using errcode = '22023';
  end if;

  v_settings := public.agent_settings_for(p_organization_id);
  if p_max_steps is null or p_max_steps < 3 or p_max_steps > v_settings.max_steps_per_run then
    raise exception 'invalid_max_steps' using errcode = '22023';
  end if;

  select count(*) into v_count from public.agent_missions m
  where m.organization_id = p_organization_id and m.archived_at is null;
  if v_count >= 20 then
    raise exception 'mission_limit_reached' using errcode = '54000';
  end if;

  insert into public.agent_missions (
    organization_id, name, agent, goal, max_steps, schedule_kind, run_hour, run_minute, run_weekday,
    interval_hours, timezone, enabled, next_run_at, owner_id, created_by, updated_by
  )
  values (
    p_organization_id, trim(p_name), p_agent, trim(p_goal), p_max_steps, v_kind, v_hour, v_minute, v_weekday,
    v_interval, v_tz, true,
    public.agent_mission_next_run(v_kind, v_hour, v_minute, v_weekday, v_interval, v_tz, now()),
    auth.uid(), auth.uid(), auth.uid()
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Pausa ou retoma. Retomar recalcula a próxima execução a partir de agora (nada acumulado roda de uma vez)
-- e passa a responsabilidade para quem retomou.
create or replace function public.agent_set_mission_enabled(p_mission_id uuid, p_enabled boolean)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mission public.agent_missions%rowtype;
  v_next timestamptz;
begin
  select * into v_mission from public.agent_missions m where m.id = p_mission_id for update;
  if not found then
    raise exception 'mission_not_found' using errcode = 'P0002';
  end if;
  perform public.agent_require_role(v_mission.organization_id, array['owner', 'admin']);
  if p_enabled is null then
    raise exception 'invalid_mission_state' using errcode = '22023';
  end if;
  if v_mission.archived_at is not null then
    raise exception 'mission_archived' using errcode = '55000';
  end if;

  if p_enabled then
    v_next := public.agent_mission_next_run(
      v_mission.schedule_kind, v_mission.run_hour, v_mission.run_minute, v_mission.run_weekday,
      v_mission.interval_hours, v_mission.timezone, now()
    );
    update public.agent_missions
    set enabled = true, next_run_at = v_next, owner_id = auth.uid(), last_skip_reason = null,
        last_skipped_at = null, updated_by = auth.uid(), updated_at = now()
    where id = p_mission_id;
  else
    update public.agent_missions
    set enabled = false, next_run_at = null, updated_by = auth.uid(), updated_at = now()
    where id = p_mission_id;
  end if;
  return v_next;
end;
$$;

-- Arquiva (some da lista ativa, fica no histórico). Não cancela execução já criada.
create or replace function public.agent_archive_mission(p_mission_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mission public.agent_missions%rowtype;
begin
  select * into v_mission from public.agent_missions m where m.id = p_mission_id for update;
  if not found then
    raise exception 'mission_not_found' using errcode = 'P0002';
  end if;
  perform public.agent_require_role(v_mission.organization_id, array['owner', 'admin']);
  if v_mission.archived_at is not null then
    raise exception 'mission_archived' using errcode = '55000';
  end if;
  update public.agent_missions
  set enabled = false, next_run_at = null, archived_at = now(), updated_by = auth.uid(), updated_at = now()
  where id = p_mission_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Worker do servidor (service_role): enfileira as missões vencidas
-- ---------------------------------------------------------------------------
-- Cada missão vencida gera no máximo UMA execução por chamada. Quando não pode gerar, registra o motivo
-- (last_skip_reason) e avança a agenda, sem tentar de novo a cada disparo:
--   kill_switch · previous_run_active · run_limit_reached · max_steps_above_limit
-- Responsável que deixou de ser owner/admin → missão pausada com owner_not_allowed.
create or replace function public.agent_enqueue_due_missions(p_limit integer default 20)
returns table (mission_id uuid, run_id uuid, skip_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mission public.agent_missions%rowtype;
  v_settings public.agent_settings%rowtype;
  v_now timestamptz := clock_timestamp();
  v_next timestamptz;
  v_recent integer;
  v_reason text;
  v_run uuid;
begin
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'invalid_limit' using errcode = '22023';
  end if;

  for v_mission in
    select * from public.agent_missions m
    where m.enabled and m.next_run_at <= v_now
    order by m.next_run_at, m.id
    limit p_limit
    for update skip locked
  loop
    v_reason := null;
    v_run := null;
    v_next := public.agent_mission_next_run(
      v_mission.schedule_kind, v_mission.run_hour, v_mission.run_minute, v_mission.run_weekday,
      v_mission.interval_hours, v_mission.timezone, v_now
    );

    if not exists (
      select 1 from public.organization_members om
      where om.organization_id = v_mission.organization_id
        and om.user_id = v_mission.owner_id
        and om.role in ('owner', 'admin')
    ) then
      update public.agent_missions
      set enabled = false, next_run_at = null, last_skip_reason = 'owner_not_allowed', last_skipped_at = v_now,
          updated_at = v_now
      where id = v_mission.id;
      mission_id := v_mission.id; run_id := null; skip_reason := 'owner_not_allowed';
      return next;
      continue;
    end if;

    v_settings := public.agent_settings_for(v_mission.organization_id);

    if v_settings.kill_switch then
      v_reason := 'kill_switch';
    elsif v_mission.last_run_id is not null and exists (
      select 1 from public.agent_runs r
      where r.id = v_mission.last_run_id and r.status in ('queued', 'planning', 'executing', 'verifying')
    ) then
      v_reason := 'previous_run_active';
    elsif v_mission.max_steps > v_settings.max_steps_per_run then
      v_reason := 'max_steps_above_limit';
    else
      select count(*) into v_recent from public.agent_runs r
      where r.organization_id = v_mission.organization_id and r.created_at > v_now - interval '24 hours';
      if v_recent >= v_settings.max_runs_per_day then
        v_reason := 'run_limit_reached';
      end if;
    end if;

    if v_reason is null then
      insert into public.agent_runs (organization_id, agent, goal, max_steps, created_by, mission_id)
      values (v_mission.organization_id, v_mission.agent, v_mission.goal, v_mission.max_steps, v_mission.owner_id, v_mission.id)
      returning id into v_run;
      update public.agent_missions
      set next_run_at = v_next, last_enqueued_at = v_now, last_run_id = v_run, last_skip_reason = null,
          last_skipped_at = null, updated_at = v_now
      where id = v_mission.id;
    else
      update public.agent_missions
      set next_run_at = v_next, last_skip_reason = v_reason, last_skipped_at = v_now, updated_at = v_now
      where id = v_mission.id;
    end if;

    mission_id := v_mission.id; run_id := v_run; skip_reason := v_reason;
    return next;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Privilégios
-- ---------------------------------------------------------------------------
revoke all on function public.agent_create_mission(uuid, text, text, text, integer, text, integer, integer, integer, integer, text)
  from public, anon;
revoke all on function public.agent_set_mission_enabled(uuid, boolean) from public, anon;
revoke all on function public.agent_archive_mission(uuid) from public, anon;
grant execute on function public.agent_create_mission(uuid, text, text, text, integer, text, integer, integer, integer, integer, text)
  to authenticated;
grant execute on function public.agent_set_mission_enabled(uuid, boolean) to authenticated;
grant execute on function public.agent_archive_mission(uuid) to authenticated;

revoke all on function public.agent_enqueue_due_missions(integer) from public, anon, authenticated;
grant execute on function public.agent_enqueue_due_missions(integer) to service_role;
