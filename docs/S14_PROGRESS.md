# S14 — Executor real dos agentes (Planner → Executor → Verifier)

**Branch de integração:** `feature/smkon-production-readiness` · uma etapa por PR (`feature/s14-<etapa>`).
**Pré-requisito:** S13 em produção (migration `20261119020000_agent_runs.sql`, ver `docs/S13_HANDOFF.md`).

Este arquivo é o plano vivo do S14. Cada execução avança **uma** etapa do checklist, marca o item e registra
o PR e os resultados reais dos testes. Nada aqui é considerado concluído sem teste executado.

## Objetivo

Transformar as execuções `queued` do S13 em execuções reais: um processo do servidor reserva a execução,
pede ao modelo um plano, executa ferramentas da allowlist, verifica o resultado e conclui ou falha — sempre
pelas funções `service_role` já existentes (`agent_record_step`, `agent_finish_run`, `agent_fail_run`).
O banco continua sendo a fronteira de confiança: o executor TypeScript não tem atalho para escrever passos.

## Regras que o S14 não pode quebrar

1. **Nenhum agente publica ou aprova.** A única escrita permitida é `draft_content`, que cria conteúdo em
   `status = 'draft'`. Publicação continua exigindo aprovação humana da versão exata (`content_approvals`
   por `content_hash`).
2. **Evidência antes de afirmação.** Toda afirmação sobre produto no resultado final precisa citar
   `product_evidence.id` com `review_status = 'verified'` do mesmo `organization_id`. Sem isso, o Verifier reprova.
3. **Isolamento multi-tenant.** Toda ferramenta filtra por `organization_id` da execução, nunca por parâmetro do modelo.
4. **Financeiro separado por domínio.** `read_finance_summary` devolve vendas próprias, afiliados e mídia em campos
   distintos, sem somar domínios e sem misturar estados (previsto/aprovado/liquidado/cancelado/pago).
5. **Sem gasto e sem credencial implícita.** Sem provedor configurado, o executor recusa com `model_not_configured`;
   nenhuma chamada paga em teste. Worker desligado por padrão (`AGENT_EXECUTOR_ENABLED != "true"` → 503).
6. **Kill switch manda.** Antes de cada passo o executor relê o estado da execução; qualquer status fora de
   `planning/executing/verifying` (ex.: `killed`, `cancelled`) interrompe o loop sem novas escritas.

## Arquitetura

```
Vercel Cron (🔐 a configurar)                 Supabase (service_role, só no servidor)
        │  Authorization: Bearer CRON_SECRET          │
        ▼                                             │
/api/agents/worker ──► claimNextRun() ───────────────► agent_claim_next_run()  (FOR UPDATE SKIP LOCKED)
        │                                             │
        ▼                                             │
runAgent(run, deps)                                   │
  ├─ Planner  : model.plan(goal, tools)  ──► store.recordStep('plan')     ──► agent_record_step
  ├─ Executor : tools[tool](ctx, input)  ──► store.recordStep('execute')  ──► agent_record_step
  ├─ Verifier : verify(outputs, claims)  ──► store.recordStep('verify')   ──► agent_record_step
  └─ fim      : store.finish(outcome) | store.fail(code)                  ──► agent_finish_run / agent_fail_run
```

Módulos previstos em `src/lib/agents/executor/`:

| Arquivo | Papel |
|---|---|
| `types.ts` | Contratos (`AgentModel`, `AgentStore`, `ToolHandler`, `RunContext`, `ExecutorLimits`, códigos de erro) |
| `run.ts` | Loop `runAgent()` puro: sem `fetch`, sem Supabase, só interfaces injetadas |
| `limits.ts` | Timeout por passo (`withTimeout`), corte de payload (64 KB, alinhado ao banco), contagem de passos |
| `verifier.ts` | Regras determinísticas do Verifier (citação de evidência verificada, ferramentas usadas, formato) |
| `store.ts` | `AgentStore` real sobre o cliente `service_role` (RPCs do S13) |
| `tools/*.ts` | Ferramentas `read_*` e `draft_content` |
| `model/*.ts` | Interface de modelo + adaptador (AI Gateway/Anthropic) sem chave e sem chamada real |

## Contratos (rascunho — fixados na etapa 2)

