## Checkpoint operacional S14 — 22/11/2026 07:02 BRT

> Evidência coletada em GitHub, Vercel, AI Gateway e Supabase por consultas read-only. Nenhum secret foi descriptografado; nenhuma alteração em main/Production, migration remota, grant, budget ou chamada paga.

### Resultado executivo
- Implementação S14 integrada à main: Planner → Executor → Verifier, ferramentas de leitura, draft, claim/lease, worker, adaptador AI Gateway, OIDC e ledger.
- PR #113 é a única PR aberta: Draft, mergeable, 29 commits à frente e 0 atrás. Compare main...branch confirma somente cinco arquivos docs/ modificados; HEAD verificado por deployment Preview: e12ee6fac6d514f160c15aa4f058842627cb54e0.
- PRs #35–#42 e #46 estão merged; #82 e #97 merged; #102 fechada sem merge. As nove entregas originais do S14 estão integradas.

### CI, E2E e deployments
- CI #45005652099 no HEAD exato e12ee6f: 2/2 jobs success; logs confirmam 418/418 testes unitários, 0 falhas, typecheck, lint, dependency audit e build aprovados. O job SQL/migrations concluiu success; os logs listam 20 arquivos SQL distintos nesta execução (não reutilizar a contagem histórica de 28 para este run).
- E2E deployment_status #45005672517: Playwright · Staging success, 36 passed em 3,6 min, no mesmo HEAD e12ee6f e Preview exato. Artifact #14747642548. O run PR #45005652053 foi cancelado/skipped, mas não invalida o deployment_status que concluiu.
- Preview: dpl_RTBXRFjKSXqY2zgyb8MgpfVe9mFt READY, https://smkon-op42yz9n8-smkon.vercel.app, SHA e12ee6f. Production: dpl_3RdCGJ2THbYE9aajDZGgGzwWTUnV READY, main SHA 84afe632.

### Worker, credenciais e Cron
- vercel.json na main: /api/agents/worker, 17 11 * * * UTC = 08:17 BRT. A janela de runtime logs de Production consultada por 30 min não retornou registros; às 07:02 BRT o Cron das 08:17 ainda era futuro.
- Inventário Vercel com decrypt=false: SUPABASE_SECRET_KEY ausente em Preview e Production; SUPABASE_SERVICE_ROLE_KEY e AI_GATEWAY_API_KEY também ausentes. CRON_SECRET existe como Sensitive em targets separados Preview e Production, sem leitura de valores; comprimento mínimo e trim não certificados.
- AGENT_EXECUTOR_ENABLED=true nos dois ambientes; AGENT_MODEL_PROVIDER=vercel-ai-gateway; AGENT_MODEL_AUTH=oidc; AGENT_MODEL=anthropic/claude-haiku-5.5; AGENT_MONTHLY_BUDGET_USD=5. Configuração OIDC selecionada, mas token/autenticação em runtime não comprovados.
- Ordem do worker: flag → CRON_SECRET → Bearer → OIDC/modelo → budget → cliente service → claim. Sem SUPABASE_SECRET_KEY, createServiceClient retorna null e o worker não chega ao claim. Recomenda-se ao Owner desligar a flag em Production até homologação; nenhuma variável foi alterada.

### Supabase e segurança
- Staging: 158 runs, todas killed; 0 steps, 0 tool grants, 0 agent_model_usage e 0 content_items ligados a runs. Settings: kill_switch=false, 500 runs/dia, 12 steps/run. Production: 0 runs/steps/grants/usage/conteúdo ligado.
- agent_model_usage nos dois bancos: 0 linhas, 0 input/output tokens e US$ 0. RLS em 6/6 tabelas auditadas; 9 policies no conjunto; 19 funções agent_*; EXECUTE anon=0, authenticated=6, service_role=12.
- Os dois bancos listam 31 nomes de migrations correspondentes, mas 0/31 version IDs coincidem e a ordem de audience_consent/workspace_members difere. Não executar db repair/db push sem plano formal.

### AI Gateway, orçamento e gate
- AI Gateway 7d: 0 requests, 0 input/output tokens, US$ 0. Budgets específicos/default e regras de roteamento: nenhum. Catálogo live contém anthropic/claude-haiku-5.5. Nenhuma chamada real comprovada.
- O ledger zerado é consistente com o agregado de uso zero, mas não prova reconciliação após cobrança. O worker consulta gasto antes de cada claim; teto interno de US$ 5 é soft, sem reserva atômica de custo por chamada nem outbox durável.
- Não executar operations_review real enquanto faltarem chave service exclusiva de staging, grants mínimos, budget externo isolado e prova OIDC em runtime. Depois dos gates, executar uma única run e reconciliar request/modelo/tokens/custo com agent_model_usage, além de steps, draft e Verifier.

