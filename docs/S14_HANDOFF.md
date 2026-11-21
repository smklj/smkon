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


## Reconciliação operacional — 21/11/2026, 08:00 BRT (consulta direta)

Esta seção supersede contagens e estados anteriores quando houver divergência.

### GitHub, branches, PRs e validação
- PR #61 continua aberta/Draft, mas o estado atual não é o descrito no corpo antigo: head `6e26aee1f92b338ec9860a820a98a748b0dec444`, base branch atual em `564bee5a210185b04887a430fc073b95ac770bb0`; comparação `17 ahead / 5 behind`, `status=diverged`, `mergeable=false`. Não fazer merge nem forçar atualização.
- Os cinco commits que avançaram a integração desde o merge-base alteraram somente `docs/INTEGRATION_STATUS.md`, `docs/ROADMAP_SPLITS.md`, `docs/S16_HANDOFF.md`, `docs/S16_PROGRESS.md`, `tests/e2e/admin-finance.spec.mjs` e `tests/e2e/products.spec.mjs`; não há conflito de arquivo com o patch S14.
- O patch de três arquivos de código/teste da PR #61 foi portado para uma branch nova baseada na head atual da integração: `fix/s14-timeout-ledger-rebased-20261121-0800`. PR #64 foi aberta em Draft na branch rebaseada; comparação 6 ahead / 0 behind e mergeable=true. A PR #61 permanece aberta temporariamente como fallback até o CI da #64 concluir.
- CI #44892920449: sucesso nos dois jobs da PR #61 (dependency audit, typecheck, lint, unit tests, build, migrations e SQL), mas validou o head antigo `6e26aee`, não a branch rebaseada.
- Preview READY do head antigo: https://smkon-7baypxr65-smkon.vercel.app (commit `6e26aee`). Runtime log de Preview registrou `GET /api/agents/worker` com evento `unauthorized` às 10:15:58Z; foi uma requisição sem Bearer válido, portanto comprova rejeição de acesso, não execução autenticada do worker nem chamada ao modelo.
- O E2E anterior #44883164342 é de SHA anterior; não há E2E comprovado para o head atual nem para a nova branch.

### Vercel e AI Gateway
- Inventário de variáveis, sem descriptografar secrets: `AGENT_MODEL_PROVIDER=vercel-ai-gateway`, `AGENT_MODEL_AUTH=oidc`, `AGENT_MODEL=anthropic/claude-haiku-5.5`, `AGENT_MONTHLY_BUDGET_USD=5` e `AGENT_EXECUTOR_ENABLED=true` em Preview e Production.
- `CRON_SECRET` existe como sensitive separada em Preview e Production. O valor não foi lido; comprimento e whitespace não foram validados.
- `SUPABASE_SECRET_KEY` não consta no inventário de variáveis do projeto. `AI_GATEWAY_API_KEY` ausente é compatível com o modo OIDC escolhido.
- O código de `executor/model.ts` aceita o token OIDC da invocação (`x-vercel-oidc-token`) ou `VERCEL_OIDC_TOKEN`, apenas quando `AGENT_MODEL_AUTH=oidc`. O token não foi observado em execução autenticada.
- O catálogo do Gateway contém `anthropic/claude-haiku-5.5`; o catálogo atual informa preço base de US$ 0,10/1M tokens de entrada e US$ 0,50/1M tokens de saída até 100k tokens.
- `list_ai_gateway_budgets` retornou zero budgets e `defaults=true` retornou zero defaults. Uso do projeto nos últimos 7 dias: nenhuma linha, portanto zero requests/tokens/custo observados. Nenhuma chamada real está comprovada.
- `vercel.json` na integração agenda `GET /api/agents/worker` diariamente às 11:17 UTC. `vercel.json` e `src/app/api/agents/worker/route.ts` não existem em `main` (404 ao consultar os caminhos); Cron S14 não está ativo em Production.

### Supabase — leitura somente
- Staging `xoyasrizivadxnpmzzno`: 28 migrations; 94 `agent_runs`, todas `status=killed` e `error_code=kill_switch`; 0 `agent_steps`, 0 `agent_model_usage`, 0 `agent_tool_grants` e 0 conteúdos ligados por `agent_run_id`. Há uma configuração: `kill_switch=false`, limite 500 execuções/dia e 12 passos/execução.
- Production `hpplboyysmfcjsnjrdmw`: 20 migrations; 0 runs, steps, usage, grants e conteúdos ligados; nenhuma linha de `agent_settings`.
- As migrations S14 de draft, claim queue e model usage constam nos dois históricos. Nenhuma migration remota foi aplicada nesta auditoria.
- RLS está habilitado em `agent_model_usage`, `agent_runs`, `agent_steps` e `agent_tool_grants`, com uma policy em cada tabela. As RPCs `agent_claim_next_run`, `agent_draft_content`, `agent_model_spend_since` e `agent_record_model_usage` são SECURITY DEFINER e só `service_role` tem EXECUTE; `anon` e `authenticated` não têm EXECUTE. A verificação foi feita nos dois bancos.
- Ledger: zero linhas em `agent_model_usage` e zero uso no Gateway; os dois lados estão consistentes com ausência de chamadas reais. Isso não prova funcionamento do caminho de contabilização em produção.

### Bloqueios e riscos remanescentes
1. Falta `SUPABASE_SECRET_KEY` no Preview de staging; o worker não consegue criar o cliente privilegiado.
2. Não há tool grants no workspace de staging; as ferramentas `read_*` e `draft_content` não podem ser exercitadas por uma execução real.
3. Não há budget externo nem default no AI Gateway; não iniciar chamada paga antes de existir limite externo.
4. `CRON_SECRET` está presente, mas seu valor não foi lido nem validado quanto a 32+ caracteres. A requisição observada sem Bearer válido recebeu `unauthorized`.
5. A flag `AGENT_EXECUTOR_ENABLED=true` está em Production; não foi alterada. Manter sem release S14 e revisar/desligar antes de qualquer publicação autorizada.
6. O código registra uso após resposta do provedor e melhorou o pior caso em falha de leitura de body 2xx; ainda falta reservation/outbox durável para reconciliar custo se a RPC Supabase falhar após cobrança.
7. Primeiro smoke test continua bloqueado. Só executar uma única `operations_review` em staging após secret de staging, budget externo baixo, CRON_SECRET validado e grants mínimos estarem prontos.

Nenhum merge em `main`, alteração de secrets, alteração de configuração Production, migration remota, concessão de grants ou chamada paga ao modelo foi feita nesta rodada.
