-- SMKON S13: infraestrutura de execução de agentes (Planner → Executor → Verifier).
-- - Toda execução é um agent_run com passos append-only (agent_steps), sempre na ordem plan → execute → verify.
-- - Limites por workspace: execuções por 24 h e passos por execução. Estourar o limite encerra a execução.
-- - Kill switch por workspace (só owner): ligado, nenhuma execução nova começa e as ativas são encerradas.
-- - Ferramentas só da allowlist do banco e liberadas pelo workspace. Não existe ferramenta de publicação:
--   nenhum agente publica nada (publicar continua exigindo aprovação humana da versão exata).
-- - Passos e encerramento são registrados só pelo executor do servidor (service_role); usuários
--   iniciam, cancelam, configuram e leem. Nenhum papel escreve direto nas tabelas.

-- ---------------------------------------------------------------------------
-- 1. Catálogo de ferramentas (allowlist global)
-- ---------------------------------------------------------------------------
create or replace function public.agent_tool_catalog()
returns table (tool text, kind text, description text)
language sql
immutable
set search_path = ''
as $$
  values
    ('read_products', 'read', 'Lê o catálogo de produtos e scores do workspace.'),
    ('read_product_evidence', 'read', 'Lê evidências de produtos e o estado de revisão.'),
    ('read_content', 'read', 'Lê conteúdos, versões e estado de aprovação.'),
    ('read_publication_queue', 'read', 'Lê a fila de publicação em dry-run e suas checagens.'),
    ('read_finance_summary', 'read', 'Lê os totais financeiros por domínio, sem dados pessoais.'),
    ('draft_content', 'draft', 'Propõe um rascunho de conteúdo. Nunca aprova nem publica.')
$$;

revoke all on function public.agent_tool_catalog() from public, anon;
grant execute on function public.agent_tool_catalog() to authenticated, service_role;

