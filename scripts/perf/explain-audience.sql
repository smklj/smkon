-- S16 · EXPLAIN ANALYZE das consultas de /audiencia (src/lib/audience/server.ts), sob RLS,
-- antes (limit 100 por created_at, sem desempate) e com cursor (created_at desc, id desc).
-- Banco: scripts/perf/bench-db.sh (30 mil contatos no workspace alvo, 5% anonimizados).
\set ON_ERROR_STOP on
\pset pager off
\set org '''10000000-0000-4000-8000-000000000001'''
select created_at as c_crt, id as c_id from public.contacts
where organization_id = :org and anonymized_at is null order by created_at desc, id desc offset 15000 limit 1 \gset
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true) \g /dev/null

\echo '### C0 contatos — consulta anterior (100 mais recentes, sem desempate)'
explain (analyze, buffers, costs off, summary on)
select id,display_name,email,phone,source,source_detail,purpose,legal_basis,created_at,updated_at,last_activity_at,anonymized_at
from public.contacts where organization_id = :org and anonymized_at is null order by created_at desc limit 100;

\echo '### C1 contatos — primeira página com cursor (51 = 50 + 1)'
explain (analyze, buffers, costs off, summary on)
select id,display_name,email,phone,source,source_detail,purpose,legal_basis,created_at,updated_at,last_activity_at,anonymized_at
from public.contacts where organization_id = :org and anonymized_at is null order by created_at desc, id desc limit 51;

\echo '### C2 contatos — página funda (cursor na linha 15 000)'
explain (analyze, buffers, costs off, summary on)
select id,display_name,email,phone,source,source_detail,purpose,legal_basis,created_at,updated_at,last_activity_at,anonymized_at
from public.contacts where organization_id = :org and anonymized_at is null
  and created_at <= :'c_crt'
  and (created_at < :'c_crt' or (created_at = :'c_crt' and id < :'c_id'))
order by created_at desc, id desc limit 51;

\echo '### C3 busca comum (casa com muitas linhas), 1ª página'
explain (analyze, buffers, costs off, summary on)
select id from public.contacts where organization_id = :org and anonymized_at is null
  and (display_name ilike '%contato 1%' or email ilike '%contato 1%' or phone ilike '%contato 1%')
order by created_at desc, id desc limit 51;

\echo '### C4 busca rara (1 linha) — pior caso: percorre o workspace inteiro'
explain (analyze, buffers, costs off, summary on)
select id from public.contacts where organization_id = :org and anonymized_at is null
  and (display_name ilike '%contato49990%' or email ilike '%contato49990%' or phone ilike '%contato49990%')
order by created_at desc, id desc limit 51;

\echo '### C5 estado de consentimento dos 50 contatos da página (view security_invoker)'
select array_agg(id) as ids from (select id from public.contacts where organization_id = :org and anonymized_at is null
  order by created_at desc, id desc limit 50) x \gset
explain (analyze, buffers, costs off, summary on)
select contact_id,purpose,channel,granted,occurred_at from public.contact_consent_state
where organization_id = :org and contact_id = any(:'ids'::uuid[]);

\echo '### C6 pedidos do titular em aberto (alerta de prazo)'
explain (analyze, buffers, costs off, summary on)
select id,contact_id,kind,received_via,details,received_at,due_at,status,resolution_note,resolved_at
from public.data_subject_requests where organization_id = :org and status = 'open' order by due_at limit 200;
rollback;
