-- S16 · EXPLAIN ANALYZE da lista de execuções de /agentes (src/lib/agents/server.ts),
-- antes (limit 20 por created_at) e com cursor (created_at desc, id desc), sob RLS.
\set ON_ERROR_STOP on
\pset pager off
\set org '''10000000-0000-4000-8000-000000000001'''
select created_at as a_crt, id as a_id from public.agent_runs
where organization_id = :org order by created_at desc, id desc offset 15000 limit 1 \gset
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true) \g /dev/null

\echo '### A0 execuções — consulta atual (20 mais recentes, sem desempate)'
explain (analyze, buffers, costs off, summary on)
select id,agent,goal,status,max_steps,step_count,created_at,finished_at,error_code,cancel_reason
from public.agent_runs where organization_id = :org order by created_at desc limit 20;

\echo '### A1 execuções — primeira página com cursor (21 = 20 + 1)'
explain (analyze, buffers, costs off, summary on)
select id,agent,goal,status,max_steps,step_count,created_at,finished_at,error_code,cancel_reason
from public.agent_runs where organization_id = :org order by created_at desc, id desc limit 21;

\echo '### A2 execuções — página funda (cursor na linha 15 000)'
explain (analyze, buffers, costs off, summary on)
select id,agent,goal,status,max_steps,step_count,created_at,finished_at,error_code,cancel_reason
from public.agent_runs where organization_id = :org
  and created_at <= :'a_crt'
  and (created_at < :'a_crt' or (created_at = :'a_crt' and id < :'a_id'))
order by created_at desc, id desc limit 21;

\echo '### A3 passos das 20 execuções da página'
select array_agg(id) as ids from (select id from public.agent_runs where organization_id = :org
  order by created_at desc, id desc limit 20) x \gset
explain (analyze, buffers, costs off, summary on)
select run_id,seq,phase,tool,status,detail,created_at from public.agent_steps
where run_id = any(:'ids'::uuid[]) order by seq limit 1000;

\echo '### A4 contagem das últimas 24 h'
explain (analyze, buffers, costs off, summary on)
select count(*) from public.agent_runs where organization_id = :org and created_at > now() - interval '24 hours';
rollback;
