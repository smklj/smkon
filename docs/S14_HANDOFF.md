# S14 — Handoff: executor real dos agentes (Planner → Executor → Verifier)

**Estado do código (21/11/2026):** as 9 etapas do S14 estão integradas na branch
`feature/smkon-production-readiness` pelos PRs #35–#42 e #46, incluindo o PR #46 (detalhe da execução e handoff).
O código está no Preview dessa branch; **não está em `main` nem em produção**. A branch `main` continua no commit
`01677bad` (release S7.2 C). Plano vivo, decisões e registro por etapa: `docs/S14_PROGRESS.md`.

**Estado operacional:** não há chamada real comprovada ao AI Gateway. O executor está implementado e testado com
`fetch` falso, mas a ausência de `SUPABASE_SECRET_KEY` na Vercel impede o worker de criar o cliente de serviço.

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

## Estado dos bancos (conferido em 21/11/2026 com `list_migrations` e SQL read-only)

| Migration lógica | Staging (`xoyasrizivadxnpmzzno`) | Produção (`hpplboyysmfcjsnjrdmw`) |
|---|---|---|
| `agent_draft_content` | ✅ `20261119101353` | ✅ `20261119040000` |
| `agent_claim_queue` | ✅ `20261119101414` | ✅ `20261119050000` |
| `agent_model_usage` | ✅ `20261119114718` | ✅ `20261119060000` |

As versões diferem por ambiente, mas os três nomes lógicos estão presentes nos dois projetos (consulta de 21/11/2026).

## Pendências e autorizações do Owner

1. 🔐 **`SUPABASE_SECRET_KEY`** — ausente na lista de variáveis da Vercel. O Owner precisa criar a chave secreta
   do projeto Supabase de staging e cadastrá-la como *sensitive* no escopo Preview. Sem ela o worker responde
   `503 service_not_configured`; não foi tentado nenhum bypass.
2. 🔐 **Orçamento externo do AI Gateway** — a consulta de budgets não encontrou orçamento específico para o projeto
   `smkon`. O limite interno `AGENT_MONTHLY_BUDGET_USD=5` está configurado em Production e Preview, mas a segunda
   barreira de orçamento do Gateway ainda não foi comprovada. O uso agregado do projeto nos últimos 7 dias veio vazio.
3. 🔐 **`CRON_SECRET`** — há entradas *sensitive* em Production e Preview, mas o valor é mascarado; não foi possível
   validar comprimento mínimo de 32 caracteres sem revelar o segredo. Confirmar no painel, sem colar o valor no chat.
4. **Primeiro uso real no staging** — depois de configurar a chave e confirmar o orçamento, executar uma única
   `operations_review` controlada e conferir chamada OIDC, resposta do Gateway, linhas em `agent_model_usage` e detalhe
   em `/agentes/[id]`. Não houve chamada real até esta auditoria.
5. **Release em produção** — S14 continua fora de `main`; nenhuma alteração de produção foi feita nesta auditoria.
   Merge/deploy de S14 exige autorização específica do Owner e gates verdes. O cron configurado é diário às 11:17 UTC;
   Cron da Vercel não executa em Preview.

## Auditoria de readiness — 21/11/2026

### GitHub e deployments