```ts
type Phase = "plan" | "execute" | "verify";

interface RunContext {
  runId: string;
  organizationId: string;   // vem do banco (agent_runs), nunca do modelo
  agent: AgentKind;
  goal: string;
  maxSteps: number;
  grantedTools: AgentTool[]; // agent_tool_grants habilitados
  createdBy: string;         // humano que iniciou; autor legal do rascunho
}

interface AgentModel {
  plan(input: { goal: string; agent: AgentKind; tools: AgentTool[] }): Promise<{ steps: PlannedCall[] }>;
  summarize(input: { goal: string; observations: Observation[] }): Promise<{ text: string; claims: Claim[] }>;
}
interface PlannedCall { tool: AgentTool; input: Record<string, unknown> }
interface Claim { text: string; productId?: string; evidenceIds: string[] }

interface AgentStore {
  currentStatus(runId: string): Promise<RunStatus>;          // kill switch / cancelamento
  recordStep(s: { runId; phase; tool?; input; output; status: "ok" | "error"; detail? })
    : Promise<{ seq: number; runStatus: RunStatus }>;       // agent_record_step
  finish(runId: string, outcome: Record<string, unknown>): Promise<void>; // agent_finish_run
  fail(runId: string, code: ExecutorErrorCode): Promise<void>;           // agent_fail_run
}

type ToolHandler = (ctx: RunContext, input: unknown, signal: AbortSignal) => Promise<ToolOutput>;
```

Códigos de falha (formato exigido pelo banco `^[a-z][a-z0-9_]{2,63}$`): `model_not_configured`,
`model_error`, `step_timeout`, `payload_too_large`, `invalid_plan`, `tool_error`, `verify_failed`,
`evidence_missing`, `worker_timeout`. `step_limit` e `kill_switch` já são gravados pelo próprio banco.

## Decisões de desenho

- **Loop determinístico em volta do modelo.** O modelo só propõe plano e texto; quem decide ferramenta, limite,
  ordem e veredito é código. O Verifier é regra (evidência verificada, ferramentas dentro da allowlist, formato),
  não "outro LLM concordando".
- **Ferramenta proibida não é erro do executor.** Se o modelo pedir uma ferramenta fora da allowlist/grant, o passo
  é enviado assim mesmo e o banco o registra como `rejected` (comportamento do S13), contando no limite.
- **Reserva da fila com lease.** `agent_claim_next_run()` move `queued → planning` dentro da transação com
  `FOR UPDATE SKIP LOCKED` e grava `claimed_at`; execuções presas além do lease são falhadas com `worker_timeout`
  pelo próprio worker. A coluna nova vem na migration da etapa 5 (aditiva, sem mexer em dados existentes).
- **Autoria do rascunho.** `content_items.created_by` exige usuário: o rascunho é atribuído a
  `agent_runs.created_by` (o humano que pediu) e marcado com `agent_run_id` (coluna nova, FK para `agent_runs`).
  O gatilho `content_items_guard` existente segue calculando hash e versão; nenhuma aprovação é criada.
- **Sem dependências novas.** Testes com `node:test`; adaptador de modelo via `fetch` nativo, sem SDK, até o Owner
  escolher provedor.

## Checklist

| # | Etapa | Status | PR | Validação real |
|---|---|---|---|---|
| 1 | Plano: este arquivo (arquitetura, contratos, checklist) | ✅ concluída | #35 | Só documentação; nenhum código alterado |
| 2 | Núcleo do executor (`src/lib/agents/executor/`): loop, limites, kill switch, timeout, payload; testes com modelo falso | ✅ concluída | ver PR `feature/s14-executor-core` | `test:unit` 87/87 (19 novos), `test:db` 13/13 arquivos, typecheck, lint e build OK |
| 3 | Ferramentas `read_*` reais, escopadas por organização, colunas mínimas, ≤ 50 itens / 64 KB; testes | ✅ concluída | ver PR `feature/s14-read-tools` | `test:unit` 103/103 (16 novos), `test:db` 13/13 arquivos, typecheck, lint e build OK |
| 4 | `draft_content`: migration + função `service_role` só de rascunho + `supabase/tests/014_*.test.sql` | ✅ concluída | ver PR `feature/s14-draft-content` | `test:db` 14/14 arquivos (014: 40 asserções), `test:unit` 103/103, typecheck, lint e build OK. 🔐 migration não aplicada em staging/produção |
| 5 | Claim da fila: migration `agent_claim_next_run()` com `FOR UPDATE SKIP LOCKED` + lease + testes SQL | ✅ concluída | ver PR `feature/s14-claim-queue` | `test:db` 15/15 arquivos (015: 37 asserções), corrida real com 8 sessões (20 reservas, 0 duplicadas), `test:unit` 103/103, typecheck, lint e build OK. 🔐 migration não aplicada em staging/produção |
| 6 | Worker `/api/agents/worker` (CRON_SECRET em tempo constante; desligado por flag; `service_role` só no servidor) | ✅ concluída | ver PR `feature/s14-worker` | `test:unit` 121/121 (18 novos), `test:db` 15/15 arquivos, typecheck, lint e build OK; `next start` local: sem/errado Bearer → 401, Bearer certo → 503 `model_not_configured` (proxy deixa passar). 🔐 nada configurado na Vercel |
| 7 | Adaptador de modelo sem chave (recusa `model_not_configured`); Verifier exige evidência `verified` | ✅ concluída | ver PR `feature/s14-model-adapter` | `test:unit` 140/140 (19 novos), `test:db` 15/15 arquivos, typecheck, lint e build OK; nenhuma chamada real ao modelo (fetch falso). 🔐 provedor, modelo, orçamento e chave a definir pelo Owner |
| 8 | UI: detalhe da execução em `/agentes` (passos resumidos, motivo de falha), sem publicar | ✅ concluída | ver PR `feature/s14-run-detail` | `test:unit` 166/166 (10 novos), `test:db` 17/17 arquivos, typecheck, lint e build OK; E2E do detalhe no `agents.spec` (staging, migration 20261119060000 aplicada lá) |
| 9 | Handoff `docs/S14_HANDOFF.md` + estado no `docs/ROADMAP_SPLITS.md` | ✅ concluída | ver PR `feature/s14-run-detail` | Só documentação; estado dos bancos conferido com `list_migrations` |

