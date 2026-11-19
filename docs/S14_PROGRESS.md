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
| 3 | Ferramentas `read_*` reais, escopadas por organização, colunas mínimas, ≤ 50 itens / 64 KB; testes | ⬜ | — | — |
| 4 | `draft_content`: migration + função `service_role` só de rascunho + `supabase/tests/014_*.test.sql` | ⬜ | — | — |
| 5 | Claim da fila: migration `agent_claim_next_run()` com `FOR UPDATE SKIP LOCKED` + lease + testes SQL | ⬜ | — | — |
| 6 | Worker `/api/agents/worker` (CRON_SECRET em tempo constante; desligado por flag; `service_role` só no servidor) | ⬜ | — | — |
| 7 | Adaptador de modelo sem chave (recusa `model_not_configured`); Verifier exige evidência `verified` | ⬜ | — | — |
| 8 | UI: detalhe da execução em `/agentes` (passos resumidos, motivo de falha), sem publicar | ⬜ | — | — |
| 9 | Handoff `docs/S14_HANDOFF.md` + estado no `docs/ROADMAP_SPLITS.md` | ⬜ | — | — |

## Autorizações do Owner que o S14 vai precisar (🔐)

Nada disso é feito pela tarefa agendada; fica listado no PR de cada etapa que depender dele.

- Aplicar no staging e depois na produção as migrations das etapas 4 e 5.
- Configurar `CRON_SECRET`, `AGENT_EXECUTOR_ENABLED` e `SUPABASE_SERVICE_ROLE_KEY` (se ainda não existir no servidor) na Vercel, e o cron do worker.
- Escolher provedor de IA (Vercel AI Gateway ou Anthropic), modelo e orçamento; criar a chave.

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
