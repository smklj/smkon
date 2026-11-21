import { test } from "node:test";
import assert from "node:assert/strict";
import { runAgent, type ExecutorLogger } from "../../src/lib/agents/executor/run.ts";
import { fitsPayload, jsonBytes, StepTimeoutError, withTimeout } from "../../src/lib/agents/executor/limits.ts";
import { parsePlan, parseSummary } from "../../src/lib/agents/executor/parse.ts";
import { verifyRun } from "../../src/lib/agents/executor/verifier.ts";
import type {
  AgentModel,
  AgentStore,
  ExecutorErrorCode,
  JsonObject,
  RunContext,
  StepRecord,
  ToolRegistry,
} from "../../src/lib/agents/executor/types.ts";
import type { AgentTool, RunStatus } from "../../src/lib/agents/types.ts";

const PRODUCT = "11111111-1111-4111-8111-111111111111";
const OTHER_PRODUCT = "22222222-2222-4222-8222-222222222222";
const EVIDENCE = "33333333-3333-4333-8333-333333333333";
const PENDING_EVIDENCE = "44444444-4444-4444-8444-444444444444";

const quiet: ExecutorLogger = () => {};

function context(overrides: Partial<RunContext> = {}): RunContext {
  return {
    runId: "run-1",
    organizationId: "org-1",
    agent: "product_research",
    goal: "Avaliar produtos em alta",
    maxSteps: 6,
    grantedTools: ["read_products", "read_product_evidence"],
    createdBy: "user-1",
    ...overrides,
  };
}

/**
 * Store falso que reproduz as regras de agent_record_step / agent_finish_run / agent_fail_run do S13:
 * ordem plan → execute → verify, limite de passos (seq null + failed/step_limit), allowlist (rejected),
 * run_not_active para execução encerrada e verification_required no finish.
 */
class FakeStore implements AgentStore {
  status: RunStatus = "queued";
  stepCount = 0;
  readonly steps: Array<StepRecord & { seq: number; finalStatus: "ok" | "error" | "rejected" }> = [];
  errorCode: string | null = null;
  outcome: JsonObject | null = null;
  readonly calls: string[] = [];
  /** Executado antes de cada recordStep (para simular kill switch no meio). */
  beforeRecord?: (store: FakeStore) => void;

  /** Executado a cada releitura de estado (para simular o owner ligando o kill switch). */
  onStatus?: (store: FakeStore) => void;
  readonly maxSteps: number;
  readonly grants: readonly string[];

  constructor(maxSteps: number, grants: readonly string[]) {
    this.maxSteps = maxSteps;
    this.grants = grants;
  }

  async currentStatus(): Promise<RunStatus> {
    this.calls.push("status");
    this.onStatus?.(this);
    return this.status;
  }

  async recordStep(step: StepRecord) {
    this.calls.push(`record:${step.phase}`);
    this.beforeRecord?.(this);
    if (!["queued", "planning", "executing", "verifying"].includes(this.status)) throw { message: "run_not_active" };
    const order =
      (step.phase === "plan" && !["queued", "planning"].includes(this.status)) ||
      (step.phase === "execute" && !["planning", "executing", "verifying"].includes(this.status)) ||
      (step.phase === "verify" && this.status !== "executing");
    if (order) throw { message: "invalid_phase_order" };
    if ((step.phase === "execute") !== (step.tool !== null)) throw { message: "invalid_phase" };
    if (!fitsPayload(step.input, 65_536) || !fitsPayload(step.output, 65_536)) throw { message: "payload_too_large" };
    if (this.stepCount >= this.maxSteps) {
      this.status = "failed";
      this.errorCode = "step_limit";
      return { seq: null, runStatus: "failed" as RunStatus };
    }
    const rejected = step.phase === "execute" && !this.grants.includes(step.tool as string);
    this.stepCount += 1;
    this.steps.push({ ...step, seq: this.stepCount, finalStatus: rejected ? "rejected" : step.status });
    this.status = step.phase === "plan" ? "planning" : step.phase === "execute" ? "executing" : "verifying";
    return { seq: this.stepCount, runStatus: this.status };
  }

  async finish(_runId: string, outcome: JsonObject) {
    this.calls.push("finish");
    const last = this.steps.at(-1);
    if (this.status !== "verifying" || last?.phase !== "verify" || last.status !== "ok") throw { message: "verification_required" };
    this.status = "succeeded";
    this.outcome = outcome;
  }

  async fail(_runId: string, code: ExecutorErrorCode) {
    this.calls.push(`fail:${code}`);
    if (!["queued", "planning", "executing", "verifying"].includes(this.status)) throw { message: "run_not_active" };
    this.status = "failed";
    this.errorCode = code;
  }
}

