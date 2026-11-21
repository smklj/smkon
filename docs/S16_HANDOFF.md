# S16 — Performance · handoff

**PRs:** #49 (diagnóstico, paginação, índices, carga), #51 (`/agentes`, cache, carga autenticada), #53 (audiência e este handoff) — todos com base `feature/smkon-production-readiness`.
**Registro detalhado, comandos e todas as medições:** `docs/S16_PROGRESS.md`.

## O que mudou

### Diagnóstico medido (não estimado)
- Banco local de benchmark (`scripts/perf/bench-db.sh` + `seed-bench.sql`): 20 workspaces, um com 60% das linhas — 50 mil produtos, 50 mil conteúdos, 30 mil mídias, ~45 mil licenças, 30 mil execuções de agentes (150 mil passos), 50 mil contatos (100 mil eventos de consentimento). Parâmetros do planejador iguais aos do Supabase (`jit = off`, `random_page_cost = 1.1`, `work_mem`), conferidos no staging só por leitura.
- Consultas executadas **sob RLS** como o PostgREST (`role authenticated` + `request.jwt.claims`). Scripts: `explain-screens.sql`, `explain-keyset.sql`, `explain-agents.sql`, `explain-audience.sql`.
- Problemas reais encontrados: o Studio baixava **todos** os conteúdos (~19 MB para 30 mil peças) a cada carga; produtos, mídia e contatos ficavam truncados em 100–200 linhas sem como ver o resto; ordenações sem desempate único.

### Paginação por cursor (keyset)
- `src/lib/pagination/keyset.ts`: cursor base64url ligado à lista, valores validados por tipo (nada de sintaxe do PostgREST vinda do cliente), ordenação estável com desempate por `id`, `limit n+1`, tamanho 1–100.
- Aplicada em: produtos (`/produtos`, `GET /api/products`), conteúdos (`GET /api/content` com filtro de status e contagens no banco; Studio com "Carregar mais"), mídia (`/midia`, `GET /api/media`), execuções de agentes (`/agentes`) e contatos (`/audiencia`, preservando busca e filtro de anonimizados).
- `src/components/ui/Pager.tsx`: "Próxima página" / "Voltar ao início". Cursor inválido: páginas mostram a 1ª página com aviso; APIs respondem 400 `invalid_input`.

### Índices — `supabase/migrations/20261119120000_keyset_pagination_indexes.sql`
- `products.score_rank` (integer gerado: score em centésimos ou −1) + `products_org_rank_keyset_idx`; `content_items_org_updated_id_idx` e `media_assets_org_created_id_idx` (substituem os índices sem desempate, removidos); `content_items_org_status_idx` (contagens por status).
- Achado documentado: sob RLS só operadores `LEAKPROOF` viram condição de índice; `numeric` não é, por isso `score_rank` é `integer` (página funda: 9,8 ms → 0,5 ms).
- `/agentes` e `/audiencia` **não** ganharam índice: os existentes foram medidos e bastam.
- Sem mudança de RLS, grants ou funções.

### Cache
- Decisão medida: **nenhum cache entre requisições** de dados de workspace (cache compartilhado teria de contornar a RLS e serviria dados a membro removido). Deduplicação por requisição testada e descartada (ganho zero medido). Entrou `Cache-Control: private, no-store` nas APIs de lista.

### Teste de carga
- `scripts/load-test.mjs`: Node puro, alvo configurável, alvo remoto só com `LOAD_ALLOW_REMOTE=1`, cookie só por ambiente, relatório req/s e p50/p95/p99/máx, sai com 1 se houver 5xx.
- `scripts/perf/supabase-stub.mjs`: Supabase falso local para medir o Next autenticado sem serviços externos (`STUB_LOG_QUERIES=1` imprime as consultas recebidas).

## Resultados reais (resumo)

| Medida | Antes | Depois |
|---|---|---|
| Produtos, página na linha 15 000 | inacessível (lista parava em 200) | 0,52 ms |
| Studio, 1ª carga (30 mil conteúdos) | 24 ms no banco + ~19 MB de JSON | 0,23 ms + ~32 kB |
| Contagem por status do Studio | 19,5 ms | 1,8 ms |
| Mídia, página funda | inacessível (200) | 0,10 ms |
| Execuções de agentes, página funda | inacessível (20) | 0,07 ms |
| Contatos, página funda | inacessível (100) | 0,14 ms |
| Carga autenticada (Next + Supabase falso, 2 vCPU, conc. 20) | — | p95 132–273 ms, 0 erros em 10 mil req |

Testes: `test:unit` **216/216** (inclui `pagination` 11, `agents-runs-page` 4, `audience-contacts-page` 5, `load-test` 3); `test:db` **19 arquivos** (inclui `040_keyset_pagination_indexes`, 13 asserções com EXPLAIN de verificação sob RLS e isolamento entre workspaces); typecheck, lint e build ok; CI verde nos PRs #49 e #51.

## Problemas e pendências
- **Staging:** `20261119120000` **aplicada** (registrada como `20261119232441_keyset_pagination_indexes`); conferido em 21/11 por leitura: coluna `score_rank`, os 4 índices novos presentes e os 2 substituídos removidos. `get_advisors` sem avisos ligados ao S16 (segurança e performance). E2E de paginação da API de produtos adicionado em `tests/e2e/products.spec.mjs`.
- **Produção:** migration não aplicada — exige autorização explícita.
- Busca de contatos por trecho: pior caso 38 ms com 30 mil contatos; índice trigram só se o volume justificar.
- Carga autenticada contra banco real fica para um preview com `LOAD_COOKIE` de usuário de teste do staging (decisão do Owner: é uma credencial).
- `/api/content` faz 3 contagens `HEAD` na 1ª página; candidato a RPC única se a latência real do PostgREST pesar (não medido no staging).
- Seletor de mídia do Studio usa só a 1ª página (200).

## Próxima etapa recomendada
Autorizar a produção de `20261119120000` junto com as migrations do S15 (staging já aplicado e coberto pelo E2E).
