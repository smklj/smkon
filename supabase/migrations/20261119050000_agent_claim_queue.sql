-- SMKON S14 etapa 5: reserva da fila de execuções de agentes pelo worker do servidor.
-- - agent_claim_next_run(): reserva UMA execução 'queued' por chamada (a mais antiga), com
--   FOR UPDATE SKIP LOCKED: dois workers simultâneos nunca recebem a mesma execução.
-- - No máximo uma execução ativa por workspace: a reserva usa um advisory lock transacional por
--   workspace e não reserva se o workspace já tem execução em planning/executing/verifying.
-- - A reserva move queued → planning e grava claimed_at (lease). O banco segue sendo a fronteira de
--   confiança: o contexto devolvido (workspace, autor, limite, ferramentas liberadas) vem das tabelas,
--   nunca do modelo nem do worker.
-- - Na reserva, execução cujo workspace está com kill switch ligado vira 'killed' (kill_switch) e
--   execução cujo autor deixou de ser owner/admin vira 'failed' (run_owner_not_allowed): nada roda em
--   nome de quem perdeu o acesso.
-- - agent_reap_stale_runs(): execução ativa sem atividade (último passo, reserva ou início) há mais que o
--   lease vira 'failed' com worker_timeout. Linhas travadas por um worker em andamento são puladas.
-- - Só service_role. Migration aditiva: coluna nova anulável, nenhuma linha existente muda.

-- ---------------------------------------------------------------------------
-- 1. Lease da reserva
-- ---------------------------------------------------------------------------
alter table public.agent_runs
  add column claimed_at timestamptz;

-- Execução na fila nunca está reservada. Linhas existentes têm claimed_at nulo, então a regra vale já.
alter table public.agent_runs
  add constraint agent_runs_claim_coherent check (status <> 'queued' or claimed_at is null);

create index agent_runs_queued_idx on public.agent_runs (created_at, id) where status = 'queued';

-- ---------------------------------------------------------------------------
-- 2. Reserva da próxima execução
-- ---------------------------------------------------------------------------
create or replace function public.agent_claim_next_run()
returns table (
  run_id uuid,
  organization_id uuid,
  agent text,
  goal text,
  max_steps integer,
  step_count integer,
  created_by uuid,
  granted_tools text[],
  claimed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next record;
  v_candidate record;
  v_now timestamptz := clock_timestamp();
begin
  -- Candidatas em ordem de chegada, lidas sem trava; cada uma só é travada depois de passar pela
  -- trava do workspace, para não segurar linhas que outro worker poderia reservar.
  -- O limite evita varrer a fila inteira numa chamada; o restante fica para a próxima.
  for v_next in
    select r.id, r.organization_id
    from public.agent_runs r
    where r.status = 'queued'
    order by r.created_at, r.id
    limit 50
  loop
    -- Um worker por workspace de cada vez: outro worker reservando no mesmo workspace → pula.
    if not pg_try_advisory_xact_lock(hashtextextended('agent_claim:' || v_next.organization_id::text, 0)) then
      continue;
    end if;

    -- Já existe execução ativa neste workspace: espera ela terminar (sem travar a candidata).
    if exists (
      select 1 from public.agent_runs a
      where a.organization_id = v_next.organization_id
        and a.status in ('planning', 'executing', 'verifying')
    ) then
      continue;
    end if;

    -- Trava só esta linha; se outro processo a travou ou ela saiu da fila (cancelada), pula.
    select r.id, r.organization_id, r.created_by into v_candidate
    from public.agent_runs r
    where r.id = v_next.id and r.status = 'queued'
    for update skip locked;
    if not found then
      continue;
    end if;

    if exists (
      select 1 from public.agent_settings s
      where s.organization_id = v_candidate.organization_id and s.kill_switch
    ) then
      update public.agent_runs
      set status = 'killed', finished_at = v_now, error_code = 'kill_switch'
      where id = v_candidate.id;
      continue;
    end if;

    if not exists (
      select 1 from public.organization_members m
      where m.organization_id = v_candidate.organization_id
        and m.user_id = v_candidate.created_by
        and m.role in ('owner', 'admin')
    ) then
      update public.agent_runs
      set status = 'failed', finished_at = v_now, error_code = 'run_owner_not_allowed'
      where id = v_candidate.id;
      continue;
    end if;

    update public.agent_runs
    set status = 'planning', claimed_at = v_now, started_at = coalesce(started_at, v_now)
    where id = v_candidate.id;

    return query
      select r.id, r.organization_id, r.agent, r.goal, r.max_steps, r.step_count, r.created_by,
             coalesce(array(
               select g.tool from public.agent_tool_grants g
               where g.organization_id = r.organization_id and public.agent_is_known_tool(g.tool)
               order by g.tool
             ), array[]::text[]),
             r.claimed_at
      from public.agent_runs r
      where r.id = v_candidate.id;
    return;
  end loop;
  -- Fila vazia (ou tudo travado/ocupado): nenhuma linha.
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Execuções presas além do lease
-- ---------------------------------------------------------------------------
create or replace function public.agent_reap_stale_runs(p_lease_seconds integer default 600)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_now timestamptz := clock_timestamp();
begin
  if p_lease_seconds is null or p_lease_seconds not between 60 and 3600 then
    raise exception 'invalid_lease' using errcode = '22023';
  end if;

  update public.agent_runs r
  set status = 'failed', finished_at = v_now, error_code = 'worker_timeout'
  where r.id in (
    select a.id from public.agent_runs a
    where a.status in ('planning', 'executing', 'verifying')
      and greatest(
            (select max(s.created_at) from public.agent_steps s where s.run_id = a.id),
            a.claimed_at, a.started_at, a.created_at
          ) < v_now - make_interval(secs => p_lease_seconds)
    for update of a skip locked
  );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Permissões: só o executor do servidor
-- ---------------------------------------------------------------------------
revoke all on function public.agent_claim_next_run() from public, anon, authenticated;
revoke all on function public.agent_reap_stale_runs(integer) from public, anon, authenticated;
grant execute on function public.agent_claim_next_run() to service_role;
grant execute on function public.agent_reap_stale_runs(integer) to service_role;
