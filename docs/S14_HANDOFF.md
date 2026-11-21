# S14 — Handoff: executor real dos agentes (Planner → Executor → Verifier)

**Estado em 19/11/2026:** código das 9 etapas integrado na branch `feature/smkon-production-readiness` (PRs #35–#42
e o PR da etapa 8/9, `feature/s14-run-detail`). **Não está em produção**: falta o merge na `main` e as autorizações
listadas no fim. Plano vivo, decisões e registro por etapa: `docs/S14_PROGRESS.md`.

## O que mudou

As execuções `queued` criadas no S13 passam a ser executadas por um worker do servidor:

1. **Reserva sem corrida** — `agent_claim_next_run()` (`FOR UPDATE SKIP LOCKED` + lease); execuções presas além do
   lease falham com `worker_timeout`; kill switch ligado na reserva vira `killed`.
2. **Worker** `/api/agents/worker` — `CRON_SECRET` comparado em tempo constante, desligado por padrão
   (`AGENT_EXECUTOR_ENABLED`), `service_role` só no servidor, cron diário em `vercel.json` (11:17 UTC).
3. **Loop** `runAgent()` puro (Planner → Executor → Verifier) com limites de passos, timeout por passo, prazo total
   (240 s), payload ≤ 64 KB e releitura do estado antes de cada passo (kill switch/cancelamento mandam).
4. **Ferramentas** `read_*` escopadas pelo `organization_id` da execução (nunca do modelo), colunas mínimas, ≤ 50 itens;
   `read_finance_summary` separa vendas próprias, afiliados e mídia e não mistura estados.
5. **`draft_content`** — única escrita: cria conteúdo em `status = 'draft'`, autor = humano que criou a execução,
   marcado com `agent_run_id`. Nenhuma aprovação é criada; publicar continua exigindo aprovação humana da versão exata.
6. **Modelo** via Vercel AI Gateway (`fetch` nativo, sem SDK novo), credencial explícita (`AI_GATEWAY_API_KEY`) ou OIDC
   opt-in (`AGENT_MODEL_AUTH=oidc`); sem configuração → `model_not_configured`, nenhuma chamada.
7. **Verifier determinístico** — afirmação sobre produto exige `product_evidence` `verified` do mesmo workspace; rascunho
   que trata de produto sem evidência é barrado antes da escrita (`evidence_missing`).
8. **Teto de gasto** — `agent_model_usage` (uma linha por chamada, só inclusão) e `AGENT_MONTHLY_BUDGET_USD`; teto
   atingido → o disparo para com `budget_exhausted` sem iniciar execuções.
9. **UI de detalhe** `/agentes/[id]` (etapa 8) — estado, datas e duração; motivo de falha/interrupção em linguagem
   clara; resultado verificado com afirmações e link para o produto; passos com entrada/saída resumidas e JSON
   completo recolhível (cortado em 8 KB); consumo do modelo da execução (custo estimado, chamadas, tokens, modelo).
   Nenhuma ação de publicar ou aprovar; rascunho criado aponta para revisão humana no Content Studio. Sem a migration
   de consumo no banco, a seção mostra "migration pendente" em vez de erro.

## Arquivos

- Migrations: `20261119040000_agent_draft_content.sql`, `20261119050000_agent_claim_queue.sql`,
  `20261119060000_agent_model_usage.sql`. Testes SQL: `supabase/tests/014_*`, `015_*`, `016_*`.
- Executor: `src/lib/agents/executor/` (`run.ts`, `limits.ts`, `verifier.ts`, `parse.ts`, `store.ts`, `rpc.ts`,
  `model*.ts`, `tools/{read,draft,db}.ts`, `types.ts`).
- Worker: `src/lib/agents/worker/` (`auth.ts`, `handler.ts`, `tick.ts`, `queue.ts`, `budget.ts`) e
  `src/app/api/agents/worker/route.ts`; `vercel.json` (cron).
