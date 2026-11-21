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
| `20261119060000_agent_model_usage` | ✅ | ✅ |

## Pendências e autorizações do Owner

1. 🔐 **`SUPABASE_SECRET_KEY`** — criar a *secret key* em cada projeto Supabase e cadastrar na Vercel como *sensitive*
   (staging em Preview, produção em Production). Sem ela o worker responde `503 service_not_configured` e nada executa.
2. 🔐 **Crédito e orçamento no AI Gateway** — conferir crédito do time (sem crédito: 402 → `model_error`) e criar o
   orçamento do projeto `smkon` (US$ 5/mês) como segunda barreira, independente do teto no código.
3. ✅ **Migration `20261119060000_agent_model_usage` na produção** — list_migrations confirmou a migration nos dois projetos em 21/11/2026; o bloqueio de consumo agora é operacional (credencial do worker, budget externo e grants), não DDL.
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


## Auditoria complementar — 21/11/2026, 05:00 BRT

### Estado GitHub e integração

- Etapas S14 1–9 permanecem integradas na branch `feature/smkon-production-readiness` pelos PRs #35–#42 e #46; conferência atual: todos fechados e mergeados.
- O PR #58 continua aberto/Draft. Head observado: `8f3b5f97428176e6fabc31536df9c00ec0286d26`; base observado: `7ab9b864336b822cb6b86892a6b96f109b9b715d`. A comparação está **divergida: 19 commits à frente e 10 atrás**, `mergeable=false`. A divergência veio de avanços recentes da integração após o merge-base `011accdb`; não forçar merge/rebase.
- Para remover a divergência sem transportar os commits alheios do branch antigo, a correção determinística de `run.ts` foi portada para um branch novo baseado no SHA atual da integração: `fix/s14-deadline-timeout-sync-20261121`. Este branch contém a mesma correção de timeout; aguarda CI e revisão num PR separado.

### CI e Preview

- CI #44878822439 no head antigo `8f3b5f97`: **success** nos dois jobs. Quality: audit de dependências, typecheck, lint, unit tests e build. Database: migrations e SQL tests.
- Check Vercel para esse SHA: **success**; deployment Preview READY: https://smkon-ncou79p43-smkon.vercel.app.
- Playwright #44868983047 terminou **success**, mas foi executado no commit anterior `d4055dae`, não no SHA `8f3b5f97`. Não atribuir esse E2E ao head atual; repetir no Preview do branch sincronizado quando disponível.

### Vercel / AI Gateway

- Variáveis não secretas observadas em Preview e Production: `AGENT_MODEL_PROVIDER=vercel-ai-gateway`, `AGENT_MODEL_AUTH=oidc`, `AGENT_MODEL=anthropic/claude-haiku-5.5`, `AGENT_MONTHLY_BUDGET_USD=5`, `AGENT_EXECUTOR_ENABLED=true`.
- `CRON_SECRET` está cadastrado como sensitive nos dois ambientes; valor não lido e comprimento mínimo de 32 caracteres não validado. `SUPABASE_SECRET_KEY` não aparece no projeto Vercel. `AI_GATEWAY_API_KEY` ausente é esperado no modo OIDC.
- O catálogo atual do AI Gateway contém `anthropic/claude-haiku-5.5` com preço base de US$ 0,10/1M tokens de entrada e US$ 0,50/1M tokens de saída até 100k tokens; os valores locais em `model-pricing.ts` coincidem para essa faixa.
- Budget do projeto e budgets default do AI Gateway: **nenhum**. Uso agregado do projeto nos últimos 7 dias: **zero requests, tokens e custo**. Não há chamada real comprovada.
- O código recebe o token OIDC pelo header `x-vercel-oidc-token` e envia-o como Bearer ao Gateway. A documentação oficial da Vercel confirma que Functions recebem esse header; ver https://vercel.com/docs/oidc e https://vercel.com/docs/ai-gateway/authentication-and-byok.
- O teto interno é **suave**: `runWorkerTick` relê o gasto antes de cada reserva, mas não antes de cada chamada do modelo; a execução atual pode fazer Planner e Verifier mesmo se o gasto cruzar o teto na primeira chamada. Além disso, uma interrupção após resposta 2xx e antes da RPC de registro pode deixar custo sem linha. O budget externo é bloqueador para o primeiro teste real.
- `vercel.json` agenda `GET /api/agents/worker` diariamente às 11:17 UTC. Cron Vercel não executa em Preview; o cron de produção só passa a existir com a rota publicada em Production.

### Supabase — leitura somente

- Staging `xoyasrizivadxnpmzzno`: 26 migrations; `agent_runs=85`, todas com status `killed`; `agent_steps=0`; `agent_model_usage=0`; `content_items` com `agent_run_id` = 0. `agent_settings.kill_switch=false`, limites atuais 500 execuções/dia e 12 passos/execução. `agent_tool_grants=0`, portanto nenhuma ferramenta read/draft está liberada no workspace inspecionado.
- Production `hpplboyysmfcjsnjrdmw`: 20 migrations; `agent_runs=0`, `agent_steps=0`, `agent_model_usage=0`. As três migrations S14 (`agent_draft_content`, `agent_claim_queue`, `agent_model_usage`) estão presentes nos dois ambientes; não foi aplicada migration nesta auditoria.
- ACL staging de `agent_model_usage`: RLS habilitado; anon sem SELECT e sem EXECUTE da RPC de registro; authenticated SELECT sob policy; service_role sem INSERT direto e com EXECUTE apenas pela RPC de registro. A tabela tem zero linhas.

### Critérios e bloqueios