create or replace function public.agent_is_known_tool(p_tool text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (select 1 from public.agent_tool_catalog() c where c.tool = p_tool);
$$;

revoke all on function public.agent_is_known_tool(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Tabelas
-- ---------------------------------------------------------------------------
create table public.agent_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  kill_switch boolean not null default false,
  kill_reason text check (kill_reason is null or char_length(kill_reason) between 3 and 500),
  kill_changed_by uuid references auth.users (id) on delete restrict,
  kill_changed_at timestamptz,
  max_runs_per_day integer not null default 20 check (max_runs_per_day between 1 and 500),
  max_steps_per_run integer not null default 12 check (max_steps_per_run between 3 and 50),
  updated_by uuid references auth.users (id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint agent_settings_kill_reason check (not kill_switch or kill_reason is not null)
);

create index agent_settings_kill_changed_by_idx on public.agent_settings (kill_changed_by);
create index agent_settings_updated_by_idx on public.agent_settings (updated_by);

create table public.agent_tool_grants (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  tool text not null check (public.agent_is_known_tool(tool)),
  granted_by uuid not null references auth.users (id) on delete restrict,
  granted_at timestamptz not null default now(),
  primary key (organization_id, tool)
);

create index agent_tool_grants_granted_by_idx on public.agent_tool_grants (granted_by);

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  agent text not null check (agent in ('product_research', 'content_drafting', 'operations_review')),
  goal text not null check (char_length(trim(goal)) between 3 and 2000),
  status text not null default 'queued'
    check (status in ('queued', 'planning', 'executing', 'verifying', 'succeeded', 'failed', 'cancelled', 'killed')),
  max_steps integer not null check (max_steps between 3 and 50),
  step_count integer not null default 0 check (step_count >= 0),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  outcome jsonb,
  error_code text check (error_code is null or error_code ~ '^[a-z][a-z0-9_]{2,63}$'),
  cancel_reason text check (cancel_reason is null or char_length(cancel_reason) between 3 and 500),
  cancelled_by uuid references auth.users (id) on delete restrict,
  constraint agent_runs_finished_coherent
    check ((status in ('succeeded', 'failed', 'cancelled', 'killed')) = (finished_at is not null)),
  constraint agent_runs_steps_within_limit check (step_count <= max_steps)
);

create index agent_runs_org_created_idx on public.agent_runs (organization_id, created_at desc);
create index agent_runs_active_idx on public.agent_runs (organization_id)
  where status in ('queued', 'planning', 'executing', 'verifying');
create index agent_runs_created_by_idx on public.agent_runs (created_by);
create index agent_runs_cancelled_by_idx on public.agent_runs (cancelled_by);

create table public.agent_steps (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  run_id uuid not null references public.agent_runs (id) on delete restrict,
  seq integer not null check (seq > 0),
  phase text not null check (phase in ('plan', 'execute', 'verify')),
  tool text,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  status text not null check (status in ('ok', 'error', 'rejected')),
  detail text check (detail is null or char_length(detail) <= 1000),
  created_at timestamptz not null default now(),
  unique (run_id, seq),
  constraint agent_steps_tool_only_on_execute check ((phase = 'execute') = (tool is not null))
);

create index agent_steps_org_idx on public.agent_steps (organization_id, created_at desc);

create trigger agent_steps_append_only
before update or delete on public.agent_steps
for each row execute function public.reject_mutation();

create trigger agent_runs_no_delete
before delete on public.agent_runs
for each row execute function public.reject_mutation();

create trigger audit_agent_settings after insert or update on public.agent_settings
for each row execute function public.audit_row_change();
create trigger audit_agent_tool_grants after insert or delete on public.agent_tool_grants
for each row execute function public.audit_row_change();
create trigger audit_agent_runs after insert or update on public.agent_runs
for each row execute function public.audit_row_change();

-- Leitura para membros; escrita só pelas funções abaixo (inclusive para service_role).
alter table public.agent_settings enable row level security;
alter table public.agent_tool_grants enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_steps enable row level security;

revoke all on public.agent_settings, public.agent_tool_grants, public.agent_runs, public.agent_steps
  from anon, authenticated, service_role;
grant select on public.agent_settings, public.agent_tool_grants, public.agent_runs, public.agent_steps
  to authenticated, service_role;

create policy "members read agent settings" on public.agent_settings
  for select to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = agent_settings.organization_id and m.user_id = (select auth.uid())
  ));
create policy "members read agent tool grants" on public.agent_tool_grants
  for select to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = agent_tool_grants.organization_id and m.user_id = (select auth.uid())
  ));
create policy "members read agent runs" on public.agent_runs
  for select to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = agent_runs.organization_id and m.user_id = (select auth.uid())
  ));
create policy "members read agent steps" on public.agent_steps
  for select to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = agent_steps.organization_id and m.user_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- 3. Apoio