- UI: `src/app/(app)/agentes/[id]/page.tsx` (novo), `src/app/(app)/agentes/page.tsx` (link e motivo legível),
  `src/app/(app)/agentes/actions.ts` (revalida o detalhe), `src/lib/agents/detail.ts` (novo),
  `src/lib/agents/server.ts` (`loadRunDetail`), `src/app/globals.css` (estilos do detalhe).
- Testes unitários: `tests/unit/agents-{executor,tools,worker,model,budget,detail}.test.ts`. E2E: `tests/e2e/agents.spec.mjs`.
- Compartilhados (mudanças aditivas): `src/lib/supabase/database.types.ts`, `.env.example`, `docs/ROADMAP_SPLITS.md`.

## Testes reais (última execução local, etapa 8, sobre a integração com o PR #42)

- `npm run typecheck`, `npm run lint`: sem erros.
- `npm run test:unit`: **166/166** (10 novos em `agents-detail.test.ts`).
- `npm run test:db` (Postgres 16 local descartável): **17/17 arquivos** passaram.
- `npm run build`: OK, rotas `/agentes` e `/agentes/[id]` dinâmicas.
- E2E no staging: o `agents.spec` passou a abrir o detalhe da execução interrompida pelo kill switch (estado,
  motivo legível, consumo vazio, nenhum botão de publicar/aprovar). Resultado no CI do PR `feature/s14-run-detail`.
- Nunca houve chamada real ao modelo: todos os testes do adaptador usam `fetch` falso.

## Estado dos bancos (conferido em 19/11/2026 com `list_migrations`)

| Migration | Staging (`xoyasrizivadxnpmzzno`) | Produção (`hpplboyysmfcjsnjrdmw`) |
|---|---|---|
| `20261119040000_agent_draft_content` | ✅ | ✅ |
| `20261119050000_agent_claim_queue` | ✅ | ✅ |
| `20261119060000_agent_model_usage` | ✅ | ⏳ pendente (precisa de autorização) |

## Pendências e autorizações do Owner

1. 🔐 **`SUPABASE_SECRET_KEY`** — criar a *secret key* em cada projeto Supabase e cadastrar na Vercel como *sensitive*
   (staging em Preview, produção em Production). Sem ela o worker responde `503 service_not_configured` e nada executa.
2. 🔐 **Crédito e orçamento no AI Gateway** — conferir crédito do time (sem crédito: 402 → `model_error`) e criar o
   orçamento do projeto `smkon` (US$ 5/mês) como segunda barreira, independente do teto no código.
3. 🔐 **Migration `20261119060000_agent_model_usage` na produção** — sem ela a consulta do gasto falha em produção e o
   disparo não executa nenhuma execução (falha fechada); o detalhe mostra "migration pendente" no consumo.
4. 🔐 **Merge da integração na `main`** — o worker e o cron só existem em produção depois dele. Crons da Vercel não
   rodam em Preview; no plano Hobby o cron é no máximo diário.
5. Primeiro uso real: no staging, com orçamento baixo, acompanhando `/agentes/[id]` (passos e consumo).

## Limitações conhecidas

- O Verifier reconhece menção a produto só pelo id/nome dos produtos lidos na execução; nome comum (≥ 4 letras) usado
  em sentido genérico reprova o resumo (falha fechada).
- O teto de gasto é "suave": a execução em andamento termina, então o gasto pode passar levemente do teto.
- O custo exibido é estimado pela tabela de preços em `model-pricing.ts`, não pela fatura do provedor.
- O detalhe mostra até 100 passos e 200 registros de consumo por execução (limites do banco já são menores: 50 passos).

## Próxima etapa recomendada

Com as autorizações 1–3, rodar uma execução real de `operations_review` no staging, conferir o detalhe e o consumo,
e só então pedir o merge na `main`. Depois: geração de roteiro/legenda com evidência obrigatória sobre o
`draft_content` e, quando autorizado, publicação via APIs oficiais só com hash aprovado.


