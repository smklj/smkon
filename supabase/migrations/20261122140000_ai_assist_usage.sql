-- SMKON: IA assistiva nos módulos (Gemini pelo Vercel AI Gateway).
--
-- - ai_assist_usage: uma linha por chamada feita a partir da interface (Studio, compliance, produtos,
--   financeiro, audiência, visão geral), com tokens e custo estimado em USD. Só inclusão: ninguém altera
--   nem apaga (gatilho), exceto a cascata ao apagar o workspace.
-- - ai_assist_record_usage(): grava com a sessão do usuário; exige membro com papel owner, admin ou analyst.
-- - ai_assist_spend_since(): gasto do WORKSPACE desde uma data, somando assistente e agentes. Só membros.
-- - rate_limit_consume ganha o escopo ai_assist (60 chamadas por hora por usuário).
-- Migration aditiva: tabelas e funções novas; rate_limit_consume é recriada com o mesmo contrato.

create table public.ai_assist_usage (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete restrict,
  feature text not null check (feature in (
    'studio_write', 'compliance_review', 'product_brief', 'finance_explain', 'audience_reply', 'overview_brief'
  )),
  model text not null check (model ~ '^[a-z0-9][a-z0-9._-]{0,63}/[a-z0-9][a-z0-9._:-]{0,127}$'),
  input_tokens integer not null check (input_tokens between 0 and 10000000),
  output_tokens integer not null check (output_tokens between 0 and 10000000),
  cost_usd numeric(12, 6) not null check (cost_usd >= 0 and cost_usd < 1000),
  created_at timestamptz not null default now()
);

create index ai_assist_usage_org_created_idx on public.ai_assist_usage (organization_id, created_at desc);
create index ai_assist_usage_user_idx on public.ai_assist_usage (user_id);

alter table public.ai_assist_usage enable row level security;
revoke all on public.ai_assist_usage from anon, authenticated, service_role;
grant select on public.ai_assist_usage to authenticated, service_role;

create policy "members read ai assist usage" on public.ai_assist_usage
  for select to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = ai_assist_usage.organization_id and m.user_id = (select auth.uid())
  ));

create or replace function public.ai_assist_usage_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' or pg_trigger_depth() = 1 then
    raise exception 'usage_immutable' using errcode = '42501';
  end if;
  return old;
end;
$$;

revoke all on function public.ai_assist_usage_guard() from public, anon, authenticated;

create trigger ai_assist_usage_guard
before update or delete on public.ai_assist_usage
for each row execute function public.ai_assist_usage_guard();

-- ---------------------------------------------------------------------------
-- Registro de consumo (interface, sessão do usuário)
-- ---------------------------------------------------------------------------
create or replace function public.ai_assist_record_usage(
  p_organization_id uuid,
  p_feature text,
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
  v_uid uuid := auth.uid();
  v_role text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select m.role into v_role from public.organization_members m
  where m.organization_id = p_organization_id and m.user_id = v_uid;
  if v_role is null or v_role not in ('owner', 'admin', 'analyst') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_feature is null or p_feature not in (
    'studio_write', 'compliance_review', 'product_brief', 'finance_explain', 'audience_reply', 'overview_brief'
  ) then
    raise exception 'invalid_feature' using errcode = '22023';
  end if;
  if p_model is null or p_model !~ '^[a-z0-9][a-z0-9._-]{0,63}/[a-z0-9][a-z0-9._:-]{0,127}$' then
    raise exception 'invalid_model' using errcode = '22023';
  end if;
  if p_input_tokens is null or p_output_tokens is null or p_cost_usd is null
     or p_input_tokens not between 0 and 10000000 or p_output_tokens not between 0 and 10000000
     or p_cost_usd < 0 or p_cost_usd >= 1000 then
    raise exception 'invalid_usage' using errcode = '22023';
  end if;

  insert into public.ai_assist_usage (organization_id, user_id, feature, model, input_tokens, output_tokens, cost_usd)
  values (p_organization_id, v_uid, p_feature, p_model, p_input_tokens, p_output_tokens, round(p_cost_usd, 6));
end;
$$;

-- Gasto do workspace (assistente + agentes) desde uma data. Só membros do workspace.
create or replace function public.ai_assist_spend_since(p_organization_id uuid, p_since timestamptz)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.organization_members m
    where m.organization_id = p_organization_id and m.user_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return (
    select coalesce(sum(u.cost_usd), 0) from public.ai_assist_usage u
    where u.organization_id = p_organization_id and u.created_at >= p_since
  ) + (
    select coalesce(sum(a.cost_usd), 0) from public.agent_model_usage a
    where a.organization_id = p_organization_id and a.created_at >= p_since
  );
end;
$$;

revoke all on function public.ai_assist_record_usage(uuid, text, text, integer, integer, numeric) from public, anon;
revoke all on function public.ai_assist_spend_since(uuid, timestamptz) from public, anon;
grant execute on function public.ai_assist_record_usage(uuid, text, text, integer, integer, numeric) to authenticated;
grant execute on function public.ai_assist_spend_since(uuid, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- Limite de chamadas: escopo ai_assist (60 por hora por usuário). Mesmo contrato de 20261122120000.
-- ---------------------------------------------------------------------------
create or replace function public.rate_limit_consume(p_scope text, p_subject text default null)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_scope in ('login_ip', 'login_email') then
    raise exception 'login_scope_server_only' using errcode = '42501';
  end if;
  if p_scope not in ('invite_create', 'invite_accept', 'ai_assist') then
    raise exception 'invalid_rate_limit_scope' using errcode = 'P0001';
  end if;
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  return query select * from public.rate_limit_hit(
    p_scope,
    auth.uid()::text,
    case p_scope when 'invite_create' then 30 when 'ai_assist' then 60 else 20 end,
    3600
  );
end;
$$;

revoke all on function public.rate_limit_consume(text, text) from public, anon;
grant execute on function public.rate_limit_consume(text, text) to authenticated;
