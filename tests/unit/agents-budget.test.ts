import { test } from "node:test";
import assert from "node:assert/strict";
import { createGatewayModel, DEFAULT_PLAN_MAX_TOKENS, type FetchLike, type ModelUsage } from "../../src/lib/agents/executor/model-gateway.ts";
import { estimateCost, MODEL_PRICES, modelRequestProfile, monthStartUtc, parseBudget } from "../../src/lib/agents/executor/model-pricing.ts";
import { modelConfigStatus, resolveAgentModel } from "../../src/lib/agents/executor/model.ts";
import type { ExecutorLogger } from "../../src/lib/agents/executor/run.ts";
import type { AgentStore } from "../../src/lib/agents/executor/types.ts";
import { rpcBudget, rpcUsageRecorder } from "../../src/lib/agents/worker/budget.ts";
import type { ClaimedRun } from "../../src/lib/agents/worker/queue.ts";
import { runWorkerTick } from "../../src/lib/agents/worker/tick.ts";
import type { AgentRpcClient, DbResult } from "../../src/lib/agents/executor/rpc.ts";

const quiet: ExecutorLogger = () => {};
const MODEL = "anthropic/claude-haiku-5.5";
const OIDC = "test-oidc-token-placeholder-for-unit-tests";
const BASE = { AGENT_MODEL_PROVIDER: "vercel-ai-gateway", AGENT_MODEL: MODEL };
const signal = () => new AbortController().signal;
const planInput = { goal: "g", agent: "product_research" as const, tools: [], maxCalls: 1 };

type Sent = { url: string; headers: Record<string, string>; body: Record<string, unknown> };

function fakeFetch(replies: { status: number; body: string }[]) {
  const sent: Sent[] = [];
  const impl: FetchLike = async (url, init) => {
    sent.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    const reply = replies.shift();
    if (!reply) throw new Error("sem resposta programada");
    return { ok: reply.status >= 200 && reply.status < 300, status: reply.status, text: async () => reply.body };
  };
  return { impl, sent };
}

function completion(content: string, usage: Record<string, number> | null = { prompt_tokens: 1200, completion_tokens: 150 }) {
  return { status: 200, body: JSON.stringify({ id: "gen_1", choices: [{ finish_reason: "stop", message: { content } }], ...(usage ? { usage } : {}) }) };
}

// ---------------------------------------------------------------------------------------------------------------
// Credencial OIDC (opt-in explícito)
// ---------------------------------------------------------------------------------------------------------------

test("OIDC só com AGENT_MODEL_AUTH=oidc; o token do header da invocação tem prioridade", async () => {
  assert.deepEqual(modelConfigStatus({ ...BASE, VERCEL_OIDC_TOKEN: OIDC }), { ok: false, reason: "key_missing" }, "token presente sozinho não liga nada");
  assert.deepEqual(modelConfigStatus({ ...BASE, AGENT_MODEL_AUTH: "oidc" }), { ok: false, reason: "oidc_token_missing" });
  assert.deepEqual(modelConfigStatus({ ...BASE, AGENT_MODEL_AUTH: "oidc" }, "curto"), { ok: false, reason: "oidc_token_missing" });
  assert.deepEqual(modelConfigStatus({ ...BASE, AGENT_MODEL_AUTH: "oidc" }, OIDC), { ok: true, provider: "vercel-ai-gateway", model: MODEL });
  assert.deepEqual(modelConfigStatus({ ...BASE, AGENT_MODEL_AUTH: "oidc", VERCEL_OIDC_TOKEN: OIDC }), { ok: true, provider: "vercel-ai-gateway", model: MODEL });

  const { impl, sent } = fakeFetch([completion('{"steps":[]}')]);
  const model = resolveAgentModel({ ...BASE, AGENT_MODEL_AUTH: "oidc", VERCEL_OIDC_TOKEN: `${OIDC}-env` }, { oidcToken: OIDC, fetch: impl });
  assert.ok(model);
  await model.plan(planInput, signal());
  assert.equal(sent[0].headers.Authorization, `Bearer ${OIDC}`);
});

// ---------------------------------------------------------------------------------------------------------------
// Preço e teto
// ---------------------------------------------------------------------------------------------------------------

test("parseBudget aceita 0 < valor ≤ 1000 com até 2 casas", () => {
  assert.equal(parseBudget("5"), 5);
  assert.equal(parseBudget(" 12.50 "), 12.5);
  assert.equal(parseBudget("1000"), 1000);
  for (const bad of [undefined, "", "0", "0.00", "-1", "1001", "5.123", "abc", "1e3", "Infinity"]) assert.equal(parseBudget(bad), null, String(bad));
});

