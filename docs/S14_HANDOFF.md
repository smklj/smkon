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
3. ✅ **Migration `20261119060000_agent_model_usage`** — aplicada em staging e produção, confirmada por `list_migrations` em 21/11/2026. Não é bloqueio atual.
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


## Reconciliação operacional — 21/11/2026, 09:55 BRT

Esta seção supersede os estados anteriores de configuração e banco que divergirem dos dados consultados nesta auditoria.

### GitHub e validação
- A PR #67 (head `d6b5880c0bff0cf14f402755106d930022ca760d`) está aberta em Draft, mas a comparação atual com `feature/smkon-production-readiness` retorna `diverged`: 2 commits à frente e 8 atrás; `mergeable=false`. O corpo da PR está desatualizado e não deve ser usado como prova de mergeability.
- A PR #71 foi criada como reaplicação limpa sobre a head da integração `16bd6b009a64884fadccbfa5afc47d40ccb11eae`. Branch `fix/s14-timeout-ledger-rebase-20261121-0955`: 3 commits à frente, 0 atrás; comparação `ahead`, sem divergência; Draft e mergeable. CI #44906510584 estava em execução no momento desta auditoria. Não há resultado de CI herdado de outra PR.
- A #67 permanece aberta como fallback até o CI da #71 concluir; nenhuma PR foi mergeada.

### Código reaplicado na #71
- `executor/run.ts`: captura se o timeout por passo ou o deadline total limitou cada chamada antes de iniciar a operação; a classificação não depende do relógio observado após o disparo do timer.
- `executor/model-gateway.ts`: em resposta HTTP 2xx com falha de leitura do body, tenta gravar o custo conservador de pior caso antes de falhar; preserva o erro do AbortSignal se o registro concluir.
- `tests/unit/agents-budget.test.ts`: dois testes sem rede para falha de stream e abort durante a leitura.
- Nenhuma chamada real ao modelo foi feita pelos testes.

### Supabase — consultas somente de leitura
- Staging `xoyasrizivadxnpmzzno`: 29 migrations. As migrations `agent_draft_content`, `agent_claim_queue` e `agent_model_usage` constam no histórico.
- Produção `hpplboyysmfcjsnjrdmw`: 20 migrations. As mesmas três migrations S14 também constam no histórico; a migration de usage não está pendente em produção.
- Staging: 100 `agent_runs`, todas `killed` com `kill_switch`; 0 `agent_steps`, 0 `agent_model_usage`, 0 `agent_tool_grants` e 0 conteúdos com `agent_run_id`.
- Produção: 0 runs, steps, usage, tool grants e drafts vinculados a agentes.
- Em staging, RLS está habilitado nas tabelas `agent_runs`, `agent_steps`, `agent_model_usage` e `agent_tool_grants`. `anon` não tem SELECT; `authenticated` tem SELECT sob RLS; `service_role` não tem INSERT/UPDATE/DELETE direto. As RPCs de claim, draft e usage consultadas só permitem EXECUTE a `service_role`.

### Vercel e AI Gateway
- Inventário do projeto `smkon`: `AGENT_MODEL_PROVIDER=vercel-ai-gateway`, `AGENT_MODEL_AUTH=oidc`, `AGENT_MODEL=anthropic/claude-haiku-5.5`, `AGENT_MONTHLY_BUDGET_USD=5` e `AGENT_EXECUTOR_ENABLED=true` em Preview e Production.
- `SUPABASE_SECRET_KEY` não aparece no inventário de variáveis do projeto. O worker não pode criar o cliente de serviço no Preview sem essa variável.
- `CRON_SECRET` está cadastrado como sensitive em Preview e Production. O conector não fornece o valor descriptografado, então comprimento mínimo de 32 caracteres e ausência de whitespace não foram validados.
- OIDC: a configuração está explícita e o código lê `x-vercel-oidc-token` da Request. A documentação oficial da Vercel confirma que Functions recebem o token nesse header; isso valida o mecanismo de integração, não uma autenticação real neste deployment. Não houve invocação autenticada que comprovasse o token em runtime.
- AI Gateway: nenhum budget do projeto e nenhum default configurado; uso agregado do projeto nos últimos 7 dias sem requests, tokens ou custo. O catálogo atual contém `anthropic/claude-haiku-5.5`.
- O teto interno de US$ 5 é verificado antes das reservas, não é budget externo do provedor. Ainda não há reservation/outbox durável para reconciliar cobrança se a RPC do ledger falhar após a resposta.