## Autorizações do Owner (🔐) — estado em 19/11/2026

Autorizado pelo Owner em conversa em 19/11/2026 ("seguir com as configurações na Vercel, aplicar migrations e escolher
o provedor de IA"). Escolhas: Vercel AI Gateway, `anthropic/claude-haiku-5.5` (sem preferência do Owner; escolhido pelo
custo, ~US$ 0,002 por execução), teto US$ 5/mês por ambiente, Preview e Production, cron diário.

- ✅ Migrations das etapas 4 e 5 aplicadas no staging (`xoyasrizivadxnpmzzno`) e na produção (`hpplboyysmfcjsnjrdmw`),
  conferidas: funções só executáveis por `service_role`, nenhum alerta novo do advisor de segurança.
- ✅ Vercel (projeto `smkon`, Production e Preview): `CRON_SECRET` (sensitive, valores diferentes por ambiente),
  `AGENT_EXECUTOR_ENABLED=true`, `AGENT_MODEL_PROVIDER=vercel-ai-gateway`, `AGENT_MODEL=anthropic/claude-haiku-5.5`,
  `AGENT_MODEL_AUTH=oidc` (token OIDC do deployment, sem chave guardada) e `AGENT_MONTHLY_BUDGET_USD=5`.
- ✅ Migration `20261119060000_agent_model_usage.sql` aplicada no staging (conferido com `list_migrations` em 19/11/2026).
  🔐 Produção: pendente, só com autorização do Owner.
- 🔐 **Falta (só o Owner)**: criar a chave secreta do Supabase (Dashboard → Project Settings → API Keys → *secret key*)
  em cada projeto e cadastrá-la na Vercel como `SUPABASE_SECRET_KEY` (tipo *sensitive*): a de staging em Preview, a de
  produção em Production. Não colar a chave no chat. Sem ela o worker responde `503 service_not_configured`.
- 🔐 **Recomendado (só o Owner)**: orçamento de projeto no AI Gateway (Vercel → AI Gateway → Budgets → projeto `smkon`,
  US$ 5 mensal) como segunda barreira independente do código, e conferir se o time tem crédito no AI Gateway (sem
  crédito o Gateway responde 402 e a execução falha com `model_error`).
- 🔐 **Para rodar em produção**: o cron (`vercel.json`, diário às 11:17 UTC) e o worker só passam a existir em produção
  depois do merge da branch de integração na `main`, que continua exigindo autorização explícita. Crons da Vercel não
  rodam em Preview. No plano Hobby o cron é no máximo diário; no Pro dá para usar `*/5 * * * *`.

## Configuração do worker

Respostas: `503 executor_disabled` (flag), `503 worker_not_configured` (segredo), `401 not_authenticated`,
`503 model_not_configured` (falta provedor/modelo/credencial; o log traz só o motivo, ex. `oidc_token_missing`),
`503 budget_not_configured` (teto ausente/inválido ou modelo sem preço em `model-pricing.ts`),
`503 service_not_configured` (chave do Supabase), `200 { reaped, stoppedBy, runs: [{ runId, status, code? }] }` —
`stoppedBy = budget_exhausted` quando o teto do mês foi atingido.

