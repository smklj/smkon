-- SMKON S14 etapa 7: consumo do modelo de IA dos agentes e teto de gasto.
-- - agent_model_usage: uma linha por chamada ao modelo (plano ou resumo), com tokens e custo estimado em USD.
--   Só o executor do servidor grava (agent_record_model_usage, service_role); membros do workspace leem.
--   Linhas não são alteradas nem apagadas por ninguém (gatilho), exceto pela cascata ao apagar o workspace.
-- - agent_model_spend_since(): gasto somado de TODOS os workspaces desde uma data. A conta do provedor é do
--   ambiente (projeto Vercel), então o teto mensal (AGENT_MONTHLY_BUDGET_USD) vale para o ambiente inteiro.
-- - O custo é registrado mesmo se a execução já tiver sido encerrada (kill switch no meio da chamada): o
--   dinheiro foi gasto e precisa contar no teto.
-- - Migration aditiva: tabela nova, nenhuma linha existente muda.

create table public.agent_model_usage (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.agent_runs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  phase text not null check (phase in ('plan', 'verify')),
  model text not null check (model ~ '^[a-z0-9][a-z0-9._-]{0,63}/[a-z0-9][a-z0-9._:-]{0,127}$'),
  input_tokens integer not null check (input_tokens between 0 and 10000000),
  output_tokens integer not null check (output_tokens between 0 and 10000000),
  cost_usd numeric(12, 6) not null check (cost_usd >= 0 and cost_usd < 1000),
  created_at timestamptz not null default now()
);

create index agent_model_usage_created_idx on public.agent_model_usage (created_at);
create index agent_model_usage_org_created_idx on public.agent_model_usage (organization_id, created_at desc);
create index agent_model_usage_run_idx on public.agent_model_usage (run_id);

alter table public.agent_model_usage enable row level security;
revoke all on public.agent_model_usage from anon, authenticated, service_role;
grant select on public.agent_model_usage to authenticated, service_role;

create policy "members read agent model usage" on public.agent_model_usage
  for select to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = agent_model_usage.organization_id and m.user_id = (select auth.uid())
  ));

-- Registro só de inclusão: nem o service_role altera ou apaga uma linha. O gatilho só barra apagamento direto
-- (profundidade 1); uma cascata por FK não é barrada aqui (hoje agent_runs já é só de inclusão).
create or replace function public.agent_model_usage_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'usage_immutable' using errcode = '42501';
  end if;
  if pg_trigger_depth() = 1 then
    raise exception 'usage_immutable' using errcode = '42501';
  end if;
  return old;
end;
$$;

revoke all on function public.agent_model_usage_guard() from public, anon, authenticated;

create trigger agent_model_usage_guard
before update or delete on public.agent_model_usage
for each row execute function public.agent_model_usage_guard();

-- ---------------------------------------------------------------------------
-- Registro de consumo (executor do servidor)
-- ---------------------------------------------------------------------------
create or replace function public.agent_record_model_usage(
  p_run_id uuid,
  p_phase text,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cost_usd numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select r.organization_id into v_org from public.agent_runs r where r.id = p_run_id;
  if v_org is null then
    raise exception 'agent_run_not_found' using errcode = 'P0002';
  end if;
  if p_phase is null or p_phase not in ('plan', 'verify') then
    raise exception 'invalid_phase' using errcode = '22023';
  end if;
  if p_model is null or p_model !~ '^[a-z0-9][a-z0-9._-]{0,63}/[a-z0-9][a-z0-9._:-]{0,127}$' then
    raise exception 'invalid_model' using errcode = '22023';
  end if;
  if p_input_tokens is null or p_output_tokens is null or p_cost_usd is null
     or p_input_tokens not between 0 and 10000000 or p_output_tokens not between 0 and 10000000
     or p_cost_usd < 0 or p_cost_usd >= 1000 then
    raise exception 'invalid_usage' using errcode = '22023';
  end if;

  insert into public.agent_model_usage (run_id, organization_id, phase, model, input_tokens, output_tokens, cost_usd)
  values (p_run_id, v_org, p_phase, p_model, p_input_tokens, p_output_tokens, round(p_cost_usd, 6));
end;
$$;

create or replace function public.agent_model_spend_since(p_since timestamptz)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(u.cost_usd), 0)::numeric from public.agent_model_usage u where u.created_at >= p_since;
$$;

revoke all on function public.agent_record_model_usage(uuid, text, text, integer, integer, numeric) from public, anon, authenticated;
revoke all on function public.agent_model_spend_since(timestamptz) from public, anon, authenticated;
grant execute on function public.agent_record_model_usage(uuid, text, text, integer, integer, numeric) to service_role;
grant execute on function public.agent_model_spend_since(timestamptz) to service_role;
