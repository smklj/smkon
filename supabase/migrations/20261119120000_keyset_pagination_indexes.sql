-- SMKON S16: índices para a paginação por cursor (keyset) das listas de produtos,
-- conteúdos e mídia. Cada índice abaixo corresponde a uma consulta medida com
-- EXPLAIN ANALYZE em docs/S16_PROGRESS.md (dados sintéticos de 30 mil linhas por
-- workspace). Nada aqui muda RLS, grants ou regras de escrita.
--
-- Ordenações estáveis (desempate por id, que é único):
--   produtos  → score desc nulls last, updated_at desc, id desc
--   conteúdos → updated_at desc, id desc
--   mídia     → created_at desc, id desc

-- ---------------------------------------------------------------------------
-- 1. Produtos: posição no ranking sem NULL
-- ---------------------------------------------------------------------------
-- O PostgREST não filtra por expressão e "score" é nulo para produto sem evidência
-- verificada. score_rank = score em centésimos (0 a 10000), ou -1 sem score, mantém a
-- mesma ordem de "score desc nulls last" e permite o limite inicial
-- "score_rank <= cursor" como condição de índice.
-- Por que integer e não numeric: sob RLS, o Postgres só usa no índice os filtros do
-- usuário cujos operadores são LEAKPROOF; os de integer, timestamptz e uuid são, os de
-- numeric não (medido: com numeric a página funda descartava ~20 mil linhas no filtro).
-- Coluna gerada: nunca é escrita pela aplicação e acompanha o recálculo do score feito
-- por review_product_evidence.
alter table public.products
  add column score_rank integer generated always as (coalesce((score * 100)::integer, -1)) stored;

comment on column public.products.score_rank is
  'S16: score em centésimos ou -1 sem score. Chave de ordenação da paginação por cursor (score desc nulls last). Somente leitura.';

create index products_org_rank_keyset_idx
  on public.products (organization_id, score_rank desc, updated_at desc, id desc);

-- ---------------------------------------------------------------------------
-- 2. Conteúdos: (organization_id, updated_at desc) ganha o desempate por id
-- ---------------------------------------------------------------------------
-- O índice novo cobre todas as consultas do antigo (mesmo prefixo), que deixa de
-- ser necessário e só custaria escrita.
create index content_items_org_updated_id_idx
  on public.content_items (organization_id, updated_at desc, id desc);
drop index if exists public.content_items_org_updated_idx;

-- ---------------------------------------------------------------------------
-- 3. Mídia: (organization_id, created_at desc) ganha o desempate por id
-- ---------------------------------------------------------------------------
create index media_assets_org_created_id_idx
  on public.media_assets (organization_id, created_at desc, id desc);
drop index if exists public.media_assets_org_idx;

-- ---------------------------------------------------------------------------
-- 4. Conteúdos: contagem por status
-- ---------------------------------------------------------------------------
-- Com a lista paginada, os indicadores do Studio (rascunhos, aprovados, arquivados)
-- passam a vir de contagens no banco. Medido: 19,5 ms por contagem com o índice de
-- ordenação; 1,7 ms com index-only scan neste índice. Também atende as contagens
-- de conteúdo de workspace_overview.
create index content_items_org_status_idx
  on public.content_items (organization_id, status);