## Registro

- **19/11/2026 — etapa 1.** Plano criado após inspeção de `20261119020000_agent_runs.sql` (estados, `agent_record_step`
  aceitando `plan` a partir de `queued`, limites de 64 KB), `content_items`/`content_items_guard` (autor obrigatório,
  hash por gatilho) e `product_evidence.review_status`. Sem alterações de código ou banco.
- **19/11/2026 — etapa 2.** Núcleo puro do executor em `src/lib/agents/executor/` (`types.ts`, `run.ts`, `limits.ts`,
  `parse.ts`, `verifier.ts`), sem dependências novas e sem Supabase/fetch. Contratos fixados:
  - `runAgent(ctx, { model, store, tools, verify?, limits?, logger? })` → `succeeded` | `failed` (código) | `stopped`
    (execução deixou de estar ativa; nenhuma escrita a mais).
  - Orçamento de passos: `1 plan + N execute + 1 verify ≤ maxSteps`; plano maior é `invalid_plan`. Se o banco aplicar
    `step_limit` (`seq` nulo), o loop para sem chamar `agent_fail_run`.
  - Estado relido antes de cada fase/ferramenta (kill switch); `run_not_active` vindo do banco também vira `stopped`.
  - Ferramenta fora do grant **não executa**: o passo vai ao banco, que grava `rejected`.
  - Erros de passo são gravados como passo `error` com `detail` = código e depois `agent_fail_run(código)`.
    Códigos novos além do plano: `invalid_summary` e `internal_error`.
  - Payload: `jsonBytes` reproduz `octet_length(jsonb::text)` (JSON + espaços do jsonb); conferido contra o Postgres 16
    local (50 = 50 bytes num JSON aninhado com UTF-8).
  - Verifier determinístico já aplica a regra de evidência sobre o que foi **observado** nesta execução por
    `read_product_evidence` (`review_status = verified`, mesmo produto). Contrato de saída esperado de
    `read_product_evidence`: `{ items: [{ id, product_id, review_status, ... }] }` (implementado na etapa 3).
    A etapa 7 liga o adaptador de modelo e confirma a regra com dados reais.
- **19/11/2026 — etapa 3.** Ferramentas de leitura em `src/lib/agents/executor/tools/` (`db.ts`, `read.ts`), sem
  dependências novas e sem migration.
  - **Porta `ToolDb`**: a ferramenta descreve a consulta (tabela da allowlist `READ_TABLES`, colunas, filtros, ordem,
    limite) e o adaptador `postgrestToolDb` aplica `organization_id = ctx.organizationId` **sempre, antes de qualquer
    filtro**; filtro manual de `organization_id`, coluna fora de `^[a-z_][a-z0-9_]*$`, tabela fora da lista ou
    organização vazia são recusados antes de tocar o banco. Como o worker roda com `service_role` (sem RLS), essa é a
    barreira de tenant das leituras; há teste de mutação (remover o filtro quebra a suíte). Erro do banco não vaza a
    mensagem original (só tabela e código).
  - **Ferramentas**: `read_products` (sem arquivados por padrão, ordem por score), `read_product_evidence` (filtro por
    até 20 produtos e status; saída `{ items: [{ id, product_id, review_status, ... }] }` em minúsculas, o contrato do
    Verifier), `read_content` (sem arquivados; textos cortados), `read_publication_queue` (próximos e não cancelados por
    padrão), `read_finance_summary` (7/30/90 dias).
  - **Saída**: ≤ 50 itens e ≤ 60.000 bytes (`TOOL_OUTPUT_MAX_BYTES`, folga sob os 64 KB do banco); pedimos `limit + 1`
    para devolver `truncated = true` quando havia mais. Sem `created_by`, `captured_by`, `reviewed_by`, `approved_by`,
    `cancelled_by`, e-mail, `affiliate_url`, `external_id` ou `review_note` (lista `FORBIDDEN_COLUMNS`, testada).
  - **Entrada estrita**: chave desconhecida (inclusive `organization_id`) ou valor fora do domínio lança
    `invalid_input` → o executor grava `tool_error`; entrada inválida não consulta o banco.
  - **Financeiro**: afiliados (estado atual do ciclo de vida, por status, da visão `affiliate_commission_summary`),
    vendas próprias (bruto e taxas sem cancelados; reembolsos à parte) e mídia paga (gasto como custo; dia de São Paulo)
    em blocos separados, por moeda, sem total entre domínios. Soma em inteiro escalado 10⁴ (`numeric(18,4)`), sem
    ponto flutuante; valores saem como texto decimal.
  - **Limitação conhecida**: vendas e mídia são agregadas no servidor lendo até `FINANCE_SCAN_LIMIT` = 5.000 linhas
    por domínio; acima disso o bloco sai com `truncated = true` (o modelo é avisado, nada é inventado). Se o volume
    real passar disso, a correção é uma função SQL `service_role` de agregação (migration própria, com autorização).
  - **Para a etapa 6**: o cliente Supabase tipado não é atribuível diretamente a `PostgrestLike` (TS2589, tipo
    profundo demais); o worker fará a conversão explícita para `PostgrestLike` só nesse ponto — o comportamento do
    adaptador já está coberto pelos testes com builder falso.