### Cron e operação
- A integração contém `vercel.json` com `17 11 * * *` e a rota `/api/agents/worker`; ambos não existem em `main`. O Cron configurado via `crons` não está ativo em produção. A Vercel documenta que Cron Jobs executam somente em deployments de produção.
- `AGENT_EXECUTOR_ENABLED=true` continua em Preview e Production; nenhuma alteração de configuração foi feita. Antes de qualquer release, Production deve permanecer desabilitada até a aprovação operacional.
- Nenhuma chamada real ao AI Gateway foi comprovada. Os zeros de uso agregado e de `agent_model_usage` são consistentes com ausência de chamadas, mas não validam o fluxo pós-cobrança.
- Não houve migration remota, concessão de grants, alteração de secrets, mudança de configuração de Production ou merge.

### Bloqueios para o primeiro teste real
1. Cadastrar a chave de serviço exclusiva do projeto de staging em Preview como sensitive.
2. Configurar budget externo limitado no AI Gateway (sem alterar o escopo de Production sem autorização).
3. Validar `CRON_SECRET` sem revelar o valor.
4. Conceder grants mínimos de leitura para `operations_review` em staging.
5. Obter Preview do head #71, executar E2E e somente então fazer uma execução real controlada; conferir resposta, steps, verifier e ledger.


## Atualização de CI e branch — 21/11/2026, 10:00 BRT