/** Modelo falso determinístico: devolve o plano e o resumo configurados, sem rede. */
function fakeModel(plan: unknown, summary: unknown = { text: "Resumo", claims: [] }): AgentModel & { planCalls: number; summaryCalls: number } {
  return {
    planCalls: 0,
    summaryCalls: 0,
    async plan() {
      this.planCalls += 1;
      return plan;
    },
    async summarize() {
      this.summaryCalls += 1;
      return summary;
    },
  };
}

const evidenceRows = [
  { id: EVIDENCE, product_id: PRODUCT, review_status: "verified" },
  { id: PENDING_EVIDENCE, product_id: PRODUCT, review_status: "pending" },
];

function tools(overrides: ToolRegistry = {}): ToolRegistry & { invoked: string[] } {
  const invoked: string[] = [];
  return {
    invoked,
    read_products: async () => {
      invoked.push("read_products");
      return { items: [{ id: PRODUCT, name: "Garrafa" }] };
    },
    read_product_evidence: async () => {
      invoked.push("read_product_evidence");
      return { items: evidenceRows };
    },
    ...overrides,
  };
}

function setup(maxSteps = 6, grants: AgentTool[] = ["read_products", "read_product_evidence"]) {
  return { store: new FakeStore(maxSteps, grants), ctx: context({ maxSteps, grantedTools: grants }) };
}

const goodPlan = { steps: [{ tool: "read_products", input: { limit: 10 } }, { tool: "read_product_evidence", input: { productId: PRODUCT } }] };

test("caminho feliz: plan → execute → verify → finish, com evidência verificada citada", async () => {
  const { store, ctx } = setup();
  const model = fakeModel(goodPlan, { text: "Garrafa tem evidência", claims: [{ text: "Vende bem", productId: PRODUCT, evidenceIds: [EVIDENCE] }] });
  const registry = tools();
  const result = await runAgent(ctx, { model, store, tools: registry, logger: quiet });

  assert.deepEqual(result, { status: "succeeded", steps: 4 });
  assert.deepEqual(store.steps.map((s) => s.phase), ["plan", "execute", "execute", "verify"]);
  assert.deepEqual(registry.invoked, ["read_products", "read_product_evidence"]);
  assert.equal(store.status, "succeeded");
  assert.equal(store.outcome?.summary, "Garrafa tem evidência");
  assert.equal(store.steps[3].finalStatus, "ok");
});

test("sem modelo configurado: falha com model_not_configured sem registrar passos", async () => {
  const { store, ctx } = setup();
  const registry = tools();
  const result = await runAgent(ctx, { model: null, store, tools: registry, logger: quiet });
  assert.deepEqual(result, { status: "failed", code: "model_not_configured", steps: 0 });
  assert.equal(store.steps.length, 0);
  assert.equal(store.errorCode, "model_not_configured");
  assert.deepEqual(registry.invoked, []);
});

test("execução já encerrada (kill switch antes de começar): para sem escrever e sem chamar o modelo", async () => {
  const { store, ctx } = setup();
  store.status = "killed";
  const model = fakeModel(goodPlan);
  const result = await runAgent(ctx, { model, store, tools: tools(), logger: quiet });
  assert.deepEqual(result, { status: "stopped", runStatus: "killed", steps: 0 });
  assert.equal(model.planCalls, 0);
  assert.ok(!store.calls.some((call) => call.startsWith("record") || call.startsWith("fail")));
});

test("kill switch no meio: o executor relê o estado e não executa a próxima ferramenta", async () => {
  const { store, ctx } = setup();
  const registry = tools();
  // Owner liga o kill switch logo depois do primeiro passo de execução ser gravado.
  store.onStatus = (s) => {
    if (s.steps.length === 2) s.status = "killed";
  };
  const result = await runAgent(ctx, { model: fakeModel(goodPlan), store, tools: registry, logger: quiet });
  assert.deepEqual(result, { status: "stopped", runStatus: "killed", steps: 2 });
  assert.deepEqual(registry.invoked, ["read_products"]);
  assert.ok(!store.calls.some((call) => call.startsWith("fail") || call === "finish"));
});

test("ferramenta fora do grant não é executada; o banco registra rejected", async () => {
  const { store, ctx } = setup(6, ["read_products"]);
  const plan = { steps: [{ tool: "read_products" }, { tool: "read_finance_summary" }, { tool: "publish_content" }] };
  const registry = tools({ read_finance_summary: async () => assert.fail("não deveria executar") });
  const result = await runAgent(ctx, { model: fakeModel(plan, { text: "ok", claims: [] }), store, tools: registry, logger: quiet });

  assert.equal(result.status, "succeeded");
  assert.deepEqual(
    store.steps.filter((s) => s.phase === "execute").map((s) => [s.tool, s.finalStatus]),
    [["read_products", "ok"], ["read_finance_summary", "rejected"], ["publish_content", "rejected"]],
  );
  assert.deepEqual(registry.invoked, ["read_products"]);
});