- **19/11/2026 — etapa 4.** Migration `20261119040000_agent_draft_content.sql` (aditiva) e teste
  `supabase/tests/014_agent_draft_content.test.sql`. **Não aplicada** em staging nem produção (🔐 Owner).
  - **Coluna** `content_items.agent_run_id` (FK `agent_runs`, `on delete restrict`, índice parcial). Gatilho
    `content_items_a_agent_guard` (security invoker, roda antes do `content_items_guard`): `anon`/`authenticated` não
    criam conteúdo com marca de agente (`agent_run_reserved`) e ninguém altera a marca depois (`agent_run_immutable`).
  - **Função** `agent_draft_content(p_run_id uuid, p_draft jsonb)` → `(content_id, content_version, content_hash,
    content_status)`, só `service_role`. Exige: execução em `planning`/`executing` (fila, verificação e encerradas
    recusam `run_not_active`), kill switch desligado, `draft_content` liberado no workspace (`tool_not_allowed`),
    autor da execução ainda owner/admin do workspace (`run_owner_not_allowed`, mesma regra da criação manual) e no máximo
    5 rascunhos por execução (`draft_limit_reached`).
  - **Entrada estrita** (`invalid_draft`): só `title` (obrigatório, ≤ 180), `product` (≤ 180), `script` (≤ 8.000),
    `caption` (≤ 2.200), `cta` (≤ 300), `hashtags` (≤ 500) e `channels` (subconjunto de YouTube/Instagram/TikTok,
    deduplicado). `status`, `rights_confirmed`, `source_url`, `asset_url`, mídia e `organization_id` não são aceitos:
    o rascunho nasce `draft`, sem direitos declarados, sem fonte externa e sem mídia; o workspace vem da execução.
  - **Sem aprovação nem agendamento**: o teste confirma zero `content_approvals` e zero `publication_jobs`; tentar
    `status = 'approved'` sem decisão falha em `approval_required`; a aprovação continua sendo `approve_content` por
    owner/admin com o hash exato (viewer recusado). Histórico em `content_versions` e `audit_log` como qualquer conteúdo
    (com `actor_id`/`created_by` nulos no histórico, porque o executor não tem sessão de usuário).
  - **Tipos**: `database.types.ts` ganhou `agent_run_id` e a assinatura de `agent_draft_content`.
  - **Para a etapa 6**: o handler TypeScript de `draft_content` (RPC `agent_draft_content` com o `runId` do contexto,
    nunca do modelo) entra junto com o worker, que é quem tem o cliente `service_role`; erros do banco mapeiam para
    `tool_error` sem vazar a mensagem.
