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


## Reconciliação operacional S14 — 21/11/2026 15:00 BRT
Esta seção supersede snapshots anteriores quando houver divergência. Consultas desta rodada: GitHub compare/PR/Actions, Vercel environment inventory/deployments/AI Gateway e Supabase migrations/SQL somente de leitura. Nenhum secret foi exibido.

### GitHub, branches e validação
- A PR #78 estava aberta em Draft, mas o compare real contra a base atual feature/smkon-production-readiness em 9dbf6cb9 retornou **diverged: 16 commits à frente / 2 atrás**; mergeable=false. O texto antigo de 16/0 estava desatualizado.
- Os dois commits da base após 2455806c alteraram somente docs/INTEGRATION_STATUS.md; não tocaram nos quatro arquivos de código/teste S14. As quatro correções foram reaplicadas sobre 9dbf6cb9 em fix/s14-timeout-ledger-rebased-20261121-1500, PR #82 (Draft, sem merge).
- PR #78 foi encerrada sem merge após a abertura da PR #82. Nenhum código foi incorporado à base ou à main.
- CI #44928561395 passou nos dois jobs no head antigo 7fd5dfb0 da PR #78: typecheck/lint/build/audit/unit tests e migrations/SQL tests. Esse CI não é evidência do novo head da PR #82; o CI próprio da #82 deve ser aguardado.
- O check Vercel do head antigo falhou por build-rate-limit; a listagem de deployments da branch antiga retornou zero. Preview e E2E do SHA da PR #82 ainda pendentes.
- PRs #75 (S4), #79 (governança documental) e #81 (Frente B) são escopos separados; não foram incorporadas ao S14. Os nove splits S14 originais (#35–#42 e #46) permanecem integrados na branch de integração.

### Código S14 revisado
- model-gateway.ts: em resposta HTTP 2xx com falha de leitura do body, tenta registrar tokens/custo conservadores antes de falhar; erros de stream e AbortSignal têm testes sem rede.
- run.ts: captura o limite que restringiu o passo antes do timeout, distinguindo step_timeout de worker_timeout sem depender da corrida do timer.
- Testes alterados: agents-budget.test.ts e agents-executor.test.ts.
- O fluxo Planner → Executor → Verifier, ferramentas read_*, draft_content e worker continuam implementados na integração. As ferramentas leem sob o organization_id do run; o rascunho é a única escrita de ferramenta e permanece status='draft'; o Verifier exige evidência verificada para afirmações sobre produtos. Nenhuma publicação automática.

### Supabase — estado consultado
- Staging xoyasrizivadxnpmzzno: ACTIVE_HEALTHY, região sa-east-1, 29 migrations. Produção hpplboyysmfcjsnjrdmw: ACTIVE_HEALTHY, região us-west-2, 20 migrations.
- Staging: 113 agent_runs, todas killed; 0 agent_steps; 0 agent_model_usage; 0 agent_tool_grants; 1 agent_settings; 0 content_items com agent_run_id.
- Configuração de staging: kill_switch=false, max_runs_per_day=500, max_steps_per_run=12. O workspace auditado continua sem grants.
- Produção: 0 runs, steps, usage, grants, settings e conteúdos vinculados.
- RLS está ativo em agent_runs, agent_steps, agent_model_usage, agent_tool_grants, agent_settings (1 policy cada) e content_items (4 policies). anon não tem SELECT; authenticated tem SELECT sujeito a RLS. service_role tem SELECT, mas sem DML direto nas cinco tabelas de agentes. Em content_items, service_role tem DML direto; a ferramenta de rascunho ainda chama a RPC dedicada.
- Os três nomes de migrations S14 existem nos dois ambientes, mas os version IDs diferem: staging 20261119101353 agent_draft_content, 20261119101414 agent_claim_queue, 20261119114718 agent_model_usage; produção 20261119040000, 20261119050000, 20261119060000. Isso prova divergência de histórico, não por si só de schema. Não executar repair/db push sem comparar definições e backup.

