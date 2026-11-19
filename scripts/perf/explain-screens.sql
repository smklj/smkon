-- S16 · EXPLAIN ANALYZE das consultas reais das telas, sob RLS, como o PostgREST as executa
-- (papel authenticated + claims do JWT). Rodar no banco de benchmark (scripts/perf/bench-db.sh).
-- Usuário 1 = owner do workspace alvo (~30 mil linhas por tabela nesse workspace).
\set ON_ERROR_STOP on
\pset pager off
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
\set org '''10000000-0000-4000-8000-000000000001'''
-- Aquece o cache antes de medir.
select count(*) from public.products; select count(*) from public.content_items; select count(*) from public.media_assets;

\echo '### Q1 /produtos — listProducts (não arquivados, score desc nulls last, updated_at desc, limit 200)'
explain (analyze, buffers, costs off, summary on)
select id,name,source,type,status,revenue_domain,price_cents,currency,commission_percent,affiliate_url,external_id,score,score_reasons,updated_at
from public.products where organization_id = :org and status <> 'archived'
order by score desc nulls last, updated_at desc limit 200;

\echo '### Q2 /api/content GET (Studio) — todos os conteúdos do workspace, sem limite'
explain (analyze, buffers, costs off, summary on)
select id,title,product,source_url,asset_url,script,caption,cta,hashtags,channels,rights_confirmed,media_asset_id,status,version,content_hash,approved_version,approved_at,created_at,updated_at
from public.content_items where organization_id = :org order by updated_at desc;

\echo '### Q3a /midia e /api/media — listMedia (não arquivadas, created_at desc, limit 200)'
explain (analyze, buffers, costs off, summary on)
select id,storage_path,kind,mime_type,size_bytes,original_name,created_at,archived_at
from public.media_assets where organization_id = :org and archived_at is null
order by created_at desc limit 200;

\echo '### Q3b listMedia — licenças das 200 mídias da página'
explain (analyze, buffers, costs off, summary on)
select l.id from public.media_licenses l
where l.media_asset_id in (
  select id from public.media_assets where organization_id = :org and archived_at is null order by created_at desc limit 200)
order by l.created_at desc;

\echo '### Q4 /calendario — listApprovedContent (approved, updated_at desc, limit 100)'
explain (analyze, buffers, costs off, summary on)
select id,title,version,channels from public.content_items
where organization_id = :org and status = 'approved' order by updated_at desc limit 100;

\echo '### Q5 / (visão geral) — workspace_overview'
explain (analyze, buffers, costs off, summary on)
select public.workspace_overview(:org);
rollback;
