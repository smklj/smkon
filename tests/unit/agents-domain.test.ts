import { test } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "../../src/lib/http/errors.ts";
import type { SupabaseClient } from "../../src/lib/agents/repository.ts";
import {
  DEFAULT_STEP_LIMIT,
  parseCancelForm,
  parseKillSwitchForm,
  parseLimitsForm,
  parseRunForm,
  parseRunInput as schemaParseRunInput,
  parseToolForm,
  stepLimitFromForm,
} from "../../src/lib/agents/schema.ts";
import {
  cancelAgentRun,
  canControlAgents,
  canManageTools,
  canOperateRuns,
  queueRun,
  saveLimits,
  setToolGrant,
  switchAgents,
} from "../../src/lib/agents/service.ts";
import { parseRunInput as typesParseRunInput } from "../../src/lib/agents/types.ts";

const ORG = "11111111-2222-4333-8444-555555555555";
const RUN = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

/** Cliente falso: registra as chamadas de RPC e devolve o resultado configurado. */
function rpcClient(result: { data: unknown; error: unknown } = { data: null, error: null }) {
  const calls: Array<[string, unknown]> = [];
  const client = {
    rpc(name: string, args: unknown) {
      calls.push([name, args]);
      return Promise.resolve(result);
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

test("agentes: types.ts reexporta a validação do schema (mesma função)", () => {
  assert.equal(typesParseRunInput, schemaParseRunInput);
});

test("agentes: erros do schema são ValidationError com a mesma mensagem", () => {
  assert.throws(() => parseRunForm(form({ agent: "x", goal: "Pesquisar", max_steps: "5" })), (error: unknown) => {
    assert.ok(error instanceof ValidationError);
    assert.equal((error as Error).message, "Escolha um agente da lista.");
    return true;
  });
});

test("agentes: teto de passos do formulário cai para 12 fora de 3–50", () => {
  assert.equal(stepLimitFromForm(null), DEFAULT_STEP_LIMIT);
  assert.equal(stepLimitFromForm("30"), 30);
  assert.equal(stepLimitFromForm("2"), 12);
  assert.equal(stepLimitFromForm("51"), 12);
  assert.equal(stepLimitFromForm("7.5"), 12);
  assert.equal(stepLimitFromForm("abc"), 12);
  assert.deepEqual(
    parseRunForm(form({ agent: "product_research", goal: "  Pesquisar  ", max_steps: "20", limit: "30" })),
    { agent: "product_research", goal: "Pesquisar", maxSteps: 20 },
  );
  assert.throws(() => parseRunForm(form({ agent: "product_research", goal: "Pesquisar", max_steps: "20" })), /3 a 12/);
});

test("agentes: cancelamento exige UUID estrito e motivo", () => {
  assert.throws(() => parseCancelForm(form({ run_id: "nope", reason: "motivo" })), /Execução inválida/);
  assert.throws(() => parseCancelForm(form({ run_id: RUN, reason: " a " })), /motivo do cancelamento/);
  assert.deepEqual(parseCancelForm(form({ run_id: RUN, reason: "  duplicada " })), { runId: RUN, reason: "duplicada" });
});

test("agentes: kill switch exige motivo só para ligar", () => {
  assert.throws(() => parseKillSwitchForm(form({ on: "true", reason: "x" })), /motivo para ligar/);
  assert.deepEqual(parseKillSwitchForm(form({ on: "false" })), { on: false, reason: "" });
  assert.deepEqual(parseKillSwitchForm(form({ on: "true", reason: " incidente " })), { on: true, reason: "incidente" });
});

test("agentes: ferramenta fora da allowlist e limites inválidos são recusados", () => {
  assert.throws(() => parseToolForm(form({ tool: "publish_post", enabled: "true" })), /allowlist/);
  assert.deepEqual(parseToolForm(form({ tool: "read_products", enabled: "true" })), { tool: "read_products", enabled: true });
  assert.throws(() => parseLimitsForm(form({ max_runs: "0", max_steps: "12" })), /1 a 500/);
  assert.deepEqual(parseLimitsForm(form({ max_runs: "20", max_steps: "12" })), { maxRunsPerDay: 20, maxStepsPerRun: 12 });
});

test("agentes: permissões por papel (owner e admin operam; analyst e viewer não; só owner controla)", () => {
  assert.deepEqual(
    (["owner", "admin", "analyst", "viewer"] as const).map((role) => [canOperateRuns(role), canManageTools(role), canControlAgents(role)]),
    [
      [true, true, true],
      [true, true, false],
      [false, false, false],
      [false, false, false],
    ],
  );
});

test("agentes: casos de uso chamam as RPCs com os mesmos argumentos", async () => {
  const { client, calls } = rpcClient({ data: 3, error: null });
  await queueRun(client, ORG, { agent: "content_drafting", goal: "Rascunho", maxSteps: 5 });
  await cancelAgentRun(client, { runId: RUN, reason: "duplicada" });
  assert.equal(await switchAgents(client, ORG, { on: true, reason: "incidente" }), 3);
  await switchAgents(client, ORG, { on: false, reason: "ignorado" });
  await setToolGrant(client, ORG, { tool: "draft_content", enabled: false });
  await saveLimits(client, ORG, { maxRunsPerDay: 40, maxStepsPerRun: 10 });
  assert.deepEqual(calls, [
    ["agent_start_run", { p_organization_id: ORG, p_agent: "content_drafting", p_goal: "Rascunho", p_max_steps: 5 }],
    ["agent_cancel_run", { p_run_id: RUN, p_reason: "duplicada" }],
    ["agent_set_kill_switch", { p_organization_id: ORG, p_on: true, p_reason: "incidente" }],
    ["agent_set_kill_switch", { p_organization_id: ORG, p_on: false }],
    ["agent_set_tool", { p_organization_id: ORG, p_tool: "draft_content", p_enabled: false }],
    ["agent_update_limits", { p_organization_id: ORG, p_max_runs_per_day: 40, p_max_steps_per_run: 10 }],
  ]);
});

test("agentes: erro da RPC propaga sem ser engolido", async () => {
  const failure = { code: "42501", message: "permission denied" };
  const { client } = rpcClient({ data: null, error: failure });
  await assert.rejects(() => cancelAgentRun(client, { runId: RUN, reason: "duplicada" }), (error: unknown) => error === failure);
});
