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
| `20261119060000_agent_model_usage` | ✅ | ✅ (confirmado em 21/11/2026) |

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


## Reconciliação operacional — 21/11/2026 13:10 BRT

Esta seção supersede contagens e estados operacionais anteriores quando divergirem. Fontes consultadas nesta rodada: GitHub (PRs, commits, comparação de refs e Actions), Vercel (deployments, env inventory, AI Gateway e runtime logs) e Supabase (migrations e SQL read-only). Nenhum secret foi exibido.

### GitHub e branches
- PR #71 continua aberta em Draft, mas NÃO está mergeable: head a834292a5d7b7fa7f368a03269e477e911ff8c88, base atual feature/smkon-production-readiness em 99a9ac8616e07f85417f51772c175cc11a023712; comparação real: diverged, 24 commits à frente e 8 atrás. O texto anterior da PR que dizia 24/0 está desatualizado. Não fazer merge.
- A branch de integração está 128 commits à frente e 6 atrás de main; não promover a branch inteira.
- Existe release/s14-mainline-integration-20261121, 34 commits à frente e 0 atrás de main, contendo o conjunto isolado de arquivos S14; é apenas uma candidata de release, não foi aberta/mergeada nesta rodada.
- release/s14-timeout-fix-mainline-20261121 está idêntica a main.
- PR #71 altera somente seis arquivos: os três arquivos de correção (timeout, gateway e testes) e os três documentos S14/roadmap.

### CI, Preview e E2E
- CI #44917422154: success nos dois jobs para o head a834292; status Vercel do mesmo commit: success.
- Preview READY no deployment dpl_8woNXWYQ7knTYtKibpxdeEEBZ7Z2, SHA a834292: https://smkon-mks1v2rxx-smkon.vercel.app
- Não há evidência de Playwright/E2E bem-sucedido para esse deployment. Não confundir o CI de qualidade/SQL com E2E de navegador.
- Runtime logs do deployment da PR #71 não retornaram chamadas para /api/agents/worker nos últimos 15 minutos. Outros Previews tiveram requests não autenticadas rejeitadas com unauthorized; isso não é execução do worker.

### Supabase — consultas somente de leitura
- Migrations: staging 29; produção 20. As três migrations S14 (agent_draft_content, agent_claim_queue, agent_model_usage) estão registradas nos dois ambientes.
- Staging: 108 agent_runs, todas com status killed; 0 agent_steps, 0 agent_model_usage, 0 agent_tool_grants e 0 content_items com agent_run_id.
- Produção: 0 runs, steps, usage, grants e conteúdo vinculado a agentes.
- RLS ativo: agent_runs, agent_steps, agent_model_usage, agent_tool_grants, agent_settings (1 policy cada); content_items com RLS e 4 policies.
- Settings de staging: kill_switch=false, 500 runs/dia e 12 steps/run. O workspace auditado continua sem grants de ferramentas.

### Vercel, AI Gateway e Cron
- Variáveis não secretas: provider vercel-ai-gateway, auth oidc, modelo anthropic/claude-haiku-5.5, teto interno US$ 5 e AGENT_EXECUTOR_ENABLED=true em Preview e Production.
- SUPABASE_SECRET_KEY não aparece no inventário de variáveis do projeto.
- CRON_SECRET existe como sensitive em Preview e Production. A leitura individual via API não retornou o valor; comprimento mínimo de 32 e ausência de whitespace externo não foram validados.
- AI Gateway: nenhum budget de team/project/user/api-key e nenhum default; uso agregado do projeto vazio em 24h e 7d; catálogo confirma o modelo. agent_model_usage permanece vazio. Nenhuma chamada real ao Gateway comprovada.
- vercel.json declara 17 11 * * * para /api/agents/worker na integração. Em main, vercel.json e a rota do worker retornam 404; portanto o Cron S14 não está ativo em Production.

### Bloqueios para teste real
1. Provisionar a secret key exclusiva do Supabase staging e cadastrá-la como sensitive no Preview.
2. Configurar budget externo de Gateway com escopo que não altere Production; nenhum budget foi criado porque o escopo de projeto/equipe pode afetar Production.
3. Validar CRON_SECRET por mecanismo que não exponha o valor.
4. Conceder somente os grants mínimos necessários para operations_review em staging.
5. Obter E2E no Preview atual e só então executar uma operação controlada, conferindo resposta do Gateway, steps, Verifier e ledger.
6. Depois da primeira chamada, reconciliar request/token/custo agregado do Gateway com agent_model_usage.

### Segurança
Nenhum merge, alteração em main/Production, migration remota, alteração de secrets, concessão de grants ou chamada paga foi executada nesta rodada.