test("plano maior que o limite de passos é inválido (reserva 1 plan + 1 verify)", async () => {
  const { store, ctx } = setup(4);
  const plan = { steps: [{ tool: "read_products" }, { tool: "read_products" }, { tool: "read_products" }] };
  const result = await runAgent(ctx, { model: fakeModel(plan), store, tools: tools(), logger: quiet });
  assert.deepEqual(result, { status: "failed", code: "invalid_plan", steps: 1 });
  assert.equal(store.steps[0].phase, "plan");
  assert.equal(store.steps[0].status, "error");
  assert.equal(store.steps[0].detail, "invalid_plan");
});

test("limite de passos aplicado pelo banco encerra o loop como step_limit", async () => {
  const { store, ctx } = setup(6);
  // O banco tem limite menor que o contexto (ex.: limite reduzido depois do início).
  const tight = new FakeStore(2, ["read_products", "read_product_evidence"]);
  const result = await runAgent(ctx, { model: fakeModel(goodPlan), store: tight, tools: tools(), logger: quiet });
  assert.deepEqual(result, { status: "failed", code: "step_limit", steps: 2 });
  assert.equal(tight.errorCode, "step_limit");
  assert.ok(!tight.calls.some((call) => call.startsWith("fail")));
  assert.equal(store.steps.length, 0);
});

test("saída do modelo inválida: invalid_plan", async () => {
  for (const plan of [null, "texto", { steps: [] }, { steps: [{ tool: "Read Products" }] }, { steps: [{ tool: "read_products", input: [1] }] }]) {
    const { store, ctx } = setup();
    const result = await runAgent(ctx, { model: fakeModel(plan), store, tools: tools(), logger: quiet });
    assert.equal(result.status, "failed");
    assert.equal((result as { code: string }).code, "invalid_plan");
    assert.equal(store.errorCode, "invalid_plan");
  }
});

test("erro e timeout do modelo viram model_error e step_timeout", async () => {
  const { store, ctx } = setup();
  const broken: AgentModel = { plan: async () => { throw new Error("upstream 500"); }, summarize: async () => ({}) };
  assert.deepEqual(await runAgent(ctx, { model: broken, store, tools: tools(), logger: quiet }), { status: "failed", code: "model_error", steps: 1 });

  const slow = setup();
  const hanging: AgentModel = { plan: () => new Promise(() => {}), summarize: async () => ({}) };
  const result = await runAgent(slow.ctx, { model: hanging, store: slow.store, tools: tools(), limits: { stepTimeoutMs: 20 }, logger: quiet });
  assert.deepEqual(result, { status: "failed", code: "step_timeout", steps: 1 });
  assert.equal(slow.store.steps[0].detail, "step_timeout");
});

test("ferramenta lenta recebe abort e a execução falha com step_timeout", async () => {
  const { store, ctx } = setup();
  let aborted = false;
  const registry = tools({
    read_products: (_ctx, _input, signal) =>
      new Promise((_, reject) => {
        signal.addEventListener("abort", () => {
          aborted = true;
          reject(signal.reason);
        });
      }),
  });
  const result = await runAgent(ctx, { model: fakeModel(goodPlan), store, tools: registry, limits: { stepTimeoutMs: 20 }, logger: quiet });
  assert.deepEqual(result, { status: "failed", code: "step_timeout", steps: 2 });
  assert.ok(aborted);
  assert.deepEqual([store.steps[1].tool, store.steps[1].status], ["read_products", "error"]);
});

test("erro de ferramenta: tool_error; ferramenta liberada sem implementação também", async () => {
  const failing = setup();
  const registry = tools({ read_products: async () => { throw new Error("db down"); } });
  assert.deepEqual(await runAgent(failing.ctx, { model: fakeModel(goodPlan), store: failing.store, tools: registry, logger: quiet }), {
    status: "failed",
    code: "tool_error",
    steps: 2,
  });

  const missing = setup();
  assert.deepEqual(await runAgent(missing.ctx, { model: fakeModel(goodPlan), store: missing.store, tools: {}, logger: quiet }), {
    status: "failed",
    code: "tool_error",
    steps: 2,
  });
});