-- ---------------------------------------------------------------------------
create or replace function public.agent_member_role(p_org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.organization_members m
  where m.organization_id = p_org and m.user_id = auth.uid();
$$;

revoke all on function public.agent_member_role(uuid) from public, anon, authenticated;

-- Configuração do workspace, criada com os padrões na primeira leitura de escrita.
create or replace function public.agent_settings_for(p_org uuid)
returns public.agent_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.agent_settings%rowtype;
begin
  insert into public.agent_settings (organization_id) values (p_org)
  on conflict (organization_id) do nothing;
  select * into v from public.agent_settings s where s.organization_id = p_org for update;
  return v;
end;
$$;

revoke all on function public.agent_settings_for(uuid) from public, anon, authenticated, service_role;

create or replace function public.agent_require_role(p_org uuid, p_roles text[])
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if coalesce(public.agent_member_role(p_org), '') <> all (p_roles) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.agent_require_role(uuid, text[]) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Ações de usuários (owner/admin; kill switch e limites só owner)
-- ---------------------------------------------------------------------------
create or replace function public.agent_start_run(p_organization_id uuid, p_agent text, p_goal text, p_max_steps integer default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.agent_settings%rowtype;
  v_recent integer;
  v_max integer;
  v_id uuid;
begin
  perform public.agent_require_role(p_organization_id, array['owner', 'admin']);

  if p_agent is null or p_agent not in ('product_research', 'content_drafting', 'operations_review') then
    raise exception 'invalid_agent' using errcode = '22023';
  end if;
  if p_goal is null or char_length(trim(p_goal)) not between 3 and 2000 then
    raise exception 'invalid_goal' using errcode = '22023';
  end if;

  v_settings := public.agent_settings_for(p_organization_id);
  if v_settings.kill_switch then
    raise exception 'agents_killed' using errcode = '42501';
  end if;

  v_max := coalesce(p_max_steps, v_settings.max_steps_per_run);
  if v_max < 3 or v_max > v_settings.max_steps_per_run then
    raise exception 'invalid_max_steps' using errcode = '22023';
  end if;

  select count(*) into v_recent from public.agent_runs r
  where r.organization_id = p_organization_id and r.created_at > now() - interval '24 hours';
  if v_recent >= v_settings.max_runs_per_day then
    raise exception 'run_limit_reached' using errcode = '54000';
  end if;

  insert into public.agent_runs (organization_id, agent, goal, max_steps, created_by)
  values (p_organization_id, p_agent, trim(p_goal), v_max, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.agent_cancel_run(p_run_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.agent_runs%rowtype;
begin
  select * into v_run from public.agent_runs r where r.id = p_run_id for update;
  if not found then
    raise exception 'agent_run_not_found' using errcode = 'P0002';
  end if;
  perform public.agent_require_role(v_run.organization_id, array['owner', 'admin']);
  if p_reason is null or char_length(trim(p_reason)) not between 3 and 500 then
    raise exception 'cancel_reason_required' using errcode = '22023';
  end if;
  if v_run.status not in ('queued', 'planning', 'executing', 'verifying') then
    raise exception 'run_not_active' using errcode = '55000';
  end if;
  update public.agent_runs
  set status = 'cancelled', finished_at = now(), cancel_reason = trim(p_reason), cancelled_by = auth.uid(),
      error_code = 'cancelled'
  where id = p_run_id;
end;
$$;

create or replace function public.agent_set_kill_switch(p_organization_id uuid, p_on boolean, p_reason text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_killed integer := 0;
begin
  perform public.agent_require_role(p_organization_id, array['owner']);
  if p_on is null then
    raise exception 'invalid_kill_switch' using errcode = '22023';
  end if;
  if p_on and (p_reason is null or char_length(trim(p_reason)) not between 3 and 500) then
    raise exception 'kill_reason_required' using errcode = '22023';
  end if;

  perform public.agent_settings_for(p_organization_id);
  update public.agent_settings
  set kill_switch = p_on,
      kill_reason = case when p_on then trim(p_reason) else null end,
      kill_changed_by = auth.uid(),
      kill_changed_at = now(),
      updated_by = auth.uid(),
      updated_at = now()
  where organization_id = p_organization_id;

  if p_on then
    update public.agent_runs
    set status = 'killed', finished_at = now(), error_code = 'kill_switch'
    where organization_id = p_organization_id and status in ('queued', 'planning', 'executing', 'verifying');
    get diagnostics v_killed = row_count;
  end if;
  return v_killed;
end;
$$;

create or replace function public.agent_update_limits(p_organization_id uuid, p_max_runs_per_day integer, p_max_steps_per_run integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.agent_require_role(p_organization_id, array['owner']);
  if p_max_runs_per_day is null or p_max_runs_per_day not between 1 and 500
     or p_max_steps_per_run is null or p_max_steps_per_run not between 3 and 50 then
    raise exception 'invalid_limits' using errcode = '22023';
  end if;
  perform public.agent_settings_for(p_organization_id);
  update public.agent_settings
  set max_runs_per_day = p_max_runs_per_day, max_steps_per_run = p_max_steps_per_run,
      updated_by = auth.uid(), updated_at = now()
  where organization_id = p_organization_id;
end;
$$;

create or replace function public.agent_set_tool(p_organization_id uuid, p_tool text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.agent_require_role(p_organization_id, array['owner', 'admin']);
  if p_tool is null or not public.agent_is_known_tool(p_tool) then
    raise exception 'unknown_tool' using errcode = '22023';
  end if;
  if p_enabled then
    insert into public.agent_tool_grants (organization_id, tool, granted_by)
    values (p_organization_id, p_tool, auth.uid())
    on conflict (organization_id, tool) do nothing;
  else
    delete from public.agent_tool_grants g where g.organization_id = p_organization_id and g.tool = p_tool;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Executor do servidor (service_role): passos e encerramento
-- ---------------------------------------------------------------------------
-- Registra um passo. Ordem obrigatória: plan → execute (1..n) → verify. Um verify reprovado
-- permite voltar a executar. Ferramenta fora da allowlist ou não liberada vira passo 'rejected'
-- (fica registrado e conta no limite). Estourar o limite de passos encerra a execução como failed.
create or replace function public.agent_record_step(
  p_run_id uuid,
  p_phase text,
  p_tool text,
  p_input jsonb,
  p_output jsonb,
  p_status text,
  p_detail text default null
)
returns table (step_seq integer, run_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.agent_runs%rowtype;
  v_status text := p_status;
  v_detail text := p_detail;
  v_next_status text;
  v_seq integer;
begin
  select * into v_run from public.agent_runs r where r.id = p_run_id for update;
  if not found then
    raise exception 'agent_run_not_found' using errcode = 'P0002';
  end if;
  if v_run.status not in ('queued', 'planning', 'executing', 'verifying') then
    raise exception 'run_not_active' using errcode = '55000';
  end if;
  if p_phase is null or p_phase not in ('plan', 'execute', 'verify') then
    raise exception 'invalid_phase' using errcode = '22023';
  end if;
  if p_status is null or p_status not in ('ok', 'error') then
    raise exception 'invalid_step_status' using errcode = '22023';
  end if;
  if octet_length(coalesce(p_input, '{}'::jsonb)::text) > 65536
     or octet_length(coalesce(p_output, '{}'::jsonb)::text) > 65536 then
    raise exception 'payload_too_large' using errcode = '54000';
  end if;

  -- Ordem Planner → Executor → Verifier
  if (p_phase = 'plan' and v_run.status not in ('queued', 'planning'))
     or (p_phase = 'execute' and v_run.status not in ('planning', 'executing', 'verifying'))
     or (p_phase = 'verify' and v_run.status <> 'executing') then
    raise exception 'invalid_phase_order' using errcode = '55000';
  end if;
  if (p_phase = 'execute') <> (p_tool is not null) then
    raise exception 'invalid_phase' using errcode = '22023';
  end if;

  -- Limite de passos: encerra em vez de registrar além do permitido.
  if v_run.step_count >= v_run.max_steps then
    update public.agent_runs
    set status = 'failed', finished_at = now(), error_code = 'step_limit'
    where id = p_run_id;
    return query select null::integer, 'failed'::text;
    return;
  end if;

  -- Allowlist: ferramenta conhecida e liberada para o workspace.
  if p_phase = 'execute' and not exists (
    select 1 from public.agent_tool_grants g
    where g.organization_id = v_run.organization_id and g.tool = p_tool and public.agent_is_known_tool(p_tool)
  ) then
    v_status := 'rejected';
    v_detail := 'tool_not_allowed';
  end if;

  v_seq := v_run.step_count + 1;
  insert into public.agent_steps (organization_id, run_id, seq, phase, tool, input, output, status, detail)
  values (
    v_run.organization_id, p_run_id, v_seq, p_phase, p_tool,
    coalesce(p_input, '{}'::jsonb),
    case when v_status = 'rejected' then '{}'::jsonb else coalesce(p_output, '{}'::jsonb) end,
    v_status, v_detail
  );

  v_next_status := case p_phase when 'plan' then 'planning' when 'execute' then 'executing' else 'verifying' end;
  update public.agent_runs
  set step_count = v_seq, status = v_next_status, started_at = coalesce(started_at, now())
  where id = p_run_id;

  return query select v_seq, v_next_status;
end;
$$;

-- Sucesso só com o último passo sendo uma verificação aprovada.
create or replace function public.agent_finish_run(p_run_id uuid, p_outcome jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.agent_runs%rowtype;
  v_last public.agent_steps%rowtype;
begin
  select * into v_run from public.agent_runs r where r.id = p_run_id for update;
  if not found then
    raise exception 'agent_run_not_found' using errcode = 'P0002';
  end if;
  if v_run.status <> 'verifying' then
    raise exception 'verification_required' using errcode = '55000';
  end if;
  select * into v_last from public.agent_steps s where s.run_id = p_run_id order by s.seq desc limit 1;
  if v_last.phase <> 'verify' or v_last.status <> 'ok' then
    raise exception 'verification_required' using errcode = '55000';
  end if;
  if octet_length(coalesce(p_outcome, '{}'::jsonb)::text) > 65536 then
    raise exception 'payload_too_large' using errcode = '54000';
  end if;
  update public.agent_runs
  set status = 'succeeded', finished_at = now(), outcome = coalesce(p_outcome, '{}'::jsonb)
  where id = p_run_id;
end;
$$;

create or replace function public.agent_fail_run(p_run_id uuid, p_error_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.agent_runs%rowtype;
begin
  select * into v_run from public.agent_runs r where r.id = p_run_id for update;
  if not found then
    raise exception 'agent_run_not_found' using errcode = 'P0002';
  end if;
  if v_run.status not in ('queued', 'planning', 'executing', 'verifying') then
    raise exception 'run_not_active' using errcode = '55000';
  end if;
  if p_error_code is null or p_error_code !~ '^[a-z][a-z0-9_]{2,63}$' then
    raise exception 'invalid_error_code' using errcode = '22023';
  end if;
  update public.agent_runs set status = 'failed', finished_at = now(), error_code = p_error_code
  where id = p_run_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Permissões de execução
-- ---------------------------------------------------------------------------
revoke all on function public.agent_start_run(uuid, text, text, integer) from public, anon, service_role;
revoke all on function public.agent_cancel_run(uuid, text) from public, anon, service_role;
revoke all on function public.agent_set_kill_switch(uuid, boolean, text) from public, anon, service_role;
revoke all on function public.agent_update_limits(uuid, integer, integer) from public, anon, service_role;
revoke all on function public.agent_set_tool(uuid, text, boolean) from public, anon, service_role;
grant execute on function public.agent_start_run(uuid, text, text, integer) to authenticated;
grant execute on function public.agent_cancel_run(uuid, text) to authenticated;
grant execute on function public.agent_set_kill_switch(uuid, boolean, text) to authenticated;
grant execute on function public.agent_update_limits(uuid, integer, integer) to authenticated;
grant execute on function public.agent_set_tool(uuid, text, boolean) to authenticated;

revoke all on function public.agent_record_step(uuid, text, text, jsonb, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.agent_finish_run(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.agent_fail_run(uuid, text) from public, anon, authenticated;
grant execute on function public.agent_record_step(uuid, text, text, jsonb, jsonb, text, text) to service_role;
grant execute on function public.agent_finish_run(uuid, jsonb) to service_role;
grant execute on function public.agent_fail_run(uuid, text) to service_role;
