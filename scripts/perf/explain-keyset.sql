-- S16 · EXPLAIN ANALYZE das consultas paginadas por cursor (depois da migration
-- 20261119120000), como o PostgREST as gera a partir de src/lib/pagination.
-- Primeira página e uma página "funda" (cursor na linha ~15 mil do workspace alvo).
\set ON_ERROR_STOP on
\pset pager off
\set org '''10000000-0000-4000-8000-000000000001'''
-- Cursores fundos calculados como superusuário (mesmos valores que viriam do cursor).
select score_rank as p_rank, updated_at as p_upd, id as p_id from public.products
where organization_id = :org and status <> 'archived'
order by score_rank desc, updated_at desc, id desc offset 15000 limit 1 \gset
select updated_at as c_upd, id as c_id from public.content_items
where organization_id = :org order by updated_at desc, id desc offset 15000 limit 1 \gset
select created_at as m_crt, id as m_id from public.media_assets
where organization_id = :org and archived_at is null order by created_at desc, id desc offset 15000 limit 1 \gset
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true) \g /dev/null

\echo '### K1 produtos — primeira página (51 linhas = 50 + 1 para saber se há próxima)'
explain (analyze, buffers, costs off, summary on)
select id,name,score,score_rank,updated_at from public.products
where organization_id = :org and status <> 'archived'
order by score_rank desc, updated_at desc, id desc limit 51;

\echo '### K2 produtos — página funda (cursor na linha 15 000)'
explain (analyze, buffers, costs off, summary on)
select id,name,score,score_rank,updated_at from public.products
where organization_id = :org and status <> 'archived'
  and score_rank <= :'p_rank'
  and (score_rank < :'p_rank'
       or (score_rank = :'p_rank' and updated_at < :'p_upd')
       or (score_rank = :'p_rank' and updated_at = :'p_upd' and id < :'p_id'))
order by score_rank desc, updated_at desc, id desc limit 51;

\echo '### K3 conteúdos — primeira página'
explain (analyze, buffers, costs off, summary on)
select id,title,status,updated_at from public.content_items
where organization_id = :org order by updated_at desc, id desc limit 51;

\echo '### K4 conteúdos — página funda'
explain (analyze, buffers, costs off, summary on)
select id,title,status,updated_at from public.content_items
where organization_id = :org and updated_at <= :'c_upd'
  and (updated_at < :'c_upd' or (updated_at = :'c_upd' and id < :'c_id'))
order by updated_at desc, id desc limit 51;

\echo '### K5 conteúdos — primeira página filtrada por status (rascunhos)'
explain (analyze, buffers, costs off, summary on)
select id,title,status,updated_at from public.content_items
where organization_id = :org and status = 'draft' order by updated_at desc, id desc limit 51;

\echo '### K6 conteúdos — contagem por status (indicadores do Studio, 3 consultas head)'
explain (analyze, buffers, costs off, summary on)
select count(*) from public.content_items where organization_id = :org and status = 'draft';

\echo '### K7 mídia — primeira página'
explain (analyze, buffers, costs off, summary on)
select id,original_name,created_at from public.media_assets
where organization_id = :org and archived_at is null order by created_at desc, id desc limit 51;

\echo '### K8 mídia — página funda'
explain (analyze, buffers, costs off, summary on)
select id,original_name,created_at from public.media_assets
where organization_id = :org and archived_at is null and created_at <= :'m_crt'
  and (created_at < :'m_crt' or (created_at = :'m_crt' and id < :'m_id'))
order by created_at desc, id desc limit 51;
rollback;