- **Implementado:** etapas S14 1–9 e UI de detalhe integradas na branch de preparação; correção determinística de timeout portada para branch baseada no head atual da integração.
- **Validado:** CI #44878822439 e check Vercel do head antigo passaram. E2E #44868983047 passou no SHA anterior; novo E2E ainda precisa ser executado no Preview do branch sincronizado.
- **Não operacional:** faltam `SUPABASE_SECRET_KEY` de staging no Preview, budget externo do AI Gateway, confirmação do comprimento de `CRON_SECRET` e grants de ferramentas no workspace. Nenhuma chamada real foi feita; consumo permanece zero.
- Antes do smoke test: Owner deve cadastrar a secret de staging como sensitive em Preview, criar budget externo baixo para o projeto, validar `CRON_SECRET` (32+ caracteres) sem compartilhar o valor e conceder somente as ferramentas necessárias a `operations_review`. Depois executar uma única run e conferir resposta do Gateway, passos, status final e registros de consumo (plan/verify) em `agent_model_usage`.
- Não houve merge em `main`, alteração de secrets, mudança de configuração Production, migration remota ou escrita de dados. Manter Production sem release S14 até concluir os gates.


## Auditoria operacional complementar — 21/11/2026, 06:01 BRT

### GitHub, PRs e validação

- PR #61 (fix/s14-deadline-timeout-sync-20261121) permanece aberto/Draft, mergeable=true, 4 commits à frente e 0 atrás da base feature/smkon-production-readiness (base SHA 7ab9b864). Head após a correção de contabilização: d9ff3869f84970684a043ca6c530e0e13ed3a5ed.
- PR #58 foi fechado sem merge como superseded pelo PR #61; o patch necessário e as atualizações de handoff/progresso/roadmap estão na branch limpa.
- CI #44887809941 no commit de código d9ff3869: success nos dois jobs (dependency audit, typecheck, lint, unit tests, build, migrations e SQL). E2E #44883164342 passou em staging isolado no commit anterior e0faaa29; não foi repetido no patch mais recente. CI #44883123910 também passou no head anterior.
- Preview READY anterior para o commit documental 5ed2e23a: https://smkon-mwkvooege-smkon.vercel.app. Preview READY anterior para o commit de código e0faaa29: https://smkon-pgxv2rqbn-smkon.vercel.app. O check Vercel do commit de código d9ff3869 falhou por build-rate-limit; não há Preview do patch de contabilização nem do head documental atual. Não é falha de build do código.

### Correção adicional de contabilização

- model-gateway.ts: se uma resposta HTTP 2xx chega, mas a leitura do body stream falha, o adaptador agora registra o custo conservador de pior caso (tokens de entrada estimados + teto de saída) antes de falhar com gateway_body_read_failed.
- tests/unit/agents-budget.test.ts: teste sem rede garante que a falha de leitura de body em 2xx tenta registrar uso conservador.
- Commits: 3f2a9bbef6abc0a732bf6a6230c03015d88427bc (código) e d9ff3869f84970684a043ca6c530e0e13ed3a5ed (teste).
- Limite residual: se a chamada ao Gateway for cobrada e a RPC Supabase de registro estiver indisponível, não há reservation/outbox durável para reconciliar automaticamente esse custo. A chamada falha fechada, mas o ledger pode ficar incompleto; não declarar contabilização financeira perfeita até implementar reconciliação/reserva.

### Vercel e AI Gateway

- Variáveis não secretas em Preview e Production: AGENT_MODEL_PROVIDER=vercel-ai-gateway, AGENT_MODEL_AUTH=oidc, AGENT_MODEL=anthropic/claude-haiku-5.5, AGENT_MONTHLY_BUDGET_USD=5, AGENT_EXECUTOR_ENABLED=true.
- CRON_SECRET existe como sensitive em Preview e Production. O valor não foi exposto; validação interna confirmou pelo menos 32 caracteres e ausência de espaços nas pontas em ambos os ambientes.
- SUPABASE_SECRET_KEY não existe no inventário de variáveis do projeto; AI_GATEWAY_API_KEY ausente é esperado no modo OIDC.
- AI Gateway: nenhum budget de projeto/time/default cadastrado; uso agregado dos últimos 7 dias sem requests, tokens ou custo. Portanto não há chamada real comprovada ao modelo.
- vercel.json agenda o worker diariamente às 11:17 UTC, mas src/app/api/agents/worker/route.ts e vercel.json não existem na branch main; o Cron S14 não está publicado/ativo em Production. Não foi feita alteração de Production.

### Supabase — leitura somente

- Staging xoyasrizivadxnpmzzno: 26 migrations; 88 agent_runs, todas killed; 0 agent_steps, 0 agent_model_usage, 0 rascunhos vinculados a agente e 0 agent_tool_grants. agent_settings: kill_switch=false, 500 execuções/dia e 12 passos/execução.
- Production hpplboyysmfcjsnjrdmw: 20 migrations; 0 runs, steps, usage, rascunhos ou grants; nenhuma linha em agent_settings.
- As três migrations S14 (agent_draft_content, agent_claim_queue, agent_model_usage) constam em ambos os históricos de migrations. Nenhuma migration remota foi aplicada nesta rodada.

### Bloqueios e decisão

- Teste real de operations_review continua bloqueado: falta SUPABASE_SECRET_KEY em Preview e não há budget externo; além disso, o workspace de staging auditado não tem grants para ferramentas de leitura/rascunho.
- Não executar chamada paga, não conceder grants automaticamente e não habilitar worker real sem esses controles.
- Nenhuma escrita em Supabase, alteração de secret/configuração Vercel, merge em main ou mudança de Production nesta rodada.