test("saída de ferramenta acima de 64 KB: payload_too_large, sem gravar a saída", async () => {
  const { store, ctx } = setup();
  const registry = tools({ read_products: async () => ({ blob: "x".repeat(70_000) }) });
  const result = await runAgent(ctx, { model: fakeModel(goodPlan), store, tools: registry, logger: quiet });
  assert.deepEqual(result, { status: "failed", code: "payload_too_large", steps: 2 });
  assert.deepEqual(store.steps[1].output, {});
});

test("afirmação sobre produto sem evidência verificada: verify reprovado e execução falha", async () => {
  const cases: Array<[string, unknown[]]> = [
    ["sem citação", []],
    ["evidência pendente", [PENDING_EVIDENCE]],
  ];
  for (const [, evidenceIds] of cases) {
    const { store, ctx } = setup();
    const model = fakeModel(goodPlan, { text: "Garrafa vende", claims: [{ text: "Vende", productId: PRODUCT, evidenceIds }] });
    const result = await runAgent(ctx, { model, store, tools: tools(), logger: quiet });
    assert.deepEqual(result, { status: "failed", code: "evidence_missing", steps: 4 });
    const verify = store.steps.at(-1)!;
    assert.deepEqual([verify.phase, verify.status, verify.detail], ["verify", "error", "evidence_missing"]);
    assert.ok(!store.calls.includes("finish"));
  }
});

test("resumo inválido do modelo: invalid_summary", async () => {
  const { store, ctx } = setup();
  const result = await runAgent(ctx, { model: fakeModel(goodPlan, { text: "   " }), store, tools: tools(), logger: quiet });
  assert.deepEqual(result, { status: "failed", code: "invalid_summary", steps: 4 });
});

test("falha inesperada do store vira internal_error", async () => {
  const { store, ctx } = setup();
  store.beforeRecord = () => {
    throw new Error("connection reset");
  };
  const result = await runAgent(ctx, { model: fakeModel(goodPlan), store, tools: tools(), logger: quiet });
  assert.deepEqual(result, { status: "failed", code: "internal_error", steps: 0 });
  assert.equal(store.errorCode, "internal_error");
});

test("withTimeout limpa o timer e rejeita com StepTimeoutError", async () => {
  assert.equal(await withTimeout(50, async () => 7), 7);
  await assert.rejects(withTimeout(5, () => new Promise(() => {})), StepTimeoutError);
});

test("jsonBytes conta UTF-8 e os espaços do jsonb::text", () => {
  // jsonb::text de {"a":[1,2]} é '{"a": [1, 2]}' (13 bytes)
  assert.equal(jsonBytes({ a: [1, 2] }), 13);
  assert.equal(jsonBytes({ n: "ã" }), Buffer.byteLength('{"n": "ã"}'));
  assert.equal(jsonBytes(undefined), 2);
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  assert.equal(jsonBytes(cyclic), Infinity);
});

test("parsePlan e parseSummary validam formato", () => {
  assert.deepEqual(parsePlan({ steps: [{ tool: "read_products" }] }, 3), [{ tool: "read_products", input: {} }]);
  assert.equal(parsePlan({ steps: [{ tool: "read_products" }, { tool: "read_products" }] }, 1), null);
  assert.deepEqual(parseSummary({ text: " ok ", claims: [{ text: "x", productId: PRODUCT.toUpperCase(), evidenceIds: [EVIDENCE] }] }), {
    text: "ok",
    claims: [{ text: "x", productId: PRODUCT, evidenceIds: [EVIDENCE] }],
  });
  assert.equal(parseSummary({ text: "ok", claims: [{ text: "x", productId: "não-uuid" }] }), null);
  assert.equal(parseSummary({ text: "x".repeat(8001) }), null);
});

test("verifier: evidência de outro produto e ausência de observações reprovam", () => {
  const ctx = context();
  const observations = [{ seq: 2, tool: "read_product_evidence", status: "ok" as const, output: { items: evidenceRows } }];
  assert.equal(verifyRun(ctx, observations, { text: "x", claims: [{ text: "y", productId: OTHER_PRODUCT, evidenceIds: [EVIDENCE] }] }).code, "evidence_missing");
  assert.equal(verifyRun(ctx, [], { text: "x", claims: [] }).code, "verify_failed");
  assert.equal(verifyRun(ctx, observations, { text: "x", claims: [{ text: "geral", evidenceIds: [] }] }).ok, true);
  // Evidência de read_products (ferramenta errada) não conta.
  const wrongTool = [{ seq: 2, tool: "read_products", status: "ok" as const, output: { items: evidenceRows } }];
  assert.equal(verifyRun(ctx, wrongTool, { text: "x", claims: [{ text: "y", productId: PRODUCT, evidenceIds: [EVIDENCE] }] }).ok, false);
});
