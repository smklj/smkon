import { test } from "node:test";
import assert from "node:assert/strict";
import { bearerMatches, cronSecret, executorEnabled, MIN_CRON_SECRET_LENGTH } from "../../src/lib/agents/worker/auth.ts";
import { rpcWorkerQueue, toRunContext, type ClaimedRun, type WorkerQueue } from "../../src/lib/agents/worker/queue.ts";
import { runWorkerTick } from "../../src/lib/agents/worker/tick.ts";
import { handleWorkerRequest, workerTools, type WorkerDbClient } from "../../src/lib/agents/worker/handler.ts";
import { rpcAgentStore } from "../../src/lib/agents/executor/store.ts";
import { createDraftTool } from "../../src/lib/agents/executor/tools/draft.ts";
import { resolveAgentModel } from "../../src/lib/agents/executor/model.ts";
import { AgentDbError, type DbResult } from "../../src/lib/agents/executor/rpc.ts";
import type { ExecutorLogger } from "../../src/lib/agents/executor/run.ts";
import type { AgentModel, AgentStore, JsonObject, RunContext, StepRecord } from "../../src/lib/agents/executor/types.ts";
import type { RunStatus } from "../../src/lib/agents/types.ts";

const quiet: ExecutorLogger = () => {};
const SECRET = "s".repeat(MIN_CRON_SECRET_LENGTH) + "-cron";
const RUN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

// ---------------------------------------------------------------------------------------------------------------
// Cliente falso: grava chamadas RPC/select e devolve respostas programadas.
// ---------------------------------------------------------------------------------------------------------------

type Call = { kind: "rpc"; fn: string; args?: Record<string, unknown>; signal?: AbortSignal } | { kind: "from"; table: string; columns: string; filters: [string, unknown][] };

function thenable(result: DbResult): PromiseLike<DbResult> {
  return { then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) };
}

