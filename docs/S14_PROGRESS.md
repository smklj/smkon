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
| 7 | Adaptador de modelo sem chave (recusa `model_not_configured`); Verifier exige evidência `verified` | ⬜ | — | — |
| 8 | UI: detalhe da execução em `/agentes` (passos resumidos, motivo de falha), sem publicar | ⬜ | — | — |
| 9 | Handoff `docs/S14_HANDOFF.md` + estado no `docs/ROADMAP_SPLITS.md` | ⬜ | — | — |

## Autorizações do Owner que o S14 vai precisar (🔐)

Nada disso é feito pela tarefa agendada; fica listado no PR de cada etapa que depender dele.

- Aplicar no staging e depois na produção as migrations das etapas 4 e 5.
- Configurar na Vercel (só servidor, nunca `NEXT_PUBLIC_`): `CRON_SECRET` (≥ 32 caracteres), `AGENT_EXECUTOR_ENABLED=true`
  (só quando quiser ligar) e `SUPABASE_SECRET_KEY` (chave secreta/service_role do Supabase; hoje não existe no projeto),
  e o cron do worker (ver "Configuração do worker" abaixo).
- Escolher provedor de IA (Vercel AI Gateway ou Anthropic), modelo e orçamento; criar a chave.

## Configuração do worker (etapa 6 — 🔐 a fazer pelo Owner, nada disso foi aplicado)

1. Migrations das etapas 4 e 5 aplicadas no ambiente (staging primeiro).
2. Variáveis no projeto `smkon` da Vercel (Production/Preview conforme o ambiente): `SUPABASE_SECRET_KEY`, `CRON_SECRET`
   (gerar com 32+ caracteres aleatórios), `AGENT_EXECUTOR_ENABLED=true` e, na etapa 7, a credencial do provedor de IA.
3. Cron (exemplo, **não** está no repositório):
   ```json
   { "crons": [{ "path": "/api/agents/worker", "schedule": "*/5 * * * *" }] }
   ```
   A Vercel envia `Authorization: Bearer $CRON_SECRET` automaticamente. No plano Hobby a Vercel só permite cron diário;
   intervalo de minutos exige plano Pro.
4. Respostas: `503 executor_disabled` (flag), `503 worker_not_configured` (segredo), `401 not_authenticated`,
   `503 model_not_configured` (até a etapa 7 + credencial), `503 service_not_configured` (chave), `200
   { reaped, stoppedBy, runs: [{ runId, status, code? }] }`.

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