# S14 — Handoff: executor real dos agentes (Planner → Executor → Verifier)

**Estado atual em 22/11/2026:** as nove etapas foram integradas à `main` (PRs #35–#42 e #46; #82 e #97 também estão incorporadas). O deployment Production da main `84afe632` contém a rota do worker e o Vercel Cron. A execução real de IA, porém, ainda não está homologada: faltam chave service exclusiva de staging, grants mínimos, budget externo isolado e prova de OIDC em runtime. A branch `feature/smkon-production-readiness` é histórica e não deve ser promovida. O checkpoint operacional no topo deste arquivo é a fonte do estado atual; as seções seguintes preservam decisões e evidências históricas, inclusive de 19/11.

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


## Checkpoint operacional S14 — 22/11/2026 01:57 BRT

Esta seção supersede snapshots anteriores quando houver divergência. Evidências desta rodada: GitHub PR/compare/Actions, Vercel deployments/env inventory/runtime logs/AI Gateway e Supabase migrations/SQL somente de leitura. Nenhum valor secreto foi lido ou registrado.

### GitHub, splits e branches
- main permanece em SHA 84afe632464cc83c347ca1cfe5923efe9bbc91fe.
- PR #113 permanece aberta, Draft e mergeable; head 7d957275fe82be42d04b1f68be8a3bf517d5e22e, 15 commits à frente / 0 atrás. Compare e listagem de arquivos confirmam somente cinco documentos: INTEGRATION_STATUS.md, ROADMAP_SPLITS.md, S14_HANDOFF.md, S14_PROGRESS.md e SEGREDOS.md.
- PRs #35–#42 e #46 foram consultadas individualmente: todas merged. #82 e #97 merged; #102 fechada sem merge. #113 é a única PR aberta encontrada.
- Branches antigas de implementação/release permanecem divergentes; não promover nem mesclar automaticamente.

### CI e E2E
- CI #44983092682 no SHA 7d957275: 2/2 jobs success. Logs confirmam typecheck, lint, dependency audit, build e 418/418 testes unitários; job de migrations/SQL tests também concluiu com sucesso.
- E2E PR #44983092670: Playwright · Build local success; o job Staging foi skipped por ser evento pull_request.
- E2E de deployment_status #44983114589: Playwright · Staging success no Preview dpl_Exi3uZxvFqmX5mugDtKWsuuG9oKi / SHA 7d957275. Logs confirmam 36/36 testes aprovados em 3,6 min, com conta QA e Supabase isolado xoyasrizivadxnpmzzno. Artifact: [14738303182](https://github.com/smklj/smkon/actions/runs/44983114589/artifacts/14738303182).
- O E2E cobre fila, limites, kill switch, CSP, autenticação e UI; não executa chamada ao AI Gateway nem comprova processamento de run por IA.

### Vercel, Production e Cron
- Preview do HEAD 7d957275: deployment dpl_Exi3uZxvFqmX5mugDtKWsuuG9oKi READY, [URL](https://smkon-tm1ruyj1b-smkon.vercel.app).
- Nova Production deployment READY: dpl_3RdCGJ2THbYE9aajDZGgGzwWTUnV, branch main, SHA 84afe632, aliases smkon.vercel.app / smkon-smkon.vercel.app. É o deployment mais recente de Production observado nesta auditoria e substitui o snapshot anterior dpl_AH8JfHj4Maoub95UCSRoFyyqYNx2. Foi criado pelo fluxo de deploy da branch main; não foi disparado nem alterado por esta auditoria.
- vercel.json em main declara /api/agents/worker em 17 11 * * * UTC, equivalente a 08:17 BRT. A rota está presente em main e no deployment atual.
- Runtime log de Production em 22/11/2026 04:49:13Z: GET /api/agents/worker com evento unauthorized. O handler só chega a esse ramo após AGENT_EXECUTOR_ENABLED=true e CRON_SECRET passar pela validação de presença/comprimento/trim; o Bearer apresentado não correspondeu. Essa requisição ocorreu fora do horário do Cron e não prova invocação autenticada, execução agendada, OIDC ou claim. Nenhuma chamada autenticada do worker foi observada na janela de logs consultada.

### Variáveis e autenticação — inventário sem decrypt
- SUPABASE_SECRET_KEY ausente no inventário do projeto para Preview e Production. O código usa essa variável para criar o cliente service_role.
- CRON_SECRET existe como Sensitive em targets separados Preview e Production; valores não foram lidos. A requisição Production rejeitada acima prova que o segredo passou o validador de formato naquele runtime, sem provar correspondência do Bearer.
- AGENT_EXECUTOR_ENABLED=true em Preview e Production.
- AGENT_MODEL_PROVIDER=vercel-ai-gateway, AGENT_MODEL_AUTH=oidc, AGENT_MODEL=anthropic/claude-haiku-5.5 e AGENT_MONTHLY_BUDGET_USD=5 em ambos. AI_GATEWAY_API_KEY não está configurada; OIDC é o caminho selecionado, mas token/aceitação em runtime não foram comprovados.
- Ordem real do handler: flag → cron secret → Bearer → resolver modelo/OIDC → validar budget/model price → criar cliente service_role → claim/tick. Sem SUPABASE_SECRET_KEY, não há cliente e o worker não chega ao claim nem à chamada paga; se o OIDC estiver ausente, o bloqueio ocorre antes em model_not_configured.

### Supabase e ledger
- Staging xoyasrizivadxnpmzzno: 148 agent_runs, todas killed; 0 steps, 0 agent_model_usage, 0 tool grants, 1 agent_settings e 0 conteúdos vinculados a run. Settings: kill_switch=false, 500 runs/dia, 12 steps/run.
- Production hpplboyysmfcjsnjrdmw: 0 runs, 0 steps, 0 usage, 0 grants, 0 settings e 0 conteúdos vinculados.
- Os dois ambientes têm os mesmos 31 nomes de migrations, mas os 31 version IDs diferem. Não executar db repair ou db push sem reconciliação formal e backup.
- Soma direta de agent_model_usage nos dois bancos: 0 linhas, 0 input tokens, 0 output tokens e US$ 0,000000.

### AI Gateway e orçamento
- Uso agregado do projeto nos últimos 7 dias: nenhuma linha (0 requests, tokens e custo).
- Budget específico do projeto: nenhum; defaults de budget: nenhum; regras de roteamento: nenhuma.
- agent_model_usage vazio é consistente com o agregado zero, mas não comprova reconciliação após uma cobrança real.
- O teto interno de US$ 5 é consultado antes de cada claim e é soft; não há reserva atômica por chamada nem outbox durável para reconciliar cobrança se a gravação falhar após resposta.

### Gate para teste real
Não executar operations_review real enquanto faltarem chave de serviço exclusiva de staging, grants mínimos de leitura, budget externo restrito ao staging e prova de OIDC em runtime. Após esses gates, executar uma única run e reconciliar request/modelo/tokens/custo do Gateway com agent_model_usage, steps, draft e Verifier.

### Segurança
Somente consultas read-only e atualização documental nesta branch. Nenhum merge, alteração de main/Production, migration remota, secret, grant, budget, deploy ou chamada paga foi executado por esta rodada.

---

## Checkpoint operacional S14 — 22/11/2026 03:00 BRT

> Auditoria read-only de GitHub, Vercel, AI Gateway e Supabase. Inventário Vercel com decrypt=false; nenhum secret foi lido. Nenhuma alteração em main/Production, migration remota, grant, budget, variável ou chamada paga foi executada.

### GitHub e splits
- Main permanece em `84afe632464cc83c347ca1cfe5923efe9bbc91fe`.
- PR #113 aberta, Draft e mergeable; head `2513d971924eee611c6841d08ac534b6f9f6a3c4`, 20 commits à frente / 0 atrás. Patch da PR confirma somente cinco arquivos de documentação: `S14_HANDOFF.md`, `S14_PROGRESS.md`, `INTEGRATION_STATUS.md`, `SEGREDOS.md` e `ROADMAP_SPLITS.md`.
- PRs #35–#42 e #46 verificadas como merged; #82 e #97 merged; #102 fechada sem merge. A busca atual encontrou #113 como única PR aberta.
- Branches antigas de integração/release permanecem divergentes; não promover.
- Após este checkpoint, a branch recebe um commit documental único, sem alteração de código ou migration.

### CI, E2E e Preview
- CI #44987586564 no HEAD exato `2513d971`: 2/2 jobs success. Logs dos jobs confirmam 418/418 unit tests, typecheck, lint, dependency audit, build Next.js e migrations/SQL tests aprovados.
- E2E PR-triggered #44987586635 no mesmo HEAD: Build local cancelado e Playwright · Staging skipped. Não atribuir aprovação a esse run.
- Último E2E de deployment_status aprovado: #44983114589, Playwright · Staging 36/36, SHA `7d957275`, artifact #14738303182. O patch da PR #113 contém somente docs, então o código de aplicação é equivalente; ainda assim, o teste não foi executado no HEAD documental atual. A suíte não chama o AI Gateway.
- Preview exato do HEAD #113: deployment `dpl_9oZkfe9pm5D1oXa5RuuVbpmBLFcS`, READY, [abrir Preview](https://smkon-8bq5tji5p-smkon.vercel.app).
- Production mais recente: `dpl_3RdCGJ2THbYE9aajDZGgGzwWTUnV`, READY, main SHA `84afe632`, alias [smkon.vercel.app](https://smkon.vercel.app). Não houve deploy/alias Production nesta auditoria.

### Worker, Cron e credenciais
- `vercel.json` em main declara `/api/agents/worker` em `17 11 * * *` UTC = 08:17 BRT. Às 03:00 BRT de 22/11, a execução das 08:17 ainda é futura. Runtime logs Production: nenhuma linha na janela consultada de 50 min (aprox. 02:11–03:01 BRT); isso não prova invocação nem ausência fora da janela.
- Inventário Vercel sem decrypt: `AGENT_EXECUTOR_ENABLED=true` em Preview e Production; `AGENT_MODEL_PROVIDER=vercel-ai-gateway`; `AGENT_MODEL_AUTH=oidc`; `AGENT_MODEL=anthropic/claude-haiku-5.5`; `AGENT_MONTHLY_BUDGET_USD=5`.
- `CRON_SECRET` é Sensitive e separado em Preview e Production; nenhum valor foi lido. Não há validação de comprimento/whitespace de Production comprovada nesta janela.
- `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `AI_GATEWAY_API_KEY` não constam no inventário de variáveis.
- Código verificado: `handler.ts` valida flag → CRON_SECRET (mínimo 32 caracteres e sem espaços nas pontas) → Bearer em tempo constante → modelo/OIDC → budget/preço → cliente service_role → só então claim. `service.ts` usa especificamente `SUPABASE_SECRET_KEY`.
- `model.ts` aceita token OIDC do header `x-vercel-oidc-token` ou `VERCEL_OIDC_TOKEN`, apenas com opt-in `AGENT_MODEL_AUTH=oidc`. OIDC em runtime não foi comprovado. Sem token, o primeiro bloqueio pode ser `503 model_not_configured`; se OIDC e budget passarem, a ausência da chave Supabase resulta em `503 service_not_configured` antes de claim e chamada ao modelo.
- Recomenda-se ao Owner desabilitar `AGENT_EXECUTOR_ENABLED` em Production até homologação. Nenhuma variável foi alterada.

### Supabase, ACL e migrations
- Staging `xoyasrizivadxnpmzzno`: 150 runs, 150 `killed`; 0 steps, 0 tool grants, 0 usage, 0 input/output tokens, US$ 0 e 0 conteúdos vinculados a runs. `agent_settings`: kill_switch=false, 500 runs/dia, 12 steps/run; última atualização observada 22/11 02:07:54 BRT.
- Production `hpplboyysmfcjsnjrdmw`: 0 runs, steps, grants, usage e conteúdo vinculado.
- `agent_model_usage`: 0 linhas e somas de tokens/custo zero nos dois bancos.
- RLS habilitado em 6/6 tabelas auditadas nos dois ambientes. Policies: uma em cada tabela S14 (`agent_runs`, `agent_steps`, `agent_model_usage`, `agent_tool_grants`, `agent_settings`) e quatro em `content_items`. Funções `agent_*`: EXECUTE authenticated=6, service_role=12, postgres=19; nenhuma concessão a anon foi retornada.
- Os dois ambientes listam os mesmos 31 nomes de migrations, mas 0/31 version IDs coincidem. Isso é divergência de histórico, não prova isolada de schema divergente. Não executar `db repair`/`db push` sem comparar arquivos aplicados, backup e plano formal.

### Planner, Executor, Verifier e ferramentas
- `run.ts`: relê status antes das fases, respeita cancel/kill, limita payload, timeout por passo e prazo total; ferramenta fora da allowlist é rejeitada.
- `tools/read.ts`: allowlist de tabelas/colunas, entrada estrita, máximo 50 itens e 60.000 bytes; exclui colunas sensíveis e não permite escrita/agendamento/publicação.
- `tools/draft.ts`: única escrita do agente, RPC `agent_draft_content`, valida retorno com `content_status=draft`; sem aprovação/publicação.
- `verifier.ts`: determinístico; afirmações de produto exigem evidência `verified` do mesmo produto; gate de evidência roda antes de `draft_content` e falha fechado.
- Implementação revisada; nenhuma execução real Planner → Executor → Verifier ocorreu.

### AI Gateway, orçamento e ledger
- Uso do projeto nos últimos 7 dias: nenhuma linha agregada, 0 requests, 0 input/output tokens e US$ 0.
- Budgets específicos de projeto/equipe e defaults: nenhum. Regras de roteamento: nenhuma.
- `agent_model_usage` está vazio nos dois bancos. Os dados são consistentes para ausência de uso, mas não comprovam reconciliação após cobrança.
- `model-gateway.ts` envia POST ao endpoint fixo `https://ai-gateway.vercel.sh/v1/chat/completions`; registra usage antes de validar/usar o conteúdo e estima pior caso se usage/body falhar. Falha no recorder interrompe o processamento, mas não há outbox durável para reconciliar cobrança.
- `tick.ts` consulta gasto antes de cada claim. O teto interno de US$ 5 é soft, sem reserva atômica de custo máximo por chamada; execução em andamento pode ultrapassá-lo.

### Gate de homologação
Não executar `operations_review` real enquanto faltarem: (1) chave service exclusiva de staging no target Preview; (2) grants mínimos de leitura aprovados; (3) budget externo isolado do Production; (4) validação segura de CRON_SECRET; (5) OIDC comprovado em runtime. Depois, executar uma única run e reconciliar request/modelo/tokens/custo do Gateway com `agent_model_usage`, conferindo steps, draft e Verifier.

### Segurança desta rodada
Somente consultas read-only, inspeção de código e atualização documental nesta branch. Sem merge, alteração em main/Production, migration remota, secret, grant, budget, deploy Production ou chamada paga.

---

## Checkpoint operacional S14 — 22/11/2026 03:56 BRT

### GitHub e CI
- Repositório smklj/smkon; main permanece em 84afe632. PR #113 está aberta, Draft e mergeable; branch docs/s14-current-operational-handoff-20261121-2000 está 21 commits à frente / 0 atrás. Compare confirma somente cinco arquivos documentais. #113 é a única PR aberta. Splits #35–#42 e #46, além de #82 e #97, seguem merged; #102 fechada sem merge.
- CI #44992062696 no HEAD 8f9bd8fad5c5df0acf3bc9a0a88161139cbc2084: 2/2 jobs success. Logs confirmam 418/418 unit tests, typecheck, lint, dependency audit, build Next.js e migrations/SQL tests em banco descartável.
- E2E PR #44992062742: Playwright · Build local success, 36 passed (2.7m), usando o Supabase de staging; Playwright · Staging foi skipped pelo evento pull_request. Último job Playwright · Staging disparado por deployment_status ainda é #44983114589, 36/36 no SHA 7d957275 (código de app equivalente porque a PR é docs-only). Nenhum desses testes chama o AI Gateway.

### Vercel e Cron
- Preview exato do HEAD 8f9bd8: deployment dpl_Fim54qNNSjWVp3eFx4jbJxN17dXP, READY, https://smkon-p8lolgft9-smkon.vercel.app.
- Production mais recente: dpl_3RdCGJ2THbYE9aajDZGgGzwWTUnV, READY, main SHA 84afe632, alias https://smkon.vercel.app. Nenhum deploy/alias Production foi alterado nesta rodada.
- vercel.json declara /api/agents/worker, 17 11 * * * UTC = 08:17 BRT. No checkpoint 03:56 BRT, a execução diária das 08:17 ainda é futura. Logs de runtime Production na janela recente de 30 min: nenhuma linha. A consulta de 3h foi recusada pelo plano Hobby por exceder retenção; não interpretar como ausência de logs nesse período.

### Credenciais e proteções (inventário Vercel sem decrypt)
- AGENT_EXECUTOR_ENABLED=true em Preview e Production; AGENT_MODEL_PROVIDER=vercel-ai-gateway; AGENT_MODEL_AUTH=oidc; modelo anthropic/claude-haiku-5.5; teto interno AGENT_MONTHLY_BUDGET_USD=5.
- CRON_SECRET consta como Sensitive separadamente em Preview e Production; nenhum valor foi lido. SUPABASE_SECRET_KEY e SUPABASE_SERVICE_ROLE_KEY ausentes no inventário de ambos os targets. AI_GATEWAY_API_KEY ausente; OIDC é o caminho configurado.
- Código revisado: handler.ts valida flag → CRON_SECRET (mínimo 32 e trim) → Bearer em tempo constante → modelo/OIDC → budget/preço → cliente service_role → claim. service.ts exige SUPABASE_SECRET_KEY. model.ts aceita x-vercel-oidc-token ou VERCEL_OIDC_TOKEN somente com opt-in OIDC. Token/autenticação OIDC em runtime não comprovados. Sem token, bloqueio model_not_configured; se OIDC passar, chave Supabase ausente bloqueia com service_not_configured antes de claim/model call.
- Não alterar Production sem autorização. Recomenda-se ao Owner manter/desligar AGENT_EXECUTOR_ENABLED em Production até homologação; nenhuma variável foi modificada.

### Supabase, RLS, ACL e migrations
- Staging xoyasrizivadxnpmzzno: 152 runs, todas killed; 0 steps, 0 tool grants, 0 agent_model_usage e 0 conteúdos com agent_run_id. agent_settings: kill_switch=false, max_runs_per_day=500, max_steps_per_run=12 (atualizado em 22/11 03:09 BRT). Production hpplboyysmfcjsnjrdmw: 0 runs, steps, grants, usage e conteúdo vinculado; sem linha de agent_settings.
- RLS habilitado em 6/6 tabelas auditadas em ambos os bancos; policy count: uma em cada tabela S14 (agent_runs, agent_steps, agent_model_usage, agent_tool_grants, agent_settings) e quatro em content_items.
- Funções agent_*: EXECUTE authenticated=6, service_role=12, postgres=19; nenhuma concessão a anon foi retornada. As ACLs consultadas coincidem entre Staging e Production.
- Ambos listam os mesmos 31 nomes de migrations, mas 0/31 version IDs coincidem; audience_consent e workspace_members aparecem em ordem diferente. Isso não prova, isoladamente, schema divergente. Não executar db repair / db push sem comparar definições aplicadas, backup e plano formal.

### Planner, Executor, Verifier, ferramentas e orçamento
- run.ts relê status antes de fases, respeita cancelamento/kill switch, timeout por passo e prazo total; ferramenta fora de allowlist/grant é rejeitada. read.ts limita a 50 itens e 60.000 bytes, com allowlist e escopo da organização. draft.ts usa RPC agent_draft_content e só aceita retorno content_status=draft. verifier.ts é determinístico e exige evidência verificada do mesmo produto antes de permitir draft.
- model-gateway.ts usa endpoint fixo https://ai-gateway.vercel.sh/v1/chat/completions; testes usam fetch injetado e não fazem chamadas reais. budget.ts grava por agent_record_model_usage; tick.ts consulta agent_model_spend_since antes de cada claim. Limite interno US$ 5 é soft, sem reserva atômica de custo máximo e sem outbox durável de reconciliação.

### AI Gateway e ledger
- Uso do projeto nos últimos 7 dias: nenhuma série/linha, 0 requests, 0 input/output tokens e US$ 0. Budgets de projeto, equipe e defaults: nenhum (defaultCoveredCounts zero); regras de roteamento: nenhuma. Catálogo live confirma anthropic/claude-haiku-5.5 disponível.
- agent_model_usage: 0 linhas, 0 input tokens, 0 output tokens e US$ 0 em Staging e Production. Consistência observável com uso agregado zero; não comprova reconciliação depois de uma cobrança. Nenhuma chamada real ao Gateway foi comprovada.

### Gate de homologação e segurança
Não executar operations_review real enquanto faltarem: chave service exclusiva de Staging no target Preview, grants mínimos de leitura aprovados, budget externo isolado do Production, validação segura de CRON_SECRET e prova de OIDC em runtime. Depois dos gates, executar uma única run e reconciliar request/modelo/tokens/custo do Gateway com agent_model_usage, conferindo steps, draft e Verifier.

Somente leituras, inspeção de código e atualização documental nesta rodada. Sem merge, alteração em main ou Production, migration remota, secret, grant, budget, deploy Production ou chamada paga.


## Atualização operacional — 22/11/2026 05:02 BRT (consulta direta)

### Repositório e PRs
- Repositório smklj/smkon; main em 84afe632464cc83c347ca1cfe5923efe9bbc91fe.
- PR #113 aberta, Draft e mergeable; head anterior c7deb14eb89913e64ccd94497da3502c3f2c004c, 26 commits à frente e 0 atrás. Compare main...head confirma exclusivamente os cinco documentos deste handoff.
- A busca de PRs abertas retornou somente #113. Splits #35–#42 e #46, além de #82 e #97, estão merged; #102 está fechada sem merge. Não promover branches antigas divergentes.

### CI, E2E e Preview
- CI #44996313091 associado ao head c7deb14: 2/2 jobs concluídos com success. Logs do job de aplicação confirmam # tests 418, # pass 418, typecheck, lint, audit e build; job de migrations/SQL tests também success.
- E2E PR #44996313030: Build local cancelled e Playwright · Staging skipped. Não atribuir sucesso a esse run.
- Último job Playwright · Staging concluído com success: #44983114589, 36/36 no SHA de aplicação anterior 7d957275; a PR #113 é docs-only sobre a mesma base de aplicação. Isso não é teste de IA nem chamada ao Gateway.
- Preview atual do head c7deb14: deployment dpl_DoNMN47RiSC4Td3HmQGTR4AbW6mj, READY, https://smkon-9by7gt71w-smkon.vercel.app.
- Production mais recente: dpl_3RdCGJ2THbYE9aajDZGgGzwWTUnV, READY, SHA 84afe632, alias smkon.vercel.app. Nenhuma alteração de Production foi feita.

### Worker, Cron e ambiente Vercel
- vercel.json: /api/agents/worker, 17 11 * * * UTC = 08:17 BRT. No checkpoint 05:02 BRT, a próxima janela diária ainda era futura. Runtime logs de Production nos últimos 30 min: nenhuma linha; isso não prova ausência de execução fora dessa janela.
- Inventário consultado com decrypt=false: SUPABASE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY e AI_GATEWAY_API_KEY ausentes; CRON_SECRET Sensitive separado para Preview e Production; AGENT_EXECUTOR_ENABLED=true nos dois targets; provider vercel-ai-gateway, auth oidc, modelo anthropic/claude-haiku-5.5 e teto interno US$ 5. Nenhum valor secreto foi lido.
- O handler valida flag → presença/formato de CRON_SECRET → Bearer em tempo constante → modelo/OIDC → budget/preço → cliente service_role → claim. Sem token OIDC válido, model_not_configured; se OIDC passar, a ausência de SUPABASE_SECRET_KEY bloqueia em service_not_configured antes de claim e chamada ao modelo. O token OIDC em runtime não foi comprovado; comprimento/valor de CRON_SECRET não foi lido.
- Recomenda-se ao Owner manter AGENT_EXECUTOR_ENABLED=false em Production até a homologação. Nenhuma variável foi alterada.

### Supabase e consumo
- Staging xoyasrizivadxnpmzzno: 154 agent_runs, todas killed; 0 agent_steps, 0 agent_tool_grants, 0 agent_model_usage, 0 conteúdos vinculados por agent_run_id. agent_settings: kill_switch=false, 500 runs/dia, 12 steps/run.
- Production hpplboyysmfcjsnjrdmw: 0 runs, steps, grants, usage e conteúdo vinculado.
- Soma de agent_model_usage nos dois bancos: 0 linhas, 0 input tokens, 0 output tokens e US$ 0.
- RLS ativo em 6/6 tabelas auditadas em ambos; policies: 1 em cada tabela S14 e 4 em content_items. Funções agent_*: EXECUTE authenticated=6, service_role=12, postgres=19; nenhuma concessão a anon retornada.
- Os dois bancos listam os mesmos 31 nomes de migrations, mas os version IDs divergem e audience_consent/workspace_members aparecem em ordem diferente. Isso não prova schema divergente; não executar db repair/db push sem comparação formal, backup e plano.

### AI Gateway, modelo e orçamento
- Catálogo live: anthropic/claude-haiku-5.5 disponível; endpoint Anthropic declara ZDR e no-training. Isso é metadado do catálogo, não prova de chamada ou política configurada no projeto.
- Uso agregado do projeto nos últimos 7 dias: 0 requests, 0 tokens e US$ 0. Budgets de projeto e defaults: nenhum; regras de roteamento: nenhuma.
- agent_model_usage vazio é consistente com o agregado zero, mas não prova reconciliação após uma cobrança.
- model-gateway.ts usa endpoint fixo e registra usage de respostas 2xx antes de aceitar o conteúdo; sem usage estima cenário conservador e falha se a RPC de registro falhar. tick.ts relê o gasto antes de cada claim; teto interno é soft, sem reserva atômica por chamada nem outbox durável para reconciliar falha posterior.

### Gate de homologação
Não executar operations_review real enquanto faltarem: chave service exclusiva de staging no target Preview, grants mínimos de leitura, budget externo isolado, prova de OIDC em runtime e validação segura do Cron secret. Depois dos gates, executar uma única run e reconciliar request/modelo/tokens/custo do Gateway com agent_model_usage, além de steps, draft e Verifier.

Somente consultas, inspeção de código e documentação nesta rodada. Sem merge, alteração em main/Production, migration remota, secret, grant, budget ou chamada paga.


---

## Checkpoint verificado — 22/11/2026 07:59 BRT

### GitHub, CI e Preview
- Main: `84afe632464cc83c347ca1cfe5923efe9bbc91fe`. PR #113 aberta, Draft e mergeable; HEAD `a9cbe2f88216d75918fd96a82882909624068e85`, 30 commits à frente / 0 atrás. Compare confirma somente os cinco documentos S14 no diff. PRs #35–#42, #46, #82 e #97 merged; #102 fechada sem merge; #113 é a única PR aberta.
- CI #45010831733 no HEAD exato: 2/2 jobs success, 418/418 testes unitários, typecheck, lint, dependency audit, build e 28 arquivos SQL aprovados.
- E2E PR #45010831811: 36/36 browser tests locais; job Staging desse evento foi skipped. E2E deployment_status #45010855834: Playwright · Staging success, 36/36 em 3,4 min no Preview exato do HEAD `a9cbe2f`; artifact #14750330616. Os testes exercitam fila/kill switch, não chamam o modelo.
- Preview exato: deployment `dpl_96w44YQjmQ5h6ihUjB49KCqQeTC5`, READY, https://smkon-k6xe35ol2-smkon.vercel.app. Production: `dpl_3RdCGJ2THbYE9aajDZGgGzwWTUnV`, READY na main `84afe632`; nenhum deploy/alias Production foi alterado.

### Branches e splits
- PRs de split #35–#42 e #46, mais #82/#97, estão merged; #102 não foi merged. As nove branches `feature/s14-*` têm 0 commits exclusivos à frente da main e 267–294 atrás; não promover.
- `fix/s14-timeout-ledger-rebased-20261121-1415` diverge (16 ahead/160 behind), mas os hashes de `run.ts`, `model-gateway.ts`, `agents-budget.test.ts` e `agents-executor.test.ts` coincidem com main. `fix/s14-deadline-timeout-classification` diverge (19/203) e seu `model-gateway.ts` difere; não fazer cherry-pick sem revisão. `release/s14-mainline-integration-20261121` diverge 34/289; não promover.

### Worker, credenciais e Cron
- `vercel.json`: `/api/agents/worker`, `17 11 * * *` UTC = 08:17 BRT. No checkpoint 07:59, a execução diária ainda era futura; runtime logs dos últimos 30 min não retornaram registros do worker em Preview ou Production.
- Inventário Vercel consultado com `decrypt=false`: `SUPABASE_SECRET_KEY` e `SUPABASE_SERVICE_ROLE_KEY` ausentes no projeto, inclusive no target Preview da branch `qa-e2e-staging`; `AI_GATEWAY_API_KEY` ausente. `CRON_SECRET` Sensitive separado em Preview e Production, sem leitura do valor; comprimento/formato não certificados. `AGENT_EXECUTOR_ENABLED=true` em ambos; provider `vercel-ai-gateway`, auth `oidc`, modelo `anthropic/claude-haiku-5.5`, teto interno US$ 5.
- Código em main: flag → validação de CRON_SECRET/Bearer → resolução do modelo/OIDC → budget → cliente de serviço → worker tick/claim. `createServiceClient()` exige `SUPABASE_SECRET_KEY`; ausente, retorna null e o handler responde `service_not_configured` antes de iniciar o tick, reivindicar run ou fazer chamada ao modelo. OIDC em runtime não comprovado.
- Production permanece com `AGENT_EXECUTOR_ENABLED=true`; recomendo ao Owner desabilitar a flag até homologação. Nenhuma variável foi alterada.

### Supabase e AI Gateway
- Staging: 160 runs, todas `killed`; 0 steps, 0 grants e 0 usage. `agent_settings`: `kill_switch=false`, 500 runs/dia, 12 steps/run. Production: 0 runs, steps, grants e usage.
- `agent_model_usage`: 0 linhas, input/output tokens e custo em ambos os bancos. AI Gateway no projeto, últimos 7 dias: `rows=[]`, `series=[]`; budget de projeto/default e regras de roteamento ausentes. Catálogo confirma `anthropic/claude-haiku-5.5` disponível. Nenhuma chamada real comprovada.
- 31 nomes de migrations coincidem entre os bancos, mas version IDs divergem; não executar `db repair`/`db push` sem plano formal. O teto interno US$ 5 é soft: não há reserva atômica de custo máximo nem outbox durável de reconciliação.

### Decisão
E2E 36/36 comprova o fluxo de staging sem IA real. A execução controlada `operations_review` permanece bloqueada pela ausência da chave service exclusiva de staging, grants mínimos e budget externo isolado, além de OIDC/CRON não comprovados. Não houve merge, alteração em main/Production, migration remota, secret, grant, budget ou chamada paga.