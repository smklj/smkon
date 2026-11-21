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

## Reconciliação factual pós-release #87 — 21/11/2026 17:03 BRT

Esta seção supersede snapshots anteriores sobre o estado de merge, Cron e produção. Consultas desta rodada foram somente de leitura, exceto estes commits documentais nesta branch; nenhum secret foi exibido.

### GitHub e proveniência
- GitHub registra a PR #82 como **merged** em 2026-11-21 19:18:09Z (16:18:09 BRT), merge commit `aa2757918370e8560d0ae7a2af4533e1613274ab`, com base `feature/smkon-production-readiness`. O merge não foi executado por esta automação.
- GitHub registra a PR #87 como **merged em main** em 2026-11-21 20:00:46Z (17:00:46 BRT), merge commit `efbfb56fb16617b1816a70706a6e51be98af17d1`, com pais `01677bad697ed412bffe58d6b8dd7eabec8d6183` e `419694eb0df4499f6cec8f1701a2b687bc11b516`. A mensagem da PR #87 declara release das Frentes A/B/C; o escopo inclui S14. Esta automação não realizou esse merge.
- O commit `aa275791` é ancestral de `main` (compare: 113 commits à frente, 0 atrás). Portanto, o código S14 está no histórico atual de `main`; isso não significa que já esteja no deployment de produção.
- A branch de integração consultada estava em `419694eb0df4499f6cec8f1701a2b687bc11b516`. A PR #82 não está mais aberta: está fechada e merged. Não criar outra PR de código S14 sem revisar o estado atual.

### CI, Preview e produção
- CI #44943940164 no head de integração `419694eb`: sucesso nos dois jobs; logs confirmam 350 testes, 350 pass, 0 fail (typecheck/lint/build/unit tests e migrations/SQL tests).
- CI específico do código S14 #44933511061: sucesso nos dois jobs no SHA `46a6d1f5`, com 288/288 testes unitários, audit, typecheck, lint, build e SQL.
- E2E Playwright #44933605001: sucesso, 36/36 testes no Preview/SHA exato `46a6d1f5`; valida UI, fila e kill switch, não chama o modelo nem comprova uma execução de IA.
- Preview isolado S14 READY: https://smkon-biemu0r7c-smkon.vercel.app (deployment `dpl_AWf8HaAnCGR4FotuTT6qfRtWnWK1`, SHA `46a6d1f5`). Preview atual da integração READY: https://smkon-qzoa87ig9-smkon.vercel.app (deployment `dpl_58rvG6hdtw6fDWojnBifv7qYFrdb`, SHA `419694eb`). Ambos são Preview, não produção.
- O deployment de produção mais recente observado continua READY no SHA `01677bad697ed412bffe58d6b8dd7eabec8d6183`, deployment `dpl_2DNf1UScHg57eKLRf5vVZaDBRsB8`, criado em 2026-11-19 03:42:11Z. Compare desse SHA com o merge S14 `aa275791`: diverged (153 à frente / 6 atrás). Não contém o merge S14.
- O status Vercel do merge de release `efbfb56` está **failure** com `build-rate-limit`; a listagem de deployments Production não mostrou deployment novo para esse SHA. A descrição da PR #87 afirma 350/350 testes, mas não foi encontrado um run de Actions associado ao merge commit; a evidência verificável desta rodada é o CI #44943940164 no pai de integração e o CI/E2E específicos acima.