- PRs S14 #41, #42 e #46 estão fechados e mergeados na branch de integração; o #46 concluiu as etapas 8 e 9.
- Head da integração observado: `011accdb685c8304381f0a58e62b9659a41b6b9a`.
- Preview desse commit: [deployment READY](https://smkon-dr7ghlbph-smkon.vercel.app) — `dpl_AAK3sciSjoVZtESTnhKPWjNEJQji`.
- `main` observado em `01677bad697ed412bffe58d6b8dd7eabec8d6183`; Production READY está nesse commit e não contém S14.
- PR #56 continua aberto e com estado `dirty`, mas é um split interno com base na branch de integração, não um release para `main`.
- A branch `main` está sem proteção e sem required status checks. Isso é um risco de governança; não foi alterado nesta execução.

### CI e E2E

- No commit de integração `011accdb`, o CI `44867365527` passou em typecheck, lint e testes SQL; falhou em um teste unitário temporal:
  `prazo total: chamada lenta perto do fim do prazo falha com worker_timeout` (esperado `worker_timeout`, observado `step_timeout`).
- O E2E Browser Tests `44867496055` terminou com sucesso.
- O rerun do CI `44867365527` (attempt 2) terminou **success**, confirmando que a falha inicial foi transitória/flaky. A correção determinística está proposta na branch `fix/s14-deadline-timeout-classification`, PR #58, commit `28dc192d9481d739ab65c7c283ce3e8852390203`: o executor classifica pelo limite que efetivamente reduziu o timeout, sem depender da precisão de `Date.now()` no instante do timer.
- CI do PR #58 (`44868819971`, attempt 3) terminou **success**: typecheck, lint, unit tests, build e migrations/SQL passaram. O run executou no commit `576c932`; os commits posteriores até `d4055dae` alteraram apenas documentação, sem mudanças no código testado.
- Preview do head atual `d4055dae` está READY: https://smkon-rfqq1r07k-smkon.vercel.app. O E2E Browser Tests desse Preview (`44868983047`) está em andamento; o E2E da integração (`44867496055`) passou.

### Vercel e AI Gateway

- Em Production e Preview existem `AGENT_EXECUTOR_ENABLED=true`, `AGENT_MODEL_PROVIDER=vercel-ai-gateway`,
  `AGENT_MODEL=anthropic/claude-haiku-5.5`, `AGENT_MODEL_AUTH=oidc` e `AGENT_MONTHLY_BUDGET_USD=5`.
- `CRON_SECRET` existe como variável *sensitive* nos dois ambientes; o valor foi mantido oculto e seu comprimento não foi validado.
- `SUPABASE_SECRET_KEY` não aparece entre as variáveis do projeto. `AI_GATEWAY_API_KEY` também não aparece, o que é coerente com o modo OIDC escolhido.
- A documentação oficial da Vercel confirma que Functions recebem o token OIDC no header `x-vercel-oidc-token`; o worker lê esse header. Isso valida o mecanismo documentado, mas não comprova que uma chamada real do deployment tenha funcionado.
- Nenhum budget específico do projeto nem default foi encontrado no AI Gateway. A consulta de uso do projeto nos últimos 7 dias retornou zero linhas.
- **Risco de custo:** o adaptador grava `agent_model_usage` depois de receber a resposta 2xx. Se a gravação falhar, a chamada ao provedor já pode ter sido cobrada e ficar sem registro; o erro interrompe a execução, mas não desfaz o custo. Por isso o budget externo é requisito antes de qualquer execução real.
- `AGENT_EXECUTOR_ENABLED=true` já está configurado em Production. Hoje isso é inerte porque S14 ainda não está em `main`; antes de qualquer release, manter a flag Production desligada até concluir secrets, budget externo e smoke test controlado.

### Supabase e consumo

- `agent_model_usage` existe em staging e produção; ambas as tabelas têm **0 registros** e custo registrado **US$ 0**.
- Staging contém 78 execuções, todas encerradas com `kill_switch`, e 0 linhas em `agent_steps`; produção contém 0 execuções. Isso não é evidência de execução de modelo.
- A verificação de privilégios passou nos dois bancos: RLS habilitado; anon sem SELECT e sem EXECUTE das RPCs; authenticated com SELECT sob policy de membership; somente `service_role` executa `agent_record_model_usage` e `agent_model_spend_since`; INSERT direto por `service_role` continua revogado.
- Nenhuma migration foi aplicada nesta auditoria; os nomes das três migrations S14 já estão presentes nos dois ambientes.

### Critério de conclusão

**Implementado:** etapas 1–9 e UI de detalhe integradas na branch de integração.

**Validado parcialmente:** testes históricos locais e E2E do detalhe; CI atual ainda requer confirmação após a falha temporal e a correção proposta.

**Publicado:** Preview da integração está READY.

**Operacional:** não comprovado. Falta `SUPABASE_SECRET_KEY`, orçamento externo do Gateway e uma execução controlada com resposta real e registro em `agent_model_usage`.

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
