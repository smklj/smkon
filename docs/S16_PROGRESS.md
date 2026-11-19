# S16 — Performance · progresso

Frente: performance, paginação, cache e teste de carga.
Branches `feature/s16-*` · migrations `20261119120000`–`20261119129999` · testes SQL `040_*`–`049_*`.

## Checklist

| # | Etapa | Estado | PR |
|---|---|---|---|
| 1 | Diagnóstico das consultas reais com EXPLAIN ANALYZE em volume | ✅ feito (abaixo) | #(este PR) |
| 2 | Paginação por cursor em `src/lib/pagination` + produtos, conteúdos e mídia | ✅ feito | #(este PR) |
| 2b | Paginação em `/agentes` (depois de `docs/S14_HANDOFF.md` na integração) e audiência (depois de `docs/S15_HANDOFF.md`) | ⏳ aguardando S14/S15 | — |
| 3 | Migration de índices medidos + teste SQL + EXPLAIN de verificação | ✅ feito (`20261119120000`, `040_*`) · staging: pendente do CI | #(este PR) |
| 4 | Cache seguro (sem vazamento entre usuários/workspaces) | ⏳ próxima execução | — |
| 5 | Teste de carga em `scripts/` (node, alvo configurável, p50/p95) | ⏳ próxima execução | — |
| 6 | `docs/S16_HANDOFF.md` + linha do S16 no ROADMAP | ⏳ | — |

## 1. Diagnóstico (19/11/2026)

### Como medir (reproduzível)

```bash
# Postgres local descartável (mesmo cluster dos testes SQL)
export DATABASE_ADMIN_URL='postgresql://postgres@/postgres?host=/tmp/pg&port=54329'
BENCH_BEFORE=20261119120000 bash scripts/perf/bench-db.sh   # "antes": sem as migrations do S16
psql 'postgresql://postgres@/smkon_bench?host=/tmp/pg&port=54329' -f scripts/perf/explain-screens.sql
bash scripts/perf/bench-db.sh                                # "depois": todas as migrations
psql 'postgresql://postgres@/smkon_bench?host=/tmp/pg&port=54329' -f scripts/perf/explain-keyset.sql
```

- `scripts/perf/seed-bench.sql`: 20 workspaces; o workspace alvo concentra 60% das linhas.
  Totais: **50 000 produtos, 50 000 conteúdos, 30 000 mídias, 45 007 licenças** (alvo: 30 000 / 30 000 / 18 000).
  Empates de `updated_at`/`created_at` de propósito (minuto truncado) e 30% dos produtos sem score.
- As consultas rodam **sob RLS**, como o PostgREST: `set role authenticated` + `request.jwt.claims` do owner do workspace alvo.
- Parâmetros do planejador iguais aos do Supabase, conferidos no staging (`pg_settings`, só leitura):
  PG 17.11, `jit = off`, `random_page_cost = 1.1`, `work_mem = 2184kB`. O cluster local é PG 16.
  **Achado:** com o JIT ligado (padrão do Postgres local), `workspace_overview` media ~220–280 ms porque o custo
  total passa de `jit_above_cost`; com `jit = off`, como no Supabase, mede ~50–70 ms. O tempo de JIT não existe
  no Supabase, por isso o banco de benchmark desliga o JIT.

### Consultas das telas (fonte → consulta)

| Id | Tela / rota | Código | Consulta |
|---|---|---|---|
| Q1 | `/produtos`, `GET /api/products` | `src/lib/products/server.ts` `listProducts` | não arquivados, `score desc nulls last, updated_at desc`, `limit 200` |
| Q2 | `/studio` via `GET /api/content` | `src/app/api/content/route.ts` | **todos** os conteúdos do workspace, `updated_at desc`, **sem limite** |
| Q3a | `/midia`, `GET /api/media` (seletor do Studio) | `src/lib/media/server.ts` `listMedia` | não arquivadas, `created_at desc`, `limit 200` |
| Q3b | idem | idem | licenças das mídias da página (`in (...)`) |
| Q4 | `/calendario` | `src/lib/publication/server.ts` `listApprovedContent` | aprovados, `updated_at desc`, `limit 100` |
| Q5 | `/` (visão geral) | `src/lib/overview/server.ts` → `workspace_overview` | agregados em uma chamada |
| — | `/agentes` | `src/lib/agents/server.ts` | `limit 20` + passos; **fora do escopo até o S14 terminar** |
| — | `/financeiro` | `src/app/(app)/financeiro/page.tsx` | resumo por view + histórico `limit 10`; sem volume relevante no diagnóstico |

### Antes (sem a migration do S16) — mediana de 3 execuções

| Id | Tempo | Plano / observação |
|---|---|---|
| Q1 | **26,2 ms** | lê e ordena **22 500 linhas** (top-N heapsort) para devolver 200; produtos além do 200º ficam **inacessíveis** na tela |
| Q2 | **24,4 ms** no banco + **30 000 linhas / ~19 MB de JSON** para o navegador a cada carga do Studio (e após cada salvar/aprovar/excluir) |
| Q3a | 0,33 ms | índice `media_assets_org_idx` já serve; mídias além da 200ª ficam **inacessíveis** |
| Q3b | 1,6 ms | `media_licenses_asset_idx` (200 buscas por índice) |
| Q4 | 0,27 ms | `content_items_org_updated_idx` + filtro de status; ok |
| Q5 | ~66 ms | contagens varrem 30 000 conteúdos e 30 000 produtos via bitmap; ok para uma chamada por visita |

Conclusões: o problema real é **volume trafegado** (Q2) e **listas truncadas sem paginação** (Q1, Q3). Ordenar sem
desempate único (`updated_at` tem empates) também impediria paginar de forma estável.