test("monthStartUtc e estimateCost (margem de 10%, arredondado para cima no micro-dólar)", () => {
  assert.equal(monthStartUtc(new Date("2026-11-30T23:59:59-03:00")).toISOString(), "2026-12-01T00:00:00.000Z");
  assert.equal(monthStartUtc(new Date("2026-11-19T10:00:00Z")).toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal(estimateCost(MODEL_PRICES[MODEL], 10_000, 2_000), 0.0022);
  assert.equal(estimateCost(MODEL_PRICES[MODEL], 1, 0), 0.000001);
});

// ---------------------------------------------------------------------------------------------------------------
// Registro de consumo no adaptador
// ---------------------------------------------------------------------------------------------------------------

test("cada resposta 2xx registra tokens e custo antes de devolver o resultado", async () => {
  const usage: ModelUsage[] = [];
  const { impl } = fakeFetch([completion('{"steps":[]}'), completion('{"text":"ok","claims":[]}', { prompt_tokens: 9000, completion_tokens: 800 })]);
  const model = createGatewayModel({ apiKey: OIDC, model: MODEL, fetch: impl, onUsage: async (u) => void usage.push(u) });
  await model.plan(planInput, signal());
  await model.summarize({ goal: "g", agent: "product_research", observations: [] }, signal());
  assert.deepEqual(usage, [
    { phase: "plan", model: MODEL, inputTokens: 1200, outputTokens: 150, costUsd: estimateCost(MODEL_PRICES[MODEL], 1200, 150) },
    { phase: "verify", model: MODEL, inputTokens: 9000, outputTokens: 800, costUsd: estimateCost(MODEL_PRICES[MODEL], 9000, 800) },
  ]);
});

test("sem usage ou com resposta ilegível cobra o pior caso; erro HTTP não registra", async () => {
  const usage: ModelUsage[] = [];
  const { impl } = fakeFetch([completion('{"steps":[]}', null), { status: 200, body: "não é json" }, { status: 402, body: "{}" }]);
  const model = createGatewayModel({ apiKey: OIDC, model: MODEL, fetch: impl, onUsage: async (u) => void usage.push(u) });
  await model.plan(planInput, signal());
  await assert.rejects(model.plan(planInput, signal()), /gateway_invalid_response/);
  await assert.rejects(model.plan(planInput, signal()), /gateway_http_402/);
  assert.equal(usage.length, 2);
  assert.ok(usage.every((u) => u.outputTokens === DEFAULT_PLAN_MAX_TOKENS && u.inputTokens > 0));
});

test("falha ao gravar o consumo derruba a chamada; modelo sem preço não aceita registro de consumo", async () => {
  const { impl } = fakeFetch([completion('{"steps":[]}')]);
  const model = createGatewayModel({ apiKey: OIDC, model: MODEL, fetch: impl, onUsage: async () => { throw new Error("db down"); } });
  await assert.rejects(model.plan(planInput, signal()), /db down/);
  assert.throws(() => createGatewayModel({ apiKey: OIDC, model: "anthropic/sem-preco", onUsage: async () => {} }), /model_unpriced/);
  assert.doesNotThrow(() => createGatewayModel({ apiKey: OIDC, model: "anthropic/sem-preco" }), "sem onUsage o adaptador não exige preço");
});

// ---------------------------------------------------------------------------------------------------------------
// RPCs de consumo e teto
// ---------------------------------------------------------------------------------------------------------------

function rpcClient(responses: Record<string, DbResult>) {
  const calls: [string, Record<string, unknown> | undefined][] = [];
  const client = {
    rpc(fn: string, args?: Record<string, unknown>) {
      calls.push([fn, args]);
      const result = responses[fn] ?? { data: null, error: null };
      const thenable = { then: (resolve: (v: DbResult) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject) };
      return Object.assign(thenable, { abortSignal: () => thenable });
    },
    from() {
      throw new Error("não usado");
    },
  };
  return { client: client as unknown as AgentRpcClient, calls };
}

test("rpcUsageRecorder grava com o runId da execução; rpcBudget lê o gasto desde o início do mês", async () => {
  const { client, calls } = rpcClient({ agent_model_spend_since: { data: "0.125000", error: null } });
  await rpcUsageRecorder(client, "run-9")({ phase: "plan", model: MODEL, inputTokens: 10, outputTokens: 2, costUsd: 0.000002 });
  const budget = rpcBudget(client, 5, () => new Date("2026-11-01T00:00:00Z"));
  assert.equal(await budget.spent(), 0.125);
  assert.deepEqual(calls, [
    ["agent_record_model_usage", { p_run_id: "run-9", p_phase: "plan", p_model: MODEL, p_input_tokens: 10, p_output_tokens: 2, p_cost_usd: 0.000002 }],
    ["agent_model_spend_since", { p_since: "2026-11-01T00:00:00.000Z" }],
  ]);

  const unreadable = rpcBudget(rpcClient({ agent_model_spend_since: { data: "abc", error: null } }).client, 5, () => new Date());
  assert.equal(await unreadable.spent(), Number.POSITIVE_INFINITY, "valor ilegível conta como teto atingido");
  const failing = rpcUsageRecorder(rpcClient({ agent_record_model_usage: { data: null, error: { message: "invalid_usage" } } }).client, "r");
  await assert.rejects(failing({ phase: "plan", model: MODEL, inputTokens: 1, outputTokens: 1, costUsd: 0 }), /invalid_usage/);
});

test("tick relê o gasto antes de cada reserva e para ao atingir o teto", async () => {
  const runs: ClaimedRun[] = ["r1", "r2", "r3"].map((runId) => ({
    runId, organizationId: "org", agent: "product_research", goal: "g", maxSteps: 6, stepCount: 0, createdBy: "u", grantedTools: [],
  }));
  let spent = 4.99;
  let reads = 0;
  const claimed: string[] = [];
  const store: AgentStore = { currentStatus: async () => "planning", recordStep: async () => ({ seq: 1, runStatus: "executing" }), finish: async () => {}, fail: async () => {} };
  const result = await runWorkerTick({
    queue: { reap: async () => 0, claim: async () => { const run = runs.shift() ?? null; if (run) claimed.push(run.runId); return run; } },
    store,
    model: () => ({ plan: async () => ({}), summarize: async () => ({}) }),
    budget: { limitUsd: 5, spent: async () => { reads += 1; return spent; } },
    tools: {},
    logger: quiet,
    maxRuns: 10,
    execute: async () => { spent += 0.02; return { status: "succeeded", steps: 3 }; },
  });
  assert.ok(result.status === "ok");
  assert.equal(result.stoppedBy, "budget_exhausted");
  assert.deepEqual(claimed, ["r1"], "depois da 1ª execução o gasto passou do teto e nada mais é reservado");
  assert.equal(reads, 2);
});


test("body stream failure em resposta 2xx registra custo conservador antes de falhar", async () => {
  const usage: ModelUsage[] = [];
  const fetch: FetchLike = async () => ({
    ok: true,
    status: 200,
    text: async () => { throw new Error("stream reset"); },
  });
  const model = createGatewayModel({ apiKey: OIDC, model: MODEL, fetch, onUsage: async (u) => void usage.push(u) });

  await assert.rejects(model.plan(planInput, signal()), /gateway_body_read_failed/);
  assert.equal(usage.length, 1);
  assert.equal(usage[0].phase, "plan");
  assert.equal(usage[0].model, MODEL);
  assert.ok(usage[0].inputTokens > 0);
  assert.equal(usage[0].outputTokens, DEFAULT_PLAN_MAX_TOKENS);
});

test("abort durante body stream 2xx preserva o erro de timeout após registrar o pior caso", async () => {
  const usage: ModelUsage[] = [];
  const controller = new AbortController();
  const aborted = new Error("aborted");
  const fetch: FetchLike = async () => ({
    ok: true,
    status: 200,
    text: async () => {
      controller.abort();
      throw aborted;
    },
  });
  const model = createGatewayModel({ apiKey: OIDC, model: MODEL, fetch, onUsage: async (u) => void usage.push(u) });

  await assert.rejects(model.plan(planInput, controller.signal), (error) => error === aborted);
  assert.equal(usage.length, 1);
  assert.equal(usage[0].outputTokens, DEFAULT_PLAN_MAX_TOKENS);
});

test("preço por faixa: acima de 100 mil tokens de entrada o Haiku 5.5 custa 5x na chamada inteira", () => {
  const haiku = MODEL_PRICES["anthropic/claude-haiku-5.5"];
  // Até a faixa: (100000 × 0,0000001 + 1000 × 0,0000005) × 1,1 = 0,01155
  assert.equal(estimateCost(haiku, 100_000, 1_000), 0.01155);
  // Acima: (150000 × 0,0000005 + 1000 × 0,0000025) × 1,1 = 0,08525
  assert.equal(estimateCost(haiku, 150_000, 1_000), 0.08525);
});

test("Gemini: preço de tabela (sem a promoção) e raciocínio baixo com folga de saída", () => {
  assert.deepEqual(MODEL_PRICES["google/gemini-3.8-flash"], { input: 0.0000015, output: 0.0000075 });
  assert.deepEqual(modelRequestProfile("google/gemini-3.8-flash"), { reasoningEffort: "low", outputHeadroom: 1024 });
  assert.deepEqual(modelRequestProfile("anthropic/claude-haiku-5.5"), {}, "Haiku segue sem ajuste");
  // 2000 de entrada e 1500 de saída: (2000 × 0,0000015 + 1500 × 0,0000075) × 1,1 = 0,015675
  assert.equal(estimateCost(MODEL_PRICES["google/gemini-3.8-flash"], 2_000, 1_500), 0.015675);
});