### Vercel, OIDC, AI Gateway e Cron
- Inventário não secreto: AGENT_MODEL_PROVIDER=vercel-ai-gateway, AGENT_MODEL_AUTH=oidc, modelo anthropic/claude-haiku-5.5, teto interno AGENT_MONTHLY_BUDGET_USD=5.
- SUPABASE_SECRET_KEY não aparece no inventário do projeto. CRON_SECRET existe como sensitive separadamente em Preview e Production; a API de leitura não disponibilizou o valor, portanto comprimento mínimo de 32 e ausência de whitespace não foram validados.
- AGENT_EXECUTOR_ENABLED=true está configurado em Preview e Production. Não foi alterado. Antes de qualquer release em Production, manter/desligar essa flag até todos os gates operacionais estarem aprovados.
- O código aceita OIDC somente com opt-in explícito AGENT_MODEL_AUTH=oidc, usando x-vercel-oidc-token da invocação ou VERCEL_OIDC_TOKEN. A configuração existe, mas o token e a autenticação em runtime ainda não foram comprovados.
- Catálogo do Gateway confirma o modelo. Uso agregado do projeto nos últimos 7 dias: nenhuma linha (0 requests/tokens/custo). Budgets de team, project e defaults: nenhum.
- agent_model_usage tem 0 linhas nos dois bancos, coerente com 0 requests/tokens/custo agregados; nenhuma chamada real ao AI Gateway foi comprovada.
- O limite interno é soft e consultado antes de cada claim; não há reserva atômica por chamada nem outbox durável para reconciliar cobrança se a RPC falhar depois da resposta.
- vercel.json da integração declara 17 11 * * * para /api/agents/worker (08:17 BRT). A rota e o arquivo estão ausentes de main; portanto esse Cron não está ativo no deployment Production atual.

### Bloqueio para teste real controlado
Não executar operations_review enquanto faltarem: (1) chave de serviço exclusiva de staging; (2) grants mínimos de leitura; (3) budget externo com escopo isolado de Production; (4) validação segura do CRON_SECRET; (5) Preview do SHA exato e E2E correspondente. Sem isso, não existe evidência de chamada real nem base segura para reconciliar custo.

### Segurança
Nenhum merge, alteração em main/Production, migration remota, alteração de secret, concessão de grant, criação de budget de escopo compartilhado ou chamada paga ao modelo foi executada.


## Atualização pós-Preview da PR #82 — 21/11/2026 15:08 BRT