function fakeClient(responses: { rpc?: Record<string, (args?: Record<string, unknown>) => DbResult>; select?: (table: string) => DbResult } = {}) {
  const calls: Call[] = [];
  const client = {
    rpc(fn: string, args?: Record<string, unknown>) {
      const call: Call = { kind: "rpc", fn, args };
      calls.push(call);
      const result = responses.rpc?.[fn]?.(args) ?? { data: null, error: null };
      return Object.assign(thenable(result), {
        abortSignal(signal: AbortSignal) {
          (call as { signal?: AbortSignal }).signal = signal;
          return thenable(result);
        },
      });
    },
    from(table: string) {
      return {
        select(columns: string) {
          const call: Call = { kind: "from", table, columns, filters: [] };
          calls.push(call);
          const result = responses.select?.(table) ?? { data: [], error: null };
          const builder: Record<string, unknown> = {};
          const chain = (name: string) => (column: string, value: unknown) => {
            call.filters.push([`${name}:${column}`, value]);
            return builder;
          };
          Object.assign(builder, {
            eq: chain("eq"), neq: chain("neq"), gte: chain("gte"), lt: chain("lt"), in: chain("in"),
            order: () => builder, limit: () => builder, abortSignal: () => builder,
            maybeSingle: () => thenable(result),
            then: (resolve: (v: DbResult) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
          });
          return builder;
        },
      };
    },
  };
  return { client: client as unknown as WorkerDbClient, calls };
}

function context(overrides: Partial<RunContext> = {}): RunContext {
  return {
    runId: RUN,
    organizationId: ORG,
    agent: "content_drafting",
    goal: "Propor um roteiro",
    maxSteps: 6,
    grantedTools: ["read_products", "draft_content"],
    createdBy: USER,
    ...overrides,
  };
}

function claimed(overrides: Partial<ClaimedRun> = {}): ClaimedRun {
  return {
    runId: RUN,
    organizationId: ORG,
    agent: "product_research",
    goal: "Avaliar produtos",
    maxSteps: 6,
    stepCount: 0,
    createdBy: USER,
    grantedTools: ["read_products", "read_product_evidence"],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Proteção da rota
// ---------------------------------------------------------------------------------------------------------------

test("executor só liga com AGENT_EXECUTOR_ENABLED exatamente \"true\"", () => {
  assert.equal(executorEnabled({}), false);
  assert.equal(executorEnabled({ AGENT_EXECUTOR_ENABLED: "TRUE" }), false);
  assert.equal(executorEnabled({ AGENT_EXECUTOR_ENABLED: "1" }), false);
  assert.equal(executorEnabled({ AGENT_EXECUTOR_ENABLED: " true" }), false);
  assert.equal(executorEnabled({ AGENT_EXECUTOR_ENABLED: "true" }), true);
});

test("CRON_SECRET ausente, curto ou com espaços nas pontas é recusado", () => {
  assert.equal(cronSecret({}), null);
  assert.equal(cronSecret({ CRON_SECRET: "x".repeat(MIN_CRON_SECRET_LENGTH - 1) }), null);
  assert.equal(cronSecret({ CRON_SECRET: ` ${SECRET}` }), null);
  assert.equal(cronSecret({ CRON_SECRET: SECRET }), SECRET);
});

test("bearerMatches aceita só \"Bearer <segredo>\" exato", () => {
  assert.equal(bearerMatches(`Bearer ${SECRET}`, SECRET), true);
  assert.equal(bearerMatches(null, SECRET), false);
  assert.equal(bearerMatches("", SECRET), false);
  assert.equal(bearerMatches(SECRET, SECRET), false);
  assert.equal(bearerMatches(`bearer ${SECRET}`, SECRET), false);
  assert.equal(bearerMatches(`Bearer ${SECRET} `, SECRET), false);
  assert.equal(bearerMatches(`Bearer ${SECRET.slice(0, -1)}X`, SECRET), false, "mesmo tamanho, último caractere diferente");
  assert.equal(bearerMatches(`Bearer ${SECRET}${SECRET}`, SECRET), false);
  assert.equal(bearerMatches("Bearer ", SECRET), false);
});

// ---------------------------------------------------------------------------------------------------------------
// Store real (RPCs do S13)
// ---------------------------------------------------------------------------------------------------------------

test("store: recordStep chama agent_record_step com todos os parâmetros e devolve seq/estado", async () => {
  const { client, calls } = fakeClient({ rpc: { agent_record_step: () => ({ data: [{ step_seq: 3, run_status: "executing" }], error: null }) } });
  const store = rpcAgentStore(client);
  const step: StepRecord = { runId: RUN, phase: "execute", tool: "read_products", input: { limit: 5 }, output: { items: [] }, status: "ok" };
  assert.deepEqual(await store.recordStep(step), { seq: 3, runStatus: "executing" });
  assert.deepEqual(calls[0], {
    kind: "rpc",
    fn: "agent_record_step",
    args: { p_run_id: RUN, p_phase: "execute", p_tool: "read_products", p_input: { limit: 5 }, p_output: { items: [] }, p_status: "ok", p_detail: null },
  });
});

test("store: step_limit do banco vira seq null; erro do banco vira AgentDbError com o código", async () => {
  const limited = rpcAgentStore(fakeClient({ rpc: { agent_record_step: () => ({ data: [{ step_seq: null, run_status: "failed" }], error: null }) } }).client);
  assert.deepEqual(await limited.recordStep({ runId: RUN, phase: "plan", tool: null, input: {}, output: {}, status: "ok" }), { seq: null, runStatus: "failed" });

  const inactive = rpcAgentStore(fakeClient({ rpc: { agent_record_step: () => ({ data: null, error: { message: "run_not_active", code: "55000" } }) } }).client);
  await assert.rejects(
    inactive.recordStep({ runId: RUN, phase: "plan", tool: null, input: {}, output: {}, status: "ok" }),
    (error: unknown) => error instanceof AgentDbError && error.message === "run_not_active" && error.code === "55000",
  );

  const weird = rpcAgentStore(fakeClient({ rpc: { agent_record_step: () => ({ data: [{ step_seq: 1, run_status: "bogus" }], error: null }) } }).client);
  await assert.rejects(weird.recordStep({ runId: RUN, phase: "plan", tool: null, input: {}, output: {}, status: "ok" }), /unexpected_step_result/);
});

test("store: currentStatus lê só status por id; finish e fail chamam as RPCs certas", async () => {
  const { client, calls } = fakeClient({ select: () => ({ data: { status: "killed" }, error: null }) });
  const store = rpcAgentStore(client);
  assert.equal(await store.currentStatus(RUN), "killed");
  assert.deepEqual(calls[0], { kind: "from", table: "agent_runs", columns: "status", filters: [["eq:id", RUN]] });

  await store.finish(RUN, { summary: "ok" });
  await store.fail(RUN, "tool_error");
  assert.deepEqual(calls.slice(1).map((c) => c.kind === "rpc" && [c.fn, c.args]), [
    ["agent_finish_run", { p_run_id: RUN, p_outcome: { summary: "ok" } }],
    ["agent_fail_run", { p_run_id: RUN, p_error_code: "tool_error" }],
  ]);

  const missing = rpcAgentStore(fakeClient({ select: () => ({ data: null, error: null }) }).client);
  await assert.rejects(missing.currentStatus(RUN), /agent_run_not_found/);
});

// ---------------------------------------------------------------------------------------------------------------
// draft_content
// ---------------------------------------------------------------------------------------------------------------

test("draft_content usa o runId do contexto (nunca da entrada) e devolve só id/versão/status", async () => {
  const { client, calls } = fakeClient({
    rpc: { agent_draft_content: () => ({ data: [{ content_id: "dddd", content_version: 1, content_hash: "h", content_status: "draft" }], error: null }) },
  });
  const tool = createDraftTool(client);
  const signal = new AbortController().signal;
  const input: JsonObject = { title: "Roteiro", run_id: "outra-execucao" };
  const output = await tool(context(), input, signal);
  assert.deepEqual(output, { content_id: "dddd", content_version: 1, content_status: "draft" });
  const call = calls[0];
  assert.ok(call.kind === "rpc");
  assert.equal(call.fn, "agent_draft_content");
  assert.deepEqual(call.args, { p_run_id: RUN, p_draft: input }, "entrada vai inteira ao banco, que recusa chaves desconhecidas");
  assert.equal(call.signal, signal);
});

test("draft_content: erro conhecido mantém o código; desconhecido não vaza mensagem; status ≠ draft é erro", async () => {
  const known = createDraftTool(fakeClient({ rpc: { agent_draft_content: () => ({ data: null, error: { message: "draft_limit_reached" } }) } }).client);
  await assert.rejects(known(context(), { title: "x" }, new AbortController().signal), /^DraftToolError: draft_limit_reached$/);

  const leaky = createDraftTool(fakeClient({ rpc: { agent_draft_content: () => ({ data: null, error: { message: "duplicate key value violates unique constraint \"segredo_idx\"" } }) } }).client);
  await assert.rejects(leaky(context(), { title: "x" }, new AbortController().signal), (error: Error) => error.message === "draft_failed");

  const approved = createDraftTool(fakeClient({ rpc: { agent_draft_content: () => ({ data: [{ content_id: "d", content_version: 1, content_status: "approved" }], error: null }) } }).client);
  await assert.rejects(approved(context(), { title: "x" }, new AbortController().signal), /draft_unexpected_result/);

  const notObject = createDraftTool(fakeClient().client);
  await assert.rejects(notObject(context(), [] as unknown as JsonObject, new AbortController().signal), /invalid_draft/);
});

test("registro do worker tem as 6 ferramentas da allowlist e nenhuma outra", () => {
  assert.deepEqual(Object.keys(workerTools(fakeClient().client)).sort(), [
    "draft_content", "read_content", "read_finance_summary", "read_product_evidence", "read_products", "read_publication_queue",
  ]);
});

// ---------------------------------------------------------------------------------------------------------------
// Fila
// ---------------------------------------------------------------------------------------------------------------

test("fila: claim mapeia a linha de agent_claim_next_run; sem linha → null; reap repassa o lease", async () => {
  const row = { run_id: RUN, organization_id: ORG, agent: "product_research", goal: "g", max_steps: 8, step_count: 0, created_by: USER, granted_tools: ["read_products"], claimed_at: "2026-11-19T00:00:00Z" };
  const { client, calls } = fakeClient({ rpc: { agent_claim_next_run: () => ({ data: [row], error: null }), agent_reap_stale_runs: () => ({ data: 2, error: null }) } });
  const queue = rpcWorkerQueue(client);
  assert.equal(await queue.reap(600), 2);
  assert.deepEqual(await queue.claim(), claimed({ goal: "g", maxSteps: 8, grantedTools: ["read_products"] }));
  assert.deepEqual(calls.map((c) => c.kind === "rpc" && [c.fn, c.args]), [["agent_reap_stale_runs", { p_lease_seconds: 600 }], ["agent_claim_next_run", undefined]]);

  const empty = rpcWorkerQueue(fakeClient({ rpc: { agent_claim_next_run: () => ({ data: [], error: null }) } }).client);
  assert.equal(await empty.claim(), null);
});

test("toRunContext: só ferramentas da allowlist; linha inconsistente é recusada", () => {
  const ok = toRunContext(claimed({ grantedTools: ["read_products", "publish_now", "draft_content"] }));
  assert.ok("ctx" in ok);
  assert.deepEqual(ok.ctx.grantedTools, ["read_products", "draft_content"]);
  assert.equal(ok.ctx.organizationId, ORG);

  assert.deepEqual(toRunContext(claimed({ agent: "publisher" })), { invalid: "unknown_agent" });
  assert.deepEqual(toRunContext(claimed({ organizationId: "" })), { invalid: "missing_context" });
  assert.deepEqual(toRunContext(claimed({ maxSteps: Number.NaN })), { invalid: "invalid_max_steps" });
  assert.deepEqual(toRunContext(claimed({ stepCount: 1 })), { invalid: "unexpected_step_count" });
});

// ---------------------------------------------------------------------------------------------------------------
// Disparo do worker
// ---------------------------------------------------------------------------------------------------------------

function memoryQueue(runs: ClaimedRun[]) {
  const log: string[] = [];
  const queue: WorkerQueue = {
    async reap(lease) {
      log.push(`reap:${lease}`);
      return 0;
    },
    async claim() {
      log.push("claim");
      return runs.shift() ?? null;
    },
  };
  return { queue, log };
}

/** Store em memória mínimo que segue as regras do S13 relevantes aqui. */
function memoryStore() {
  const steps: StepRecord[] = [];
  const statuses = new Map<string, RunStatus>();
  const failures: [string, string][] = [];
  const finished: [string, JsonObject][] = [];
  const store: AgentStore = {
    async currentStatus(runId) {
      return statuses.get(runId) ?? "planning";
    },
    async recordStep(step) {
      steps.push(step);
      const status: RunStatus = step.phase === "plan" ? "executing" : step.phase === "verify" ? "verifying" : "executing";
      statuses.set(step.runId, status);
      return { seq: steps.length, runStatus: status };
    },
    async finish(runId, outcome) {
      finished.push([runId, outcome]);
      statuses.set(runId, "succeeded");
    },
    async fail(runId, code) {
      failures.push([runId, code]);
      statuses.set(runId, "failed");
    },
  };
  return { store, steps, failures, finished, statuses };
}

const fakeModel: AgentModel = {
  async plan() {
    return { steps: [{ tool: "read_products", input: { limit: 5 } }] };
  },
  async summarize() {
    return { text: "Nenhuma afirmação sobre produto.", claims: [] };
  },
};

test("tick sem modelo não toca na fila (execuções continuam queued)", async () => {
  const { queue, log } = memoryQueue([claimed()]);
  const { store } = memoryStore();
  const result = await runWorkerTick({ queue, store, model: null, tools: {}, logger: quiet });
  assert.deepEqual(result, { status: "model_not_configured" });
  assert.deepEqual(log, []);
});

test("tick: expira presas, reserva e executa de ponta a ponta (plan → execute → verify → finish)", async () => {
  const { queue, log } = memoryQueue([claimed()]);
  const memory = memoryStore();
  const tools = { read_products: async () => ({ items: [{ id: "p1", name: "Garrafa Térmica" }], truncated: false }) };
  const result = await runWorkerTick({ queue, store: memory.store, model: fakeModel, tools, logger: quiet, leaseSeconds: 900 });
  assert.equal(result.status, "ok");
  assert.ok(result.status === "ok");
  assert.deepEqual(result.runs, [{ runId: RUN, status: "succeeded" }]);
  assert.equal(result.stoppedBy, "empty_queue");
  assert.deepEqual(log, ["reap:900", "claim", "claim"]);
  assert.deepEqual(memory.steps.map((s) => s.phase), ["plan", "execute", "verify"]);
  assert.equal(memory.finished.length, 1);
  assert.deepEqual(memory.failures, []);
});

test("tick respeita maxRuns e o orçamento de tempo para começar execuções novas", async () => {
  const many = () => [claimed({ runId: "r1" }), claimed({ runId: "r2" }), claimed({ runId: "r3" })];
  const execute = async () => ({ status: "succeeded" as const, steps: 3 });

  const capped = memoryQueue(many());
  const byCount = await runWorkerTick({ queue: capped.queue, store: memoryStore().store, model: fakeModel, tools: {}, logger: quiet, maxRuns: 2, execute });
  assert.ok(byCount.status === "ok");
  assert.deepEqual(byCount.runs.map((r) => r.runId), ["r1", "r2"]);
  assert.equal(byCount.stoppedBy, "max_runs");

  let clock = 0;
  const timed = memoryQueue(many());
  const byBudget = await runWorkerTick({
    queue: timed.queue, store: memoryStore().store, model: fakeModel, tools: {}, logger: quiet, maxRuns: 10, budgetMs: 1000,
    now: () => clock,
    execute: async () => {
      clock += 600;
      return { status: "succeeded", steps: 3 };
    },
  });
  assert.ok(byBudget.status === "ok");
  assert.deepEqual(byBudget.runs.map((r) => r.runId), ["r1", "r2"], "a 3ª não começa depois de 1200 ms > 1000 ms");
  assert.equal(byBudget.stoppedBy, "budget");
  assert.deepEqual(timed.log.filter((e) => e === "claim").length, 2, "não reserva o que não vai executar");
});

test("tick: reserva inconsistente é falhada com internal_error e o disparo continua", async () => {
  const { queue } = memoryQueue([claimed({ runId: "bad", agent: "publisher" }), claimed({ runId: "good" })]);
  const memory = memoryStore();
  const executed: string[] = [];
  const result = await runWorkerTick({
    queue, store: memory.store, model: fakeModel, tools: {}, logger: quiet,
    execute: async (ctx) => {
      executed.push(ctx.runId);
      return { status: "failed", code: "tool_error", steps: 2 };
    },
  });
  assert.ok(result.status === "ok");
  assert.deepEqual(memory.failures, [["bad", "internal_error"]]);
  assert.deepEqual(executed, ["good"]);
  assert.deepEqual(result.runs, [
    { runId: "bad", status: "invalid", code: "internal_error", reason: "unknown_agent" },
    { runId: "good", status: "failed", code: "tool_error" },
  ]);
});

// ---------------------------------------------------------------------------------------------------------------
// Handler HTTP
// ---------------------------------------------------------------------------------------------------------------

const ENABLED = { AGENT_EXECUTOR_ENABLED: "true", CRON_SECRET: SECRET };

function request(authorization?: string) {
  return new Request("https://smkon.test/api/agents/worker", { headers: authorization ? { authorization } : {} });
}

async function call(env: Record<string, string>, authorization: string | undefined, opts: { model?: AgentModel | null; client?: WorkerDbClient | null } = {}) {
  let clientCreated = 0;
  const response = await handleWorkerRequest(request(authorization), {
    env,
    logger: quiet,
    resolveModel: () => (opts.model === undefined ? fakeModel : opts.model),
    createClient: () => {
      clientCreated += 1;
      return opts.client === undefined ? fakeClient().client : opts.client;
    },
  });
  return { response, body: await response.json(), clientCreated };
}

test("handler: barreiras na ordem certa, sem criar cliente service_role antes de passar todas", async () => {
  const disabled = await call({ CRON_SECRET: SECRET }, `Bearer ${SECRET}`);
  assert.equal(disabled.response.status, 503);
  assert.equal(disabled.body.code, "executor_disabled");
  assert.equal(disabled.clientCreated, 0);
  assert.equal(disabled.response.headers.get("cache-control"), "no-store");

  const noSecret = await call({ AGENT_EXECUTOR_ENABLED: "true" }, "Bearer qualquer");
  assert.equal(noSecret.response.status, 503);
  assert.equal(noSecret.body.code, "worker_not_configured");
  assert.equal(noSecret.clientCreated, 0);

  for (const auth of [undefined, "Bearer errado", SECRET]) {
    const denied = await call(ENABLED, auth);
    assert.equal(denied.response.status, 401);
    assert.equal(denied.body.code, "not_authenticated");
    assert.equal(denied.clientCreated, 0);
  }

  const noModel = await call(ENABLED, `Bearer ${SECRET}`, { model: null });
  assert.equal(noModel.response.status, 503);
  assert.equal(noModel.body.code, "model_not_configured");
  assert.equal(noModel.clientCreated, 0);

  const noService = await call(ENABLED, `Bearer ${SECRET}`, { client: null });
  assert.equal(noService.response.status, 503);
  assert.equal(noService.body.code, "service_not_configured");
});

test("handler: sem AGENT_MODEL_PROVIDER/AGENT_MODEL/AI_GATEWAY_API_KEY o modelo padrão não liga → 503 mesmo com tudo ligado", async () => {
  assert.equal(resolveAgentModel({ ...ENABLED, AI_GATEWAY_API_KEY: "x" }), null);
  const response = await handleWorkerRequest(request(`Bearer ${SECRET}`), { env: ENABLED, logger: quiet, createClient: () => fakeClient().client });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "model_not_configured");
});

test("handler autorizado: fila vazia → 200 só com contadores; falha do banco → 500 sem detalhes", async () => {
  const { client, calls } = fakeClient({ rpc: { agent_reap_stale_runs: () => ({ data: 0, error: null }), agent_claim_next_run: () => ({ data: [], error: null }) } });
  const ok = await call(ENABLED, `Bearer ${SECRET}`, { client });
  assert.equal(ok.response.status, 200);
  assert.deepEqual(ok.body, { reaped: 0, stoppedBy: "empty_queue", runs: [] });
  assert.deepEqual(calls.map((c) => c.kind === "rpc" && c.fn), ["agent_reap_stale_runs", "agent_claim_next_run"]);

  const broken = fakeClient({ rpc: { agent_reap_stale_runs: () => ({ data: null, error: { message: "permission denied for function agent_reap_stale_runs", code: "42501" } }) } });
  const failed = await call(ENABLED, `Bearer ${SECRET}`, { client: broken.client });
  assert.equal(failed.response.status, 500);
  assert.deepEqual(failed.body, { error: "Falha no disparo do worker.", code: "internal_error" });
});
