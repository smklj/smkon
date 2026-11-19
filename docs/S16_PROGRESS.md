# S16 — Performance · progresso

Frente: performance, paginação, cache e teste de carga.
Branches `feature/s16-*` · migrations `20261119120000`–`20261119129999` · testes SQL `040_*`–`049_*`.

## Checklist

| # | Etapa | Estado | PR |
|---|---|---|---|
| 1 | Diagnóstico das consultas reais com EXPLAIN ANALYZE em volume | ✅ feito (abaixo) | #49 (mergeado) |
| 2 | Paginação por cursor em `src/lib/pagination` + produtos, conteúdos e mídia | ✅ feito | #49 (mergeado) |
| 2b | Paginação em `/agentes` (depois de `docs/S14_HANDOFF.md` na integração) | ✅ feito (sem índice novo: o existente basta, medido) | #51 |
| 2c | Paginação da audiência (depois de `docs/S15_HANDOFF.md` na integração) | ⏳ aguardando S15 (PR #47 aberto, sem handoff) | — |
| 3 | Migration de índices medidos + teste SQL + EXPLAIN de verificação | ✅ feito (`20261119120000`, `040_*`, CI verde) · staging: **aguarda confirmação do Owner** (2ª tentativa em 19/11 18:5x também sem resposta) | #49 (mergeado) |
| 4 | Cache seguro (sem vazamento entre usuários/workspaces) | ✅ decisão medida + `private, no-store` nas APIs de listas | #51 |
| 5 | Teste de carga em `scripts/` (node, alvo configurável, p50/p95) | ✅ script + resultados locais; carga autenticada com Supabase falso (#51) | #49 (mergeado), #51 |
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

## 5. Teste de carga (`scripts/load-test.mjs`)

Node puro, sem dependências: concorrência fixa, aquecimento fora do relatório, mede até o fim do corpo, relata
req/s e p50/p95/p99/máx por rota, sai com código 1 se houver 5xx/falha de rede. Alvo configurável
(`--target`/`LOAD_TARGET`); alvo remoto só com `LOAD_ALLOW_REMOTE=1` (preview/staging, nunca produção);
`LOAD_COOKIE` (só ambiente, nunca impresso) para rotas autenticadas. Testes: `tests/unit/load-test.test.ts` (3).

Execução real em 19/11/2026: `next build` + `next start` local (2 vCPU), Supabase apontando para endereço local
inexistente. **Escopo honesto:** sem sessão, as rotas protegidas param no Proxy (307 para `/login`) ou na
autenticação da API (401); o resultado mede o custo do servidor Next e do Proxy, **não do banco**. O custo do
banco está medido à parte com EXPLAIN ANALYZE (seções 1–3).

```
node scripts/load-test.mjs --target http://localhost:3100 --paths /login,/produtos,/api/products,/api/content \
  --concurrency 20 --requests 2000 --warmup 50
```

| rota | concorrência | req | erros | status | req/s | p50 ms | p95 ms | p99 ms | máx ms |
|---|---|---|---|---|---|---|---|---|---|
| /login (SSR) | 1 | 300 | 0 | 200 | 182,8 | 4,6 | 9,6 | 15,6 | 40,1 |
| /produtos (Proxy → 307) | 1 | 300 | 0 | 307 | 701,1 | 1,2 | 3,2 | 5,4 | 8,5 |
| /api/products (401) | 1 | 300 | 0 | 401 | 478,8 | 1,6 | 4,9 | 7,6 | 14,0 |
| /api/content (401) | 1 | 300 | 0 | 401 | 539,9 | 1,5 | 3,8 | 8,8 | 13,9 |
| /login (SSR) | 20 | 2000 | 0 | 200 | 210,9 | 87,1 | 152,0 | 164,4 | 227,1 |
| /produtos (Proxy → 307) | 20 | 2000 | 0 | 307 | 965,5 | 18,6 | 38,9 | 54,3 | 162,8 |
| /api/products (401) | 20 | 2000 | 0 | 401 | 716,3 | 26,9 | 40,7 | 64,4 | 82,5 |
| /api/content (401) | 20 | 2000 | 0 | 401 | 746,1 | 25,5 | 42,1 | 52,3 | 77,4 |

Leitura: com 2 vCPU o servidor satura perto de 200 req/s no SSR de `/login` e 700–950 req/s nas respostas do
Proxy/API; a latência sob concorrência 20 é fila de CPU (p50 de 1–5 ms isolado). Carga autenticada com banco real
fica para um preview com `LOAD_COOKIE` de um usuário de teste do staging, decisão do Owner (é uma credencial).

## Validação local da execução 2 (19/11/2026)

- typecheck, lint ok · `test:unit` **198/198** · `test:db` **18 arquivos** · `build` ok (sobre a integração com o #49).
- `apply_migration` de `20261119120000` no staging: de novo pediu confirmação interativa e expirou (180 s);
  conferido por leitura: `score_rank` ausente, índices antigos intactos, nada aplicado.

## Validação local da execução 1 (19/11/2026)

- `npm ci` ok · `npm run typecheck` ok · `npm run lint` ok · `npm run test:unit` **170/170** (167 na 1ª versão + 3 do teste de carga) · `npm run build` ok.
- `npm run test:db` (Postgres 16 local, cluster descartável): **18 arquivos** passaram, incluindo `040_*` (13 asserções).
- CI do PR #49: "Typecheck, lint and build" ✅ e "Database migrations and SQL tests" ✅.
- Staging: `apply_migration` em `xoyasrizivadxnpmzzno` **não concluiu** — a ferramenta pediu confirmação
  interativa (a migration tem `drop index` de dois índices substituídos) e ninguém respondeu em 180 s. Conferido
  depois: `score_rank` não existe no staging, nada foi aplicado. Fica pendente de o Owner confirmar a aplicação.
  Até lá, `/produtos` usa o caminho de compatibilidade (200 linhas, sem próxima página).

## 2b. Paginação de `/agentes` (19/11/2026, execução 2)

- `src/lib/agents/runs-page.ts`: `AGENT_RUNS_KEYSET` (`created_at desc, id desc`) e 20 por página (o mesmo
  "últimas 20" de antes; cada execução carrega seus passos). `loadAgents(…, { cursor })` → `nextCursor`.
- `/agentes?cursor=`: `Pager` ("Próxima página", "Voltar ao início"); cursor inválido mostra as mais recentes com
  aviso (conferido no servidor local). Testes: `tests/unit/agents-runs-page.test.ts` (4), incluindo percorrer 95
  execuções com empates em páginas de 20 sem repetir nem perder.
- Medição (`scripts/perf/explain-agents.sql`, 30 mil execuções/150 mil passos, 18 mil no workspace alvo, sob RLS,
  mediana de 3):

  | Id | Consulta | Tempo | Plano |
  |---|---|---|---|
  | A0 | consulta anterior (20, sem desempate) | 0,13 ms | Index Scan `agent_runs_org_created_idx` |
  | A1 | 1ª página com cursor (21) | 0,06 ms | mesmo índice + Incremental Sort só no grupo empatado (22 linhas lidas) |
  | A2 | página funda (linha 15 000) | 0,07 ms | mesmo índice, `created_at <= cursor` como Index Cond |
  | A3 | passos das 20 execuções | 0,54 ms | `agent_steps_run_id_seq_key` |
  | A4 | contagem das últimas 24 h | 0,07 ms | Index Only Scan |

  **Sem índice novo.** Um índice `(organization_id, created_at desc, id desc)` foi testado e não mudou nada
  mensurável (A1 0,06→0,05 ms). Só faria diferença com milhares de execuções no mesmo instante — caso que a
  primeira versão do seed criou por engano (`random()` num lateral sem correlação gerou um único `created_at`) e
  que não representa uso real; o seed foi corrigido. Regra da frente: sem índice especulativo.

## 4. Cache (19/11/2026, execução 2)

Decisão: **nenhum cache entre requisições de dados de workspace.** Medido e justificado:

- Todas as leituras passam pela RLS com o JWT do usuário. Um cache compartilhado por workspace
  (`unstable_cache`/`"use cache"` do Next 16.4) precisaria rodar sem os cookies do usuário (cliente de serviço) e
  continuaria servindo dados a um membro removido ou rebaixado até expirar. Os catálogos estáticos (ferramentas
  dos agentes, rótulos) já são constantes no código.
- Deduplicação por requisição (React `cache`) entre layout e página foi implementada e **medida antes de entrar**:
  com o Supabase falso contando chamadas, cada página fazia 2 `auth/v1/user` (Proxy + renderização) e 1 leitura de
  memberships/workspace ativo **antes e depois** — o Next já memoiza `fetch` GET idêntico dentro da renderização.
  Ganho zero, então a mudança foi descartada.
- O que entrou: `Cache-Control: private, no-store` em `GET /api/products` e `GET /api/content` (antes sem
  cabeçalho; `/api/media` já tinha `no-store`). As páginas já saem com `private, no-cache, no-store` do Next.
  Conferido com `curl -D -` no servidor local.

## 5b. Carga autenticada sem serviços externos (19/11/2026, execução 2)

`scripts/perf/supabase-stub.mjs`: Supabase falso local (só 127.0.0.1) que responde Auth e PostgREST com um usuário,
um workspace e listas vazias, conta as chamadas por rota (`/__stats`) e gera o cookie de sessão de teste
(`--print-cookie`; JWT sem assinatura válida, inútil num Supabase real). Mede o custo do Next autenticado
(Proxy com `getClaims`, renderização e handlers), **não do banco** (latência do stub ≈ 0; o banco está nas seções 1–3).
O stub divide as mesmas 2 vCPU com o Next, então os números são pessimistas.

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54400 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=stub npm run build
node scripts/perf/supabase-stub.mjs --port 54400 & npx next start -p 3204 &
LOAD_COOKIE="$(node scripts/perf/supabase-stub.mjs --print-cookie)" node scripts/load-test.mjs \
  --target http://127.0.0.1:3204 --paths /,/produtos,/agentes,/api/products,/api/content --concurrency 20 --requests 2000
```

| rota | conc. | req | erros | req/s | p50 ms | p95 ms | p99 ms | máx ms |
|---|---|---|---|---|---|---|---|---|
| / (visão geral) | 1 | 300 | 0 | 55,5 | 17,3 | 25,9 | 31,8 | 40,3 |
| /produtos | 1 | 300 | 0 | 78,1 | 11,8 | 19,2 | 24,5 | 35,9 |
| /agentes | 1 | 300 | 0 | 66,8 | 13,8 | 21,4 | 35,7 | 54,5 |
| /api/products | 1 | 300 | 0 | 215,5 | 4,1 | 7,4 | 8,5 | 13,5 |
| /api/content | 1 | 300 | 0 | 121,4 | 7,4 | 13,1 | 26,7 | 38,4 |
| / (visão geral) | 20 | 2000 | 0 | 99,0 | 195,6 | 272,7 | 319,4 | 420,6 |
| /produtos | 20 | 2000 | 0 | 136,6 | 137,2 | 195,0 | 216,5 | 294,3 |
| /agentes | 20 | 2000 | 0 | 108,1 | 172,3 | 247,5 | 368,2 | 428,2 |
| /api/products | 20 | 2000 | 0 | 185,3 | 102,5 | 132,2 | 236,9 | 626,8 |
| /api/content | 20 | 2000 | 0 | 158,9 | 126,7 | 159,6 | 189,7 | 205,7 |

Todas 200, sem erro. Chamadas ao Supabase por requisição (contadas): 2 `auth/v1/user` em todas (Proxy + página/
handler); `/api/content` na 1ª página faz 3 `HEAD` de contagem por status — candidato a uma RPC única se a
latência real do PostgREST pesar (não medido no staging; fica registrado, sem mudança especulativa).

## Pendências desta frente

- Aplicar `20261119120000` no staging (confirmação do Owner na ferramenta) e conferir advisors; só então incluir
  no E2E um teste de paginação da API de produtos.
- Migração de rascunhos do `localStorage` no Studio deduplica contra a 1ª página (50 mais recentes); rascunhos
  locais são sempre os mais novos, então o risco de duplicar é baixo, mas fica registrado.
- Seletor de mídia do Studio usa só a 1ª página (200); busca por nome fica para quando houver demanda.
- Audiência (`/audiencia`, S15): aguardando `docs/S15_HANDOFF.md` na integração (PR #47 ainda aberto).
- Handoff `docs/S16_HANDOFF.md` e linha do ROADMAP: depois da paginação da audiência.