## Reconciliação S14 — 21/11/2026, 08:57 BRT

Esta seção registra a auditoria desta rodada e supersede estados anteriores conflitantes.

### Git e CI
- A PR #64 (head `06a77540e7c1c0c12feefb406d50d5257a874d29`) está aberta em Draft. A comparação real com a head atual da integração `b08654bbc47e537fe3e7ddf848d8ca1e891644ac` retorna `diverged`, 16 commits à frente e 5 atrás; `mergeable=false`. O corpo anterior da PR dizia mergeable, mas esse estado ficou obsoleto após novos merges na integração.
- CI #44897554015 terminou `success` nos dois jobs: dependency audit, typecheck, lint, testes unitários, build, migrations e testes SQL. Esse run valida o head #64 acima, não a branch de rebase criada nesta rodada.
- A Vercel registrou na PR #64 erro `api-deployments-free-per-day` (limite diário de deployments). Não há deployment Preview atribuível ao head da PR #64. O Preview anterior da PR #61 não valida este código.
- Foi criada a branch `fix/s14-timeout-ledger-rebase-20261121-0857` a partir da head atual da integração para reaplicar somente os três arquivos de código/teste da correção, evitando carregar os cinco commits não relacionados. O PR desta branch deve ser validado pelo seu próprio CI e Preview antes de substituir a #64.

### Auditoria de ambiente
- Vercel project `smkon`: `AGENT_MODEL_PROVIDER=vercel-ai-gateway`, `AGENT_MODEL_AUTH=oidc`, `AGENT_MODEL=anthropic/claude-haiku-5.5`, `AGENT_MONTHLY_BUDGET_USD=5`; `AGENT_EXECUTOR_ENABLED=true` em Preview e Production.
- `CRON_SECRET` está cadastrado como sensitive para Preview e Production; o valor permanece redacted e o comprimento/whitespace não foi validado. `SUPABASE_SECRET_KEY` não aparece no inventário de variáveis. A ausência de `AI_GATEWAY_API_KEY` é compatível com o modo OIDC, mas o token não foi observado em runtime autenticado.
- AI Gateway: nenhum budget individual e nenhum default; uso do projeto nos últimos 7 dias sem linhas de requests/tokens/custo. Não há evidência de chamada real.
- Staging Supabase `xoyasrizivadxnpmzzno`: 28 migrations; 96 `agent_runs`, todas `killed`; 0 `agent_steps`, 0 `agent_model_usage`, 0 `agent_tool_grants` e 0 conteúdos ligados a runs.
- Production Supabase `hpplboyysmfcjsnjrdmw`: 20 migrations; 0 runs, steps, usage, grants e conteúdos ligados a runs. As migrations S14 de draft, claim queue e model usage estão registradas nos dois históricos. Nenhuma migration remota foi aplicada nesta auditoria.
- Os zeros de `agent_model_usage` e do agregado do Gateway são consistentes com ausência de chamadas, mas não validam o caminho de contabilização após uma cobrança.

### Cron, segurança e bloqueios
- A integração contém `vercel.json` e `src/app/api/agents/worker/route.ts`; a rota e o arquivo de configuração não existem em `main` (404), portanto o Cron S14 não está ativo em Production.
- `AGENT_EXECUTOR_ENABLED=true` continua em Production; não foi alterado. Não publicar S14 enquanto isso não for revisado e desligado antes do release autorizado.
- Sem `SUPABASE_SECRET_KEY` no Preview, sem grants de ferramentas no staging e sem budget externo, o smoke test real deve permanecer bloqueado.
- O ledger é gravado após a resposta do provedor. O patch contabiliza o pior caso se o body 2xx falhar ao ser lido e preserva o erro de AbortSignal, mas ainda não existe reservation/outbox durável para reconciliar uma cobrança se a RPC de consumo falhar depois da resposta.
- Nenhuma chamada real ao modelo, alteração de secret, concessão de grants, migration remota, alteração de configuração Production ou merge foi realizada.