- **19/11/2026 — etapa 5.** Migration `20261119050000_agent_claim_queue.sql` (aditiva) e teste
  `supabase/tests/015_agent_claim_queue.test.sql`. **Não aplicada** em staging nem produção (🔐 Owner).
  - **Coluna** `agent_runs.claimed_at` (anulável) + `check (status <> 'queued' or claimed_at is null)` (vale para as
    linhas existentes, todas com `claimed_at` nulo) e índice parcial `agent_runs_queued_idx (created_at, id)`.
  - **`agent_claim_next_run()`** → zero ou uma linha `(run_id, organization_id, agent, goal, max_steps, step_count,
    created_by, granted_tools text[], claimed_at)`, só `service_role`. Reserva a mais antiga da fila e move
    `queued → planning` gravando `claimed_at`/`started_at`; não grava passo (o `plan` continua sendo do executor).
    Contexto e ferramentas liberadas vêm das tabelas — é o `RunContext` do worker.
  - **Sem corrida**: candidatas lidas sem trava; para cada uma, `pg_try_advisory_xact_lock` do workspace, depois
    checagem de execução ativa no workspace e só então `FOR UPDATE SKIP LOCKED` da linha (com `status = 'queued'`
    rechecado). Primeira versão travava todas as linhas varridas pelo cursor e um worker concorrente ficava sem
    nada; corrigido antes do PR e confirmado com sessões reais.
  - **Uma execução ativa por workspace**: se já há `planning/executing/verifying` no workspace, a próxima espera.
  - **Na reserva**: workspace com kill switch → execução `killed` (`kill_switch`); autor que deixou de ser
    owner/admin → `failed` (`run_owner_not_allowed`). Nada roda em nome de quem perdeu o acesso.
  - **`agent_reap_stale_runs(p_lease_seconds = 600)`** (60–3600, senão `invalid_lease`) → quantas expirou. Ativa
    sem atividade (maior entre último passo, `claimed_at`, `started_at`, `created_at`) além do lease vira `failed`
    (`worker_timeout`); linhas travadas por worker em andamento são puladas (`SKIP LOCKED`).
  - **Corrida real (Postgres 16 local, fora da suíte)**: sessão 1 reserva no workspace A e segura a transação 3 s;
    sessão 2 concorrente reserva a do workspace B; terceira chamada não reserva nada (A ocupado, B reservado); a 2ª
    execução de A segue `queued`. Em massa: 20 execuções em 20 workspaces, 8 sessões × 5 chamadas concorrentes →
    20 reservas, 0 duplicadas.
  - **Tipos**: `database.types.ts` ganhou `claimed_at` e as duas funções.
  - **Para a etapa 6**: o worker chama `agent_reap_stale_runs` e depois `agent_claim_next_run` a cada disparo;
    lease (600 s) precisa ficar acima da duração máxima da função na Vercel.
  - **Limitação conhecida**: `agent_record_step` (S13) ainda aceita `plan` direto de `queued` sem reserva; o worker
    só usa execuções reservadas. Exigir reserva no banco mudaria função do S13 — fica como proposta, não feito aqui.
- **19/11/2026 — etapa 6.** Worker HTTP, store real e `draft_content` em TypeScript. Sem migration, sem dependência
  nova, sem configuração remota.
  - **Rota** `src/app/api/agents/worker/route.ts` (GET, `runtime = nodejs`, `dynamic = force-dynamic`,
    `maxDuration = 300` < lease de 600 s). Lógica em `src/lib/agents/worker/handler.ts`, testável sem o Next. Barreiras,
    nesta ordem e sem efeito colateral antes de passar todas: flag `AGENT_EXECUTOR_ENABLED === "true"` → segredo
    `CRON_SECRET` (≥ 32 caracteres) → `Authorization: Bearer` comparado em tempo constante (SHA-256 dos dois lados +
    `timingSafeEqual`, `worker/auth.ts`) → modelo configurado → chave `SUPABASE_SECRET_KEY`. Só então o cliente
    `service_role` (`src/lib/supabase/service.ts`) é criado. Respostas com `Cache-Control: no-store`, só ids e códigos
    (nada de objetivo, saída de ferramenta ou dado de produto); erro inesperado → 500 sem detalhes (detalhe só no log).
  - **Proxy**: `/api/agents/worker` é a única "rota de máquina" (`isMachineRoute`): o proxy não exige sessão nem toca
    cookies nela; a rota se autentica sozinha. Demais `/api/*` continuam 401 sem sessão (conferido com `next start`).
  - **Disparo** (`worker/tick.ts`): sem modelo não reserva nem expira nada (execuções continuam `queued`); com modelo,
    `agent_reap_stale_runs(600)` e depois até 3 reservas (`agent_claim_next_run`) dentro de 120 s para *começar*
    execuções. Reserva inconsistente (agente desconhecido, contexto vazio, passos já existentes) é falhada com
    `internal_error` em vez de adivinhar. Ferramentas liberadas são filtradas pela allowlist do código também.
  - **Store** (`executor/store.ts`): `agent_record_step` / `agent_finish_run` / `agent_fail_run` e leitura só de
    `agent_runs.status`; erros do banco viram `AgentDbError` com o código (`run_not_active` etc.), que o loop já trata.
  - **`draft_content`** (`executor/tools/draft.ts`): RPC `agent_draft_content` com `runId` do contexto (nunca da entrada);
    entrada vai inteira ao banco, que a valida estritamente; saída só `content_id`, `content_version`,
    `content_status`; qualquer status diferente de `draft` é erro; mensagem de erro desconhecida vira `draft_failed`.
  - **Modelo**: `executor/model.ts` devolve sempre `null` nesta etapa — a rota responde `503 model_not_configured`
    mesmo com tudo ligado. A etapa 7 liga o adaptador.
  - **Limitações conhecidas**: (1) uma execução já iniciada não é cortada pelo orçamento do disparo; se a Vercel encerrar
    a função no meio, o lease falha a execução com `worker_timeout` no disparo seguinte (até ~10 min depois). Com
    `maxSteps` alto e timeout de 20 s por passo, uma execução pode passar de 300 s — a etapa 7 deve passar um prazo total
    ao `runAgent` ou limitar passos. (2) Sem teste de integração contra PostgREST real: os nomes de parâmetros das RPCs
    foram conferidos com as migrations e `database.types.ts`, e os testes usam cliente falso.