- PR #82 está aberta em Draft, mergeable=true; compare real: 1 commit à frente / 0 atrás da base 9dbf6cb9. PR #78 foi fechada sem merge.
- CI próprio do head 46a6d1f5: [#44933511061](https://github.com/smklj/smkon/actions/runs/44933511061), sucesso nos dois jobs; 288/288 testes unitários, dependency audit, typecheck, lint, build e migrations/testes SQL.
- Preview READY para o SHA exato 46a6d1f5: https://smkon-biemu0r7c-smkon.vercel.app (deployment dpl_AWf8HaAnCGR4FotuTT6qfRtWnWK1).
- E2E [#44933605001](https://github.com/smklj/smkon/actions/runs/44933605001) foi disparado pelo evento deployment_status no mesmo SHA. A etapa Check E2E configuration passou (secrets de QA configurados, valores não lidos); a suíte Playwright continua em execução no último snapshot, sem conclusão disponível. Não declarar E2E aprovado.
- A suíte E2E de agentes cria uma execução de fila e liga/desliga o kill switch para validar a interrupção; isso não chama o modelo. Após o início da suíte, staging registra 114 agent_runs, todas killed; 0 agent_steps, 0 agent_model_usage, 0 tool grants e 0 content_items vinculados. agent_settings permanece kill_switch=false, max_runs_per_day=500, max_steps_per_run=12.
- Runtime logs do deployment Preview exato não mostram invocações de /api/agents/worker no intervalo consultado. AI Gateway permanece sem linhas de uso nas últimas 24 h; agent_model_usage segue vazio. Nenhuma chamada real ao modelo foi comprovada.
- Bloqueios para teste real permanecem: SUPABASE_SECRET_KEY ausente no inventário Vercel; tool grants zero; nenhum budget externo; CRON_SECRET sensitive sem leitura/validação de tamanho; OIDC configurado, mas token/autenticação em runtime não comprovados. Não executar operations_review real.
- A nova documentação é docs-only após o SHA de código validado. Se a Vercel criar novo Preview para este commit documental, ele não substitui a evidência de código já validada em 46a6d1f5; o E2E acima é o deployment exato desse SHA.


## Reconciliação pós-E2E S14 — 21/11/2026 16:07 BRT

Esta seção supersede snapshots anteriores quando houver divergência. Evidências desta rodada: GitHub PR/compare/Actions, Vercel deployment/env inventory/AI Gateway e Supabase migrations/SQL somente de leitura. Nenhum secret foi exibido.

### GitHub e branches
- PR #82 permanece aberta em Draft, mergeable=true, sem reviews e sem threads de revisão. Compare real contra feature/smkon-production-readiness: 2 commits à frente / 0 atrás; base SHA 9dbf6cb9. Head documental consultado: 769d0756.
- PR #78 foi fechada sem merge após o compare apontar divergência. PR #82 contém as correções reaplicadas; nenhum merge foi realizado nesta rodada.
- Os nove splits S14 originais (#35–#42 e #46) permanecem integrados na branch de integração. PRs #75 (S4), #79 (governança) e #81 (Frente B) são escopos separados.
- Reviews e review threads da PR #82: nenhuma pendente.

### CI, Preview e E2E
- CI de código #44933511061: sucesso nos dois jobs no SHA 46a6d1f5; 288/288 testes unitários, dependency audit, typecheck, lint, build Next.js, migrations e testes SQL.
- CI documental #44933893554: sucesso nos dois jobs no head documental 769d0756.
- Preview READY do código S14: https://smkon-biemu0r7c-smkon.vercel.app — deployment dpl_AWf8HaAnCGR4FotuTT6qfRtWnWK1, branch fix/s14-timeout-ledger-rebased-20261121-1500, SHA 46a6d1f5b12eb2e5a8fdcd543a8a839ed930a68e.
- E2E Playwright #44933605001: concluído com sucesso, 36/36 testes em 3,6 min no Preview/SHA exato 46a6d1f5. Inclui agents.spec.mjs: limites, criação de run na fila e interrupção pelo kill switch; também CSP, navegação, autenticação, produtos e Content Studio. Artefato: https://github.com/smklj/smkon/actions/runs/44933605001/artifacts/14719220504.
- O E2E valida fila/kill switch e UI, não chama o modelo nem comprova o worker processando uma run com IA.
- O deployment mais recente do projeto no instante da consulta é de outra frente (S19, branch feature/s19-social-metricool-approvals, SHA b99392a6) e estava BUILDING; não confundir com o Preview S14 READY acima.
- Consulta de runtime logs do deployment S14 nos últimos 30 minutos não encontrou registros de /api/agents/worker. Isso não substitui teste de execução autenticada.

### Supabase — estado atual
- Staging xoyasrizivadxnpmzzno: 31 migrations; produção hpplboyysmfcjsnjrdmw: 20 migrations.
- Staging após o E2E: 116 agent_runs, todas status=killed; 0 agent_steps; 0 agent_model_usage; 0 agent_tool_grants; 0 content_items com agent_run_id. agent_settings: kill_switch=false, max_runs_per_day=500, max_steps_per_run=12.
- Produção: 0 agent_runs, 0 agent_steps, 0 agent_model_usage, 0 agent_tool_grants e 0 agent_settings.
- RLS permanece ativo nas tabelas S14 e content_items. Policies consultadas: leitura autenticada com escopo de organização; sem política para anon. As RPCs de execução/consumo seguem restritas a service_role, conforme auditoria anterior.
- As migrations S14 existem nos dois bancos, mas os version IDs diferem: staging 20261119101353 agent_draft_content, 20261119101414 agent_claim_queue, 20261119114718 agent_model_usage; produção 20261119040000, 20261119050000, 20261119060000. Isso é divergência de histórico; não prova por si só divergência de schema. Não executar repair/db push sem comparar definições e backup.
- Soma no ledger de staging e produção: 0 linhas, 0 input tokens, 0 output tokens e US$ 0.

### Vercel, OIDC, AI Gateway e Cron
- Inventário de envs (sem decrypt): SUPABASE_SECRET_KEY ausente. CRON_SECRET consta como sensitive separadamente em Preview e Production; valor não lido e comprimento mínimo de 32 caracteres não validado.
- AGENT_EXECUTOR_ENABLED=true em Preview e Production. AGENT_MODEL_PROVIDER=vercel-ai-gateway; AGENT_MODEL_AUTH=oidc; modelo anthropic/claude-haiku-5.5; AGENT_MONTHLY_BUDGET_USD=5.
- OIDC está selecionado, mas token e autenticação efetiva em runtime não foram comprovados.
- AI Gateway do projeto nos últimos 7 dias: nenhuma linha de uso (0 requests/tokens/custo). Budgets de team, project e defaults: nenhum.
- agent_model_usage está vazio nos dois bancos, consistente com o uso agregado zero do Gateway. Nenhuma chamada real ao modelo foi comprovada.
- O orçamento interno é soft: não há reserva atômica por chamada nem outbox durável para reconciliar custo se a RPC falhar após uma resposta cobrada.
- feature/smkon-production-readiness contém vercel.json com cron 17 11 * * * para /api/agents/worker e a rota do worker. GitHub Contents API retornou 404 para ambos os caminhos em main; logo o Cron S14 não está implantado/ativo em Production.
- O Cron secret não foi validado em conteúdo/comprimento; não contornar a redaction da API. Não há logs recentes do worker no deployment S14.

### Bloqueio para teste real
Não executar operations_review real enquanto faltarem: (1) SUPABASE_SECRET_KEY exclusiva de staging no Preview; (2) grants mínimos de leitura para operations_review; (3) budget externo com escopo isolado de Production; (4) validação segura do CRON_SECRET; (5) autenticação OIDC comprovada no runtime. O E2E aprovado não substitui esses gates.

### Segurança
Nenhum merge, alteração em main/Production, migration remota, alteração de secret, concessão de grant, criação de budget compartilhado ou chamada paga ao modelo foi executada nesta rodada.

## Reconciliação operacional S14 — 21/11/2026 18:01 BRT (auditoria run 11)

### GitHub e release
- PR #82 foi incorporada à integração e PR #87 levou a release S14 à `main` (merge commit `efbfb56fb16617b1816a70706a6e51be98af17d1`). PRs #94 e #95 também foram incorporadas depois; HEAD atual de `main`: `4347080dee246871e20b15461e020e3719c57b9f` (#95).
- PRs documentais #88 e #96 são tentativas anteriores, ambas divergidas do HEAD atual; esta atualização foi reaplicada numa branch nova diretamente baseada no HEAD `4347080`.
- Os nove splits originais S14 (#35–#42 e #46) estão integrados; não há split original pendente.

### Produção Vercel — estado corrigido
- Deployment Production READY: `dpl_CgbrQ8jM7pzDCeWzCNbAQco5sUEZ`, branch `main`, SHA `d30c42a447484316d7f189a1ca62595bfe8b5f59`, criado em 21/11/2026 às 17:23 BRT.
- Compare GitHub `efbfb56...d30c42a`: 6 commits à frente / 0 atrás; o deployment é descendente do merge #87 e inclui o release S14. O build log confirma Next.js 16.4.6, TypeScript concluído, npm audit com zero vulnerabilidades e rota dinâmica `/api/agents/worker` no output.
- HEAD atual de `main` está 4 commits à frente do deployment Production; o deployment não contém as últimas mudanças de Frente D/E (#92, #94, #95 e commits adjacentes).
- `vercel.json` na revisão implantada declara Cron `17 11 * * *` para `/api/agents/worker` (08:17 BRT). Como o deployment foi criado após o horário de 21/11, a próxima janela programada é 22/11/2026 às 08:17 BRT.
- Runtime logs do deployment Production nos últimos 30 minutos: nenhum registro. A consulta de 1 hora foi recusada porque o plano Hobby não retém essa janela; não há evidência de invocação do Cron após o deployment.

### Worker, OIDC e variáveis — inventário sem decrypt
- `AGENT_EXECUTOR_ENABLED=true` em Preview e Production.
- `CRON_SECRET` consta como sensitive separadamente em Preview e Production. Valores não foram lidos; comprimento mínimo de 32 caracteres e ausência de whitespace não foram validados.
- `SUPABASE_SECRET_KEY` não aparece no inventário do projeto para Preview nem Production.
- `AGENT_MODEL_PROVIDER=vercel-ai-gateway`, `AGENT_MODEL_AUTH=oidc`, `AGENT_MODEL=anthropic/claude-haiku-5.5` e `AGENT_MONTHLY_BUDGET_USD=5` estão configurados.
- O handler verifica flag, CRON_SECRET, Bearer, modelo/credencial, budget e só depois cria o cliente service_role. `getServiceEnv()` retorna null sem `SUPABASE_SECRET_KEY`; se os gates anteriores passarem, o worker registra `service_not_configured` e retorna 503 antes de claim. Isso é análise do código, não teste runtime.
- OIDC está selecionado, mas o token da invocação e a autenticação efetiva ao Gateway não foram comprovados em runtime.
- Com flag true e Cron implantado, há risco de a próxima invocação agendada retornar 503 enquanto a chave de serviço estiver ausente. Recomendação ao Owner: manter/desligar o executor em Production até homologação. Nenhuma configuração de Production foi alterada.

### AI Gateway e orçamento
- Catálogo confirma `anthropic/claude-haiku-5.5`.
- Uso agregado do projeto nos últimos 7 dias: 0 requests, 0 input/output tokens e US$ 0. Budgets de projeto/default e regras de roteamento: nenhum.
- `agent_model_usage`: 0 linhas, 0 tokens e US$ 0 em Staging e Production. Coerente com o agregado zero do Gateway, mas não prova a contabilização após uma chamada paga.
- O limite interno de US$ 5 é soft; não há reserva atômica por chamada nem outbox durável para reconciliar cobrança se a gravação falhar após resposta.

### Supabase — estado consultado
- Staging `xoyasrizivadxnpmzzno`: ACTIVE_HEALTHY, 31 migrations, 121 `agent_runs` (todas `killed`), 0 steps, 0 usage, 0 tool grants e 0 conteúdos associados. `agent_settings`: kill switch false, 500 runs/dia, 12 steps/run.
- Production `hpplboyysmfcjsnjrdmw`: ACTIVE_HEALTHY, 20 migrations; 0 runs, steps, usage, grants, settings e conteúdos associados.
- Assinaturas de colunas, constraints, policies, RLS/ACL e definições de funções selecionadas para `agent_runs`, `agent_steps`, `agent_model_usage`, `agent_tool_grants`, `agent_settings` e `content_items` são idênticas nos dois ambientes.
- Histórico de migrations S14 continua divergente: Staging `20261119101353`, `20261119101414`, `20261119114718`; Production `20261119040000`, `20261119050000`, `20261119060000`. A paridade dos objetos auditados não reconcilia o histórico. Não executar repair/db push sem plano e backup.
- RLS ativo nas tabelas auditadas; anon sem SELECT; authenticated com SELECT sujeito a RLS; service_role com SELECT. Nas cinco tabelas S14 não há DML direto de service_role. RPCs de worker/consumo são service_role-only; RPCs administrativas permitem EXECUTE autenticado, mas chamam `agent_require_role` com validações owner/admin.

### Testes e evidências
- CI S14 #44933511061: 288/288 unitários no SHA `46a6d1f5`, mais typecheck, lint, audit, build e SQL/migrations.
- E2E #44933605001: 36/36 no Preview exato do SHA `46a6d1f5`; valida UI/fila/kill switch, não chama o modelo.
- CI integração #44943940164: 350/350 no SHA `419694eb`, anterior às últimas mudanças de Frente D/E.
- Deployment Production `dpl_CgbrQ8jM7pzDCeWzCNbAQco5sUEZ` READY e build com rota worker. Status Vercel do HEAD atual `4347080`: failure `build-rate-limit`; consulta de workflow runs por PR para esse commit retornou zero.

### Bloqueio para teste real
Não executar `operations_review` real enquanto faltarem: (1) chave service exclusiva de Staging/Preview; (2) grants mínimos de leitura; (3) budget externo comprovadamente isolado de Production; (4) validação segura do CRON_SECRET; (5) OIDC comprovado em runtime; (6) Preview/E2E do SHA de homologação. Nenhuma chamada real ao AI Gateway foi comprovada.

### Segurança
Somente consultas read-only e documentação em branch nova. Nenhum merge, alteração Production, migration remota, secret, grant, budget, deploy ou chamada paga foi executado.


## Reconciliação operacional S14 — 21/11/2026 19:01 BRT (run 11)

### GitHub e release
- HEAD de `main`: `e17d16f799dc32e22b0f189fbdbd5f33161c7fc9` (merge da PR #97). Os nove splits S14 (#35–#42 e #46) continuam integrados; não há split original pendente.
- PR #101 (`chore/release-engineering`) está aberta, não Draft, base `e17d16f`, head `6ca14097`, mergeable. Ela introduz Playwright Build local para reduzir dependência da quota Vercel, Dependabot, remove o workflow de commits vazios de deploy e adiciona `docs/SEGREDOS.md`. Não foi mergeada nesta rodada.
- CI #44953753232 da PR #101: dois jobs success; typecheck, lint, audit, build e SQL tests aprovados; log de unit tests registra 406 pass.
- E2E #44953753229 da PR #101: job Build local falhou com 35 pass / 1 fail. Falha isolada em `tests/e2e/csp.spec.mjs`, página `/studio`, linha 68: existe um elemento `<style>` cujo nonce é vazio/diferente do nonce da resposta. O job Playwright · Staging foi skipped porque o evento foi `pull_request`; ainda não há E2E de Preview para esse SHA.
- Preview da PR #101 READY: `dpl_yYG7QwPUu8mquGR9MhQcMrWKfPt2`, URL https://smkon-9by4wpptn-smkon.vercel.app, SHA `6ca14097`. O check Vercel da PR está success.
- O check Vercel do HEAD de `main` está failure `build-rate-limit`; não há deployment correspondente aos oito commits mais recentes da main.

### Produção e Cron
- Deployment Production mais recente: READY `dpl_5U4DbwZF2PUNHXWxFoVe5cudCN9s`, SHA `5973b230bfa8278497201bb0b75004075f8c1343`, criado em 21/11/2026 às 18:28 BRT. É ancestral de `main`; a comparação retorna 8 commits à frente na main e 0 atrás.
- A revisão implantada contém `vercel.json` com `/api/agents/worker` em `17 11 * * *` (08:17 BRT) e a rota do worker. O deploy foi criado depois do horário diário de 21/11; a próxima execução programada é 22/11/2026 às 08:17 BRT.
- Runtime logs do deployment nos últimos 50 minutos: nenhum registro. Runtime errors agregados da rota em 24h: nenhum. A ausência de logs não comprova invocação nem sucesso do Cron.
- Não há evidência de execução autenticada do worker. Com a chave de serviço ausente, o handler falha fechado em `503 service_not_configured` antes de claim, após validar flag, CRON_SECRET, Bearer, modelo/OIDC e budget.

### Variáveis, OIDC e orçamento (inventário sem decrypt)
- `SUPABASE_SECRET_KEY`: ausente no projeto Vercel, tanto Preview quanto Production.
- `CRON_SECRET`: sensitive presente separadamente em Preview e Production; valor não foi lido. Comprimento mínimo de 32 caracteres e ausência de whitespace não foram comprovados.
- `AGENT_EXECUTOR_ENABLED=true` em Preview e Production; não alterado. Recomendação ao Owner: manter Production desligado até homologação controlada.
- `AGENT_MODEL_PROVIDER=vercel-ai-gateway`, `AGENT_MODEL_AUTH=oidc`, `AGENT_MODEL=anthropic/claude-haiku-5.5`, `AGENT_MONTHLY_BUDGET_USD=5`.
- O handler lê `x-vercel-oidc-token`; a documentação atual da Vercel confirma que o token OIDC de runtime é exposto nesse header. Isso valida a escolha do mecanismo no código, mas não comprova autenticação real em runtime.
- AI Gateway últimos 7 dias: 0 requests, 0 input/output tokens, US$ 0. Budgets de team, project e defaults: nenhum. Regras de roteamento: nenhuma.
- O teto interno de US$ 5 permanece soft, sem reserva atômica por chamada e sem outbox durável para reconciliação de uma cobrança após falha da RPC.

### Supabase — estado consultado
- Staging `xoyasrizivadxnpmzzno`: 31 migrations; 125 `agent_runs`, todas `killed`; 0 `agent_steps`; 0 `agent_tool_grants`; 0 `agent_model_usage`; 1 `agent_settings`. Configuração: `kill_switch=false`, 500 runs/dia, 12 steps/run.
- Production `hpplboyysmfcjsnjrdmw`: 31 migrations; 0 runs, steps, grants, usage e settings.
- Os nomes das 31 migrations coincidem entre ambientes; os version IDs continuam diferentes. A PR #101 documenta paridade em 534 objetos, mas esta rodada confirmou contagens/nome das migrations e objetos S14, não repetiu a comparação integral dos 534 objetos.
- `agent_model_usage` usa as colunas `input_tokens`, `output_tokens` e `cost_usd`. Staging e Production: 0 linhas, 0 tokens e US$ 0. Consistente com o agregado zero do AI Gateway; não prova reconciliação após uma chamada cobrada.
- Workspace de staging continua sem tool grants. Nenhum `operations_review` real pode ser executado com segurança.

### Gate para teste real controlado
Não executar operação paga enquanto faltarem: chave service exclusiva de staging; grants mínimos e explicitamente aprovados; budget externo isolado de Production; validação segura do CRON_SECRET; autenticação OIDC observada em runtime; Preview/E2E do SHA de homologação sem falha. Nenhuma chamada real ao AI Gateway foi comprovada.

### Segurança desta rodada
Somente consultas read-only a GitHub/Vercel/Supabase e atualização documental em branch isolada. Nenhum merge, alteração de Production, deploy, migration remota, secret, grant, budget ou chamada paga foi executado.