### Depois (migration `20261119120000` + keyset) — mediana de 3 execuções, páginas de 50

| Id | Consulta | Tempo | Plano |
|---|---|---|---|
| K1 | produtos, 1ª página | 0,18 ms | Index Scan `products_org_rank_keyset_idx` |
| K2 | produtos, página na linha 15 000 | 0,52 ms | Index Cond `score_rank <= cursor` (descarta 563 linhas, não 20 mil) |
| K3 | conteúdos, 1ª página | 0,23 ms | Index Scan `content_items_org_updated_id_idx` |
| K4 | conteúdos, página na linha 15 000 | 0,21 ms | Index Cond `updated_at <= cursor` |
| K5 | conteúdos filtrados por status, 1ª página | 0,40 ms | mesmo índice + filtro (descarta ~110 linhas) |
| K6 | contagem por status (indicadores do Studio) | **1,8 ms** (era 19,5 ms) | Index Only Scan `content_items_org_status_idx`, 0 heap fetches |
| K7 | mídia, 1ª página | 0,11 ms | Index Scan `media_assets_org_created_id_idx` |
| K8 | mídia, página na linha 15 000 | 0,10 ms | Index Cond `created_at <= cursor` |

Payload da 1ª página do Studio: **~32 kB** (antes ~19 MB no workspace de 30 mil peças).

### Achado: operadores LEAKPROOF sob RLS

A primeira versão usava `score_rank numeric`. Sob RLS o Postgres só leva para a condição de índice os filtros do
usuário cujos operadores são `LEAKPROOF`; os de `numeric` não são (os de `integer`, `timestamptz` e `uuid` são).
Medido: com `numeric`, a página funda (K2) descartava **19 991 linhas** no filtro (9,8 ms); com `integer`
(score em centésimos), o limite vira Index Cond e descarta 563 (0,5 ms). O teste `040_*` confere isso com EXPLAIN.

## 2. Paginação por cursor

- `src/lib/pagination/keyset.ts`: spec por lista (`id`, direção, chaves com tipo), `encodeCursor`/`decodeCursor`
  (base64url, ligado ao id da lista, valores validados por expressão estrita: nada de vírgula, aspas ou parênteses
  chega ao filtro do PostgREST), `keysetFilter` (limite inicial + comparação lexicográfica em `or`),
  `applyKeyset` (ordenação estável + `limit n+1`), `toPage`, `parsePageSize` (1–100, padrão 50).
  Timestamps ficam como texto do PostgREST (microssegundos) para não repetir nem pular linhas.
- Testes: `tests/unit/pagination.test.ts` (11 testes), incluindo percorrer 257 linhas com empates em páginas de 30
  sem repetir nem perder linhas e cursores adulterados.
- Produtos: `listProducts` → `{ items, nextCursor }`, ordem `score_rank desc, updated_at desc, id desc`.
  `/produtos?cursor=` (preserva `arquivados`), `GET /api/products?cursor=&limit=`.
  Sem a coluna `score_rank` (código antes da migration), cai para a consulta anterior (200 linhas, sem próxima
  página) e registra `products.list.legacy`.
- Conteúdos: `GET /api/content?cursor=&limit=&status=`; na 1ª página devolve `counts` (total e por status).
  Studio: filtro de status no servidor, "Carregar mais", indicadores pelas contagens do banco, respostas antigas
  descartadas quando o filtro muda.
- Mídia: `listMedia` → `{ items, nextCursor }`; `/midia?cursor=` (50 por página); `GET /api/media?cursor=`
  (seletor do Studio, 200 por página como o limite anterior).
- Navegação: `src/components/ui/Pager.tsx` ("Próxima página", "Voltar ao início"). Keyset só anda para a frente.
  Cursor inválido na página: mostra a 1ª página com aviso; na API: 400 `invalid_input`.

## 3. Índices (`supabase/migrations/20261119120000_keyset_pagination_indexes.sql`)

- `products.score_rank integer generated always as (coalesce((score*100)::integer, -1)) stored`.
- `products_org_rank_keyset_idx (organization_id, score_rank desc, updated_at desc, id desc)`.
- `content_items_org_updated_id_idx (organization_id, updated_at desc, id desc)` — substitui `content_items_org_updated_idx`.
- `media_assets_org_created_id_idx (organization_id, created_at desc, id desc)` — substitui `media_assets_org_idx`.
- `content_items_org_status_idx (organization_id, status)` — contagens por status (Studio e `workspace_overview`).
- Sem mudança de RLS, grants ou funções. Teste `supabase/tests/040_keyset_pagination_indexes.test.sql` (13 asserções):
  definição dos índices, remoção dos substituídos, coluna gerada (valores, ordem equivalente, escrita recusada),
  EXPLAIN de verificação sob RLS e isolamento entre workspaces.

## Validação local desta etapa (19/11/2026)

- `npm ci` ok · `npm run typecheck` ok · `npm run lint` ok · `npm run test:unit` **167/167** · `npm run build` ok.
- `npm run test:db` (Postgres 16 local, cluster descartável): **18 arquivos** passaram, incluindo `040_*` (13 asserções).
- Staging: migration ainda **não aplicada** (aguarda CI verde deste PR; autorizado pelo Owner em 19/11/2026).

## Pendências desta frente

- Aplicar `20261119120000` no staging depois do CI e conferir advisors; só então incluir no E2E um teste de
  paginação da API de produtos.
- Migração de rascunhos do `localStorage` no Studio deduplica contra a 1ª página (50 mais recentes); rascunhos
  locais são sempre os mais novos, então o risco de duplicar é baixo, mas fica registrado.
- Seletor de mídia do Studio usa só a 1ª página (200); busca por nome fica para quando houver demanda.
- `/agentes` e audiência: aguardando os handoffs do S14 e do S15.