- **19/11/2026 — etapa 7.** Adaptador de modelo, Verifier de evidência e prazo total. Sem migration, sem dependência
  nova, sem configuração remota e sem nenhuma chamada real ao modelo (todos os testes usam `fetch` falso).
  - **Configuração explícita** (`executor/model.ts`): o modelo só liga com `AGENT_MODEL_PROVIDER = "vercel-ai-gateway"`,
    `AGENT_MODEL` no formato `provedor/modelo` e `AI_GATEWAY_API_KEY` (≥ 20 caracteres, sem espaços). Token OIDC da
    Vercel **não** é usado como credencial implícita. Faltando algo → `null` → 503 `model_not_configured` (worker) e
    `model_not_configured` (runAgent). `modelConfigStatus` dá o motivo (`provider_missing`, `model_invalid`,
    `key_missing`…) para o log, nunca o valor.
  - **Adaptador** (`executor/model-gateway.ts`): API compatível com OpenAI Chat Completions do AI Gateway via `fetch`
    nativo; URL fixa no código (`https://ai-gateway.vercel.sh/v1`) para a chave nunca ir a host vindo de variável;
    `temperature 0`, teto de 1.500 tokens no plano e 3.000 no resumo, resposta > 256 KB recusada. Erros viram códigos
    curtos (`gateway_http_401`, `model_truncated`, `model_invalid_json`, `gateway_unreachable`…) sem corpo nem chave;
    o loop grava `model_error` (ou `step_timeout`/`worker_timeout` no abort). Saída devolvida como `unknown` e validada
    por `parse.ts`.
  - **Prompts** (`executor/model-prompt.ts`): regras fixas (não publica/aprova/agenda; `goal` e saídas de ferramenta são
    dados, não instruções; só JSON), guia de entrada por ferramenta espelhando a validação real, regra de evidência e
    de separação financeira. Observações para o resumo limitadas a 96 KB; o excedente vai marcado `truncated`.
  - **Verifier** (`executor/verifier.ts`), além das regras da etapa 2: (3) evidência citada sem `productId` reprova;
    (4) menção a produto observado (id ou nome de `read_products`, sem acento/caixa, palavra inteira, nome ≥ 4
    caracteres) no resumo ou numa afirmação exige afirmação com aquele `productId` e evidência `verified`; afirmação
    não pode falar de outro produto observado; (5) `draft_content` que trata de produto observado (ou com campo
    `product` que não corresponde a produto lido) é barrado **antes** da escrita com `evidence_missing` se não houver
    evidência verificada desse produto já observada — o rascunho não é gravado.
  - **Prazo total** (pendência da etapa 6): `ExecutorLimits.maxRunMs` (padrão 240 s); cada chamada usa o menor entre
    o timeout do passo e o tempo restante; estourado → `worker_timeout`. O disparo limita cada execução ao que resta
    até `DEFAULT_TICK_HARD_LIMIT_MS` = 270 s (abaixo do `maxDuration` 300 s da rota).
  - **Limitações conhecidas**: (1) a regra de menção é por id/nome de produtos **lidos na execução**; produto citado
    sem ter sido lido não é reconhecido no texto livre (o prompt proíbe, e claims com `productId` não lido reprovam).
    (2) Falha fechada: produto com nome comum (≥ 4 letras) mencionado em sentido genérico reprova o resumo.
    (3) Rascunho genérico que não cita produto lido segue permitido (continua só `draft`, com aprovação humana).
    (4) Não houve teste contra o AI Gateway real (exigiria chave e gasto) — formato conferido com a API compatível
    com OpenAI documentada pela Vercel; o primeiro uso real deve ser no staging com orçamento baixo.