- PR #71 agora está 7 commits à frente e 0 atrás da head de integração `16bd6b009a64884fadccbfa5afc47d40ccb11eae`; comparação `ahead`, Draft e mergeable. Head atual: `c2454be94a6f221502f768ed917f636c73cdbaaf`.
- O primeiro CI disparado na PR (#44906510584, synthetic merge da head anterior) falhou no typecheck: `planTimeout`, `toolTimeout` e `summaryTimeout` estavam declarados dentro dos blocos `try`, mas usados nos respectivos `catch`. O job de migrations/SQL passou.
- Corrigi o escopo no commit `c2454be`, declarando cada budget antes do `try`. Esse commit ainda aguarda uma execução CI própria; não atribuir a ele o resultado do run anterior.
- O check Vercel segue falhando por `api-deployments-free-per-day`; o inventário de deployments da branch #71 continua vazio (nenhum Preview criado). E2E do head atual não executado.
- PR #67 continua aberta em Draft, mas a comparação atual é divergente (2 commits à frente/8 atrás, mergeable=false). Mantida como fallback até o CI atual da #71 concluir.


## Fechamento de validação desta rodada — 21/11/2026, 10:05 BRT

### CI do código
- CI #44906765030: **success** nos dois jobs. O job de qualidade passou por dependency audit, typecheck, lint, testes unitários e build; o job de banco passou por migrations e testes SQL em Postgres descartável.
- O run foi disparado pela PR de revalidação #73, mas testou o mesmo head SHA `4524a723f359cfc1b1e2c053eb8f7da208100fa6` da PR principal #71. Os commits posteriores nesta branch são somente documentação; nenhum código/teste mudou depois do SHA validado.
- PR #71 permanece a PR principal: Draft, mergeable, 10 commits à frente e 0 atrás da integração no momento da comparação. PR #73 foi fechada como duplicata de validação; PR #67 é substituída pela #71.

### Verificação de arquitetura S14
- `read_*` recebe `organizationId` do RunContext, nunca do modelo; colunas são allowlisted, máximo 50 itens e 60 KB de saída.
- `draft_content` chama somente a RPC `agent_draft_content` e rejeita qualquer resultado cujo status não seja `draft`; não aprova, agenda ou publica.
- Verifier determinístico exige evidência `verified` observada na execução para afirmações sobre produto.
- Worker limita cada tick a 3 runs, orçamento de 120 s e hard limit de 270 s; a rota declara maxDuration de 300 s. O teto financeiro é verificado antes de cada reserva, portanto continua sendo um limite suave por execução, não uma reserva atômica por chamada.
- A tabela local de preço para `anthropic/claude-haiku-5.5` coincide com o catálogo atual do Gateway na faixa até 100.000 tokens; o código adiciona margem de 10%.

### Supabase Security Advisors — achados adicionais (não alterados)
- Staging: 4 tabelas com RLS sem policy (`mercado_livre_credentials`, `mercado_livre_oauth_attempts`, `mercado_livre_order_sync_state`, `rate_limit_buckets`); Production: 1 (`rate_limit_buckets`). Nenhuma delas é uma das quatro tabelas S14 auditadas.
- Ambos os ambientes: `rate_limit_consume` é SECURITY DEFINER executável por `anon`; advisor também lista SECURITY DEFINER executáveis por `authenticated` (34 staging / 31 produção). Os controles S14 listados (`agent_start_run`, `agent_cancel_run`, `agent_set_kill_switch`, `agent_set_tool`, `agent_update_limits`) foram inspecionados na migration e chamam `agent_require_role` com papéis owner/admin adequados. Os warnings genéricos ainda devem ser revisados no hardening global; não foram alterados neste escopo.
- Leaked Password Protection do Supabase Auth está desabilitado em staging e produção; achado geral, não específico do S14.
- As quatro tabelas S14 auditadas têm RLS nos dois bancos; `anon` não tem SELECT, `authenticated` lê sob RLS, e as RPCs de claim/draft/usage consultadas só permitem EXECUTE a `service_role`.

### Bloqueios que continuam
- Preview da branch #71 não foi criado: check Vercel falha com `api-deployments-free-per-day`; E2E do head atual não executado.
- `SUPABASE_SECRET_KEY` continua ausente no inventário Vercel; `CRON_SECRET` está sensitive em Preview e Production, mas seu valor não é disponibilizado para validar tamanho/whitespace.
- `AGENT_EXECUTOR_ENABLED=true` em Preview e Production; sem alteração. Manter Production desabilitada antes de qualquer release do S14.
- Sem budget externo do AI Gateway; sem requests, tokens ou custo nos últimos 7 dias; `agent_model_usage` continua vazio nos dois bancos. Não há chamada real comprovada.
- Staging tem 0 grants de ferramenta; por isso não há teste real de `operations_review` nem de leitura/rascunho.
- `vercel.json` e rota do worker não existem em `main`; Cron S14 não ativo em Production.
- Nenhuma alteração de Production, migration remota, secret, grant ou chamada paga foi executada.


## Reconciliação operacional — 21/11/2026, 11:03 BRT

Esta seção supersede as contagens e os estados operacionais anteriores quando divergirem. Consultas realizadas nesta rodada foram somente de leitura.

### GitHub, branches e CI
- PR [#71](https://github.com/smklj/smkon/pull/71) permanece aberta em Draft, sem reviews submetidas e sem threads de revisão. Branch `fix/s14-timeout-ledger-rebase-20261121-0955`; head documental atual `3f3825612237d42c9693078f1072bb4e007e76eb`; comparação com `feature/smkon-production-readiness`: **16 commits à frente, 0 atrás**, status `ahead`, sem divergência.
- O código validado está no SHA `4524a723f359cfc1b1e2c053eb8f7da208100fa6`. A comparação desse SHA com o head atual mostra somente três arquivos de documentação alterados (`S14_HANDOFF.md`, `S14_PROGRESS.md`, `ROADMAP_SPLITS.md`); nenhum código ou teste mudou depois do SHA validado.
- CI [#44907103115](https://github.com/smklj/smkon/actions/runs/44907103115): **success nos dois jobs no head documental atual**. Qualidade: dependency audit, typecheck, lint, testes unitários e build. Banco: migrations e testes SQL em Postgres descartável. Os runs #44906765030 e #44906795669 também passaram no SHA de código `4524a723`.
- PRs #67 e #73 estão fechadas sem merge (#67 substituída; #73 duplicata de validação). PR #71 é a PR ativa deste patch; nenhuma alteração foi incorporada à `main`.
- O check Vercel da PR #71 falhou com `api-deployments-free-per-day`; o inventário de deployments para a branch #71 retorna zero Preview. E2E do head atual não foi executado.

### Supabase — estado atual
- `list_migrations`: staging `xoyasrizivadxnpmzzno` tem 29 migrations; produção `hpplboyysmfcjsnjrdmw` tem 20. As três migrations S14 (`agent_draft_content`, `agent_claim_queue`, `agent_model_usage`) constam **nos dois ambientes**. A migration de usage não está pendente em produção.
- Staging: 101 `agent_runs`, todas `status=killed` e `error_code=kill_switch`; 0 `agent_steps`, 0 `agent_model_usage`, 0 `agent_tool_grants` e 0 conteúdos vinculados a agentes com status draft.
- Produção: 0 `agent_runs`, 0 steps, 0 usage, 0 tool grants e 0 drafts vinculados a agentes.
- Em staging, `agent_settings` informa um workspace, `kill_switch=false`, limite de 500 runs/dia e 12 steps/run.
- RLS está habilitado e há uma policy em cada uma das cinco tabelas auditadas (`agent_runs`, `agent_steps`, `agent_model_usage`, `agent_tool_grants`, `agent_settings`) nos dois ambientes. `anon` não tem SELECT; `authenticated` tem SELECT sujeito a RLS; `service_role` tem SELECT, mas não INSERT/UPDATE/DELETE direto nessas tabelas.
- As RPCs `agent_claim_next_run`, `agent_draft_content`, `agent_record_model_usage`, `agent_model_spend_since` e `agent_reap_stale_runs` só permitem EXECUTE a `service_role` nos dois bancos.

### Vercel e AI Gateway
- Inventário do projeto `smkon`: `AGENT_MODEL_PROVIDER=vercel-ai-gateway`, `AGENT_MODEL_AUTH=oidc`, `AGENT_MODEL=anthropic/claude-haiku-5.5`, `AGENT_MONTHLY_BUDGET_USD=5` e `AGENT_EXECUTOR_ENABLED=true` em Preview e Production.
- `SUPABASE_SECRET_KEY` não aparece no inventário de variáveis; o worker não consegue criar o cliente `service_role` em Preview. O handler falha fechado com `503 service_not_configured` depois de autenticar o cron, resolver o modelo e validar o teto.
- `CRON_SECRET` existe como sensitive em Preview e Production. O conector foi consultado sem descriptografar valores; comprimento mínimo de 32 caracteres e ausência de whitespace permanecem não verificados.
- O código lê `x-vercel-oidc-token` da requisição quando `AGENT_MODEL_AUTH=oidc`; o mecanismo está implementado, mas não foi comprovado em runtime por uma chamada autenticada.
- Catálogo atual do AI Gateway contém `anthropic/claude-haiku-5.5`. Uso agregado do projeto nos últimos 7 dias: sem requests, tokens ou custo. Budgets do time/projeto/membro/chave: nenhum; defaults: nenhum.
- `agent_model_usage` permanece vazio nos dois bancos. Isso é consistente com a ausência de requests agregados; **não existe chamada real comprovada ao modelo**.
- O teto interno de US$ 5 é verificado antes de cada reserva e continua suave; não há budget externo nem reservation/outbox durável para reconciliar uma cobrança se o registro do ledger falhar após a resposta.

### Cron e bloqueios para o teste real
- A branch de integração contém `vercel.json` com cron diário `17 11 * * *` e `/api/agents/worker`. Ambos os caminhos retornam 404 em `main`; portanto, o Cron S14 não está ativo em produção.
- Staging tem zero tool grants; não há autorização para executar ferramentas `read_*` nem `draft_content` no workspace auditado.
- Bloqueios restantes: cadastrar a secret key exclusiva do staging como sensitive em Preview; definir budget externo restrito sem afetar Production; validar `CRON_SECRET` por verificação segura sem revelar o valor; conceder grants mínimos aprovados para `operations_review`; obter Preview READY e E2E do head atual; então executar uma única operação real e conferir resposta, steps, verifier e ledger.
- Nenhuma secret foi lida/descriptografada, criada ou alterada; nenhum grant foi concedido; nenhuma chamada paga foi feita; nenhuma migration remota, alteração de Production ou merge foi executado.


## Preview publicado — 21/11/2026, 11:10 BRT

- Deployment Vercel `dpl_7Y2X2ASZNDATjjH9GShEqTTLUVNt` ficou **READY** para o commit `ae38e7fce4d8631f7d7cd0dfb56f7e8caa43bcd0`, branch `fix/s14-timeout-ledger-rebase-20261121-0955`.
- URL: https://smkon-rkuyrnpoz-smkon.vercel.app (alias de branch: https://smkon-git-fix-s14-timeout-ledger-rebase-20261121-0955-smkon.vercel.app).
- Build: Next.js 16.4.6, compilação concluída; npm install auditou 363 pacotes e reportou 0 vulnerabilidades. O check Vercel no commit `ae38e7f` passou.
- CI [#44912351788](https://github.com/smklj/smkon/actions/runs/44912351788): success nos dois jobs no mesmo SHA `ae38e7f` (typecheck, lint, unit tests, build, migrations e SQL).
- O workflow E2E está configurado para disparar em `deployment_status` quando o Preview fica READY, mas não foi encontrado um resultado E2E associado a este deployment/head nesta consulta. Logs de runtime do deployment estavam vazios no momento da auditoria; portanto, não afirmar que o E2E rodou.
- O Preview usa a URL do Supabase de staging. A prontidão do build não significa que o worker está operacional: `SUPABASE_SECRET_KEY` continua ausente, staging tem zero tool grants e não há budget externo do AI Gateway.
- Nenhuma chamada ao worker/modelo, alteração de Production, secret, grant, migration remota ou merge foi executado nesta etapa.