### Vercel Cron, worker e configuração
- `main` agora contém `vercel.json` com Cron `17 11 * * *` para `/api/agents/worker`, e a rota `src/app/api/agents/worker/route.ts`. Isso corrige a documentação anterior que dizia que ambos estavam ausentes de `main`.
- O Cron ainda não foi comprovado em produção: o deployment Production observado é anterior ao merge #87/S14 e o novo check Vercel falhou por quota. Não declarar Cron operacional até existir deployment Production READY do SHA atual e uma invocação autenticada comprovada.
- Inventário Vercel sem decrypt: `SUPABASE_SECRET_KEY` ausente (nenhuma variável oculta de Production reportada); `CRON_SECRET` consta como sensitive em Preview e Production, mas seu comprimento mínimo de 32 caracteres não foi validado; `AGENT_EXECUTOR_ENABLED=true` em Preview e Production; `AGENT_MODEL_PROVIDER=vercel-ai-gateway`; `AGENT_MODEL_AUTH=oidc`; modelo `anthropic/claude-haiku-5.5`; teto interno `AGENT_MONTHLY_BUDGET_USD=5`.
- O código aceita OIDC pelo header `x-vercel-oidc-token` ou `VERCEL_OIDC_TOKEN`, somente com opt-in explícito. Token e autenticação efetiva em runtime não foram comprovados.
- A rota falha fechado se `SUPABASE_SECRET_KEY` estiver ausente: responde `503 service_not_configured` antes de criar cliente/claim de fila. Como `AGENT_EXECUTOR_ENABLED=true` em Production, não promover/deployar o worker até que a configuração seja revisada; esta automação não alterou a flag.

### Supabase, permissões e ledger
- Staging `xoyasrizivadxnpmzzno`: 31 migrations; 119 `agent_runs`, todas `killed`; 0 `agent_steps`; 0 `agent_model_usage`; 0 grants; 0 conteúdos ligados a runs. `agent_settings`: `kill_switch=false`, 500 runs/dia, 12 steps/run.
- Produção `hpplboyysmfcjsnjrdmw`: 20 migrations; 0 runs, steps, usage, grants, settings e conteúdos ligados a runs.
- RLS habilitado nas cinco tabelas S14 em staging e produção; uma policy SELECT em cada. `content_items` tem quatro policies em ambos. Nos dois ambientes, `authenticated` e `service_role` têm SELECT nas tabelas S14; não há DML direto nesses objetos. `content_items` mantém DML sob RLS; a ferramenta de rascunho usa a RPC dedicada.
- Distinção de EXECUTE: as RPCs de worker/consumo (`agent_claim_next_run`, `agent_draft_content`, `agent_fail_run`, `agent_finish_run`, `agent_model_spend_since`, `agent_record_model_usage`, `agent_record_step`, `agent_reap_stale_runs`) estão restritas a `service_role` (além de postgres). Algumas RPCs administrativas têm EXECUTE para `authenticated`, mas são SECURITY DEFINER e validam papel: `agent_start_run`/`agent_cancel_run`/`agent_set_tool` exigem owner/admin; `agent_set_kill_switch`/`agent_update_limits` exigem owner; `agent_tool_catalog` é catálogo read-only. Isso corrige a afirmação anterior de que todas as RPCs eram exclusivas de service_role.
- Os nomes das três migrations S14 existem nos dois bancos, mas os version IDs divergem: staging `20261119101353`, `20261119101414`, `20261119114718`; produção `20261119040000`, `20261119050000`, `20261119060000`. Não executar repair/db push sem comparar definições e backup.

### AI Gateway e bloqueio de teste real
- Uso do AI Gateway nos últimos 7 dias: nenhuma linha (0 requests, tokens e custo). Budgets team/project/default: nenhum.
- `agent_model_usage` está vazio em staging e produção; soma de tokens/custo é zero, consistente com o uso agregado zero. Nenhuma chamada real ao AI Gateway foi comprovada.
- O teto interno é soft: o worker relê o gasto antes de cada claim; não reserva custo atomicamente e uma execução em andamento pode ultrapassar o limite. Não há outbox durável para reconciliar cobrança se a gravação falhar após a resposta.
- Não executar `operations_review` real enquanto faltarem chave exclusiva de staging, grants mínimos de leitura, budget externo isolado, validação segura do `CRON_SECRET` e autenticação OIDC comprovada em runtime. Não usar credenciais de produção nem contornar as barreiras.

### Segurança desta rodada
- Nenhum merge, deploy, alteração em Production, migration remota, alteração de secret, grant, budget ou chamada paga foi executado por esta automação. O branch atual é apenas documentação e parte do commit `efbfb56`; não foi aberto PR nem promovido.

- Handoff documental desta reconciliação está na Draft PR #88 (docs-only), branch `docs/s14-handoff-reconciliation-20261121-1703`; sem merge.