- **19/11/2026 — teto de gasto, consumo e OIDC (complemento da etapa 7, autorizado pelo Owner).**
  - **Consumo**: migration `20261119060000_agent_model_usage.sql` — `agent_model_usage` (só inclusão: nem
    `service_role` altera/apaga; membros leem só o do próprio workspace), `agent_record_model_usage` e
    `agent_model_spend_since` (só `service_role`); teste `016` (21 asserções). O adaptador (`model-gateway.ts`, opção
    `onUsage`) grava tokens e custo de toda resposta 2xx **antes** de validar o conteúdo; sem `usage` ou com resposta
    ilegível cobra o pior caso; se a gravação falhar, a chamada falha.
  - **Preço e teto**: `model-pricing.ts` (Haiku 5.5, GPT-5 mini e Opus 5.5 com preços do catálogo do Gateway em
    19/11/2026 + 10%). O worker exige `AGENT_MONTHLY_BUDGET_USD` e modelo com preço (senão `503 budget_not_configured`,
    sem criar cliente) e relê o gasto do mês (UTC) antes de **cada** reserva; atingido, para com `budget_exhausted`.
    Teto suave: a execução em andamento termina.
  - **OIDC**: `AGENT_MODEL_AUTH=oidc` usa o token OIDC do deployment (header `x-vercel-oidc-token` da invocação, ou
    `VERCEL_OIDC_TOKEN`) como credencial do Gateway. Opt-in explícito: token presente sem a variável continua
    `key_missing` (regra da etapa 7 preservada). `AI_GATEWAY_API_KEY` segue funcionando sem a variável.
  - **Cron**: `vercel.json` com `/api/agents/worker` diário às 11:17 UTC.
  - **Não verificado ainda**: chamada real ao Gateway e presença do header OIDC no runtime (exige `SUPABASE_SECRET_KEY`
    e crédito no Gateway); no primeiro disparo, `reason: "oidc_token_missing"` no log indicaria problema no token.
- **19/11/2026 — PR #42 (complemento da etapa 7).** O Playwright falhou por indisponibilidade do espelho Ubuntu
  (`apt` 503 ao instalar dependências do navegador), não por código; merge da integração (#44) na head refez o CI.
- **19/11/2026 — etapa 8.** Detalhe da execução em `/agentes/[id]`. Sem migration e sem dependência nova.
  - `src/lib/agents/detail.ts` (puro, testado): motivo legível para todo código de `EXECUTOR_ERROR_CODES` e para os
    códigos do banco (`step_limit`, `kill_switch`, `run_owner_not_allowed`…); código desconhecido aparece entre
    parênteses só se tiver formato de código (texto arbitrário não é ecoado); resumo de entrada/saída em uma linha
    (profundidade 2, 4 itens, 280 caracteres) e JSON completo cortado em 8 KB; soma de consumo em micro-dólares
    (aceita `numeric` como número ou texto); rascunho só é mostrado se `draft_content` ok com `content_status = draft`.
  - `loadRunDetail()` filtra por `organization_id` do usuário além da RLS; `agent_model_usage` ausente
    (`PGRST205`/`42P01`) vira "migration pendente" em vez de erro.
  - Página sem ação de publicar/aprovar; o rascunho aponta para revisão humana no Content Studio; cancelar continua
    restrito a owner/admin em execução ativa. Ações revalidam `/agentes` como layout (inclui o detalhe).
- **19/11/2026 — etapa 9.** `docs/S14_HANDOFF.md` e linha do S14 no `docs/ROADMAP_SPLITS.md`. Frente concluída no código;
  pendências do Owner no handoff.


## Reconciliação operacional — 21/11/2026, 08:00 BRT (consulta direta)

Esta seção supersede contagens e estados anteriores quando houver divergência.

### GitHub, branches, PRs e validação
- PR #61 continua aberta/Draft, mas o estado atual não é o descrito no corpo antigo: head `6e26aee1f92b338ec9860a820a98a748b0dec444`, base branch atual em `564bee5a210185b04887a430fc073b95ac770bb0`; comparação `17 ahead / 5 behind`, `status=diverged`, `mergeable=false`. Não fazer merge nem forçar atualização.
- Os cinco commits que avançaram a integração desde o merge-base alteraram somente `docs/INTEGRATION_STATUS.md`, `docs/ROADMAP_SPLITS.md`, `docs/S16_HANDOFF.md`, `docs/S16_PROGRESS.md`, `tests/e2e/admin-finance.spec.mjs` e `tests/e2e/products.spec.mjs`; não há conflito de arquivo com o patch S14.
- O patch de três arquivos de código/teste da PR #61 foi portado para uma branch nova baseada na head atual da integração: `fix/s14-timeout-ledger-rebased-20261121-0800`. PR #64 foi aberta em Draft na branch rebaseada; comparação 6 ahead / 0 behind e mergeable=true. A PR #61 foi fechada sem merge como superseded após a PR #64 ficar mergeable e o CI #44897305593 passar no patch de código.
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
