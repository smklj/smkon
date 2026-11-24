import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseMissionArchiveForm,
  parseMissionForm,
  parseMissionSchedule,
  parseMissionToggleForm,
} from "../../src/lib/agents/schema.ts";
import { canManageMissions, MISSION_TIMEZONE, missionRpcArgs } from "../../src/lib/agents/service.ts";
import { describeSchedule, missionSkipReason } from "../../src/lib/agents/types.ts";
import { rpcWorkerQueue, type WorkerQueue } from "../../src/lib/agents/worker/queue.ts";
import { runWorkerTick } from "../../src/lib/agents/worker/tick.ts";
import { AgentDbError, type AgentRpcClient } from "../../src/lib/agents/executor/rpc.ts";
import type { ExecutorLogger } from "../../src/lib/agents/executor/run.ts";
import type { AgentModel, AgentStore } from "../../src/lib/agents/executor/types.ts";

const ORG = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MISSION = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const RUN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const BASE = { name: "Radar de segunda", agent: "product_research", goal: "Ranquear os produtos selecionados", max_steps: "6", limit: "12" };

// ---------------------------------------------------------------------------------------------------------------
// Formulário
// ---------------------------------------------------------------------------------------------------------------

test("missão diária: horário HH:MM vira hora e minuto; campos de outras agendas são ignorados", () => {
  const input = parseMissionForm(form({ ...BASE, schedule_kind: "daily", time: "08:30", weekday: "3", interval_hours: "6" }));
  assert.deepEqual(input, {
    name: "Radar de segunda",
    agent: "product_research",
    goal: "Ranquear os produtos selecionados",
    maxSteps: 6,
    schedule: { kind: "daily", hour: 8, minute: 30 },
  });
});

test("missão semanal exige dia; a cada N horas exige 1 a 168", () => {
  assert.deepEqual(parseMissionSchedule("weekly", "18:00", "0", ""), { kind: "weekly", weekday: 0, hour: 18, minute: 0 });
  assert.throws(() => parseMissionSchedule("weekly", "18:00", "", ""), /dia da semana/);
  assert.throws(() => parseMissionSchedule("weekly", "18:00", "7", ""), /dia da semana/);
  assert.deepEqual(parseMissionSchedule("interval", "", "", "6"), { kind: "interval", hours: 6 });
  assert.throws(() => parseMissionSchedule("interval", "", "", "0"), /1 a 168/);
  assert.throws(() => parseMissionSchedule("interval", "", "", "169"), /1 a 168/);
  assert.throws(() => parseMissionSchedule("interval", "", "", "1.5"), /1 a 168/);
});

test("agenda e horário inválidos são recusados com mensagem para a tela", () => {
  assert.throws(() => parseMissionSchedule("monthly", "08:00", "", ""), /frequência/);
  assert.throws(() => parseMissionSchedule("daily", "8:00", "", ""), /HH:MM/);
  assert.throws(() => parseMissionSchedule("daily", "24:00", "", ""), /HH:MM/);
  assert.throws(() => parseMissionSchedule("daily", "08:60", "", ""), /HH:MM/);
});

test("nome, agente, objetivo e passos seguem as mesmas faixas do banco", () => {
  assert.throws(() => parseMissionForm(form({ ...BASE, name: "ab", schedule_kind: "daily", time: "08:00" })), /nome/);
  assert.throws(() => parseMissionForm(form({ ...BASE, name: "x".repeat(121), schedule_kind: "daily", time: "08:00" })), /nome/);
  assert.throws(() => parseMissionForm(form({ ...BASE, agent: "publisher", schedule_kind: "daily", time: "08:00" })), /agente/);
  assert.throws(() => parseMissionForm(form({ ...BASE, goal: "x", schedule_kind: "daily", time: "08:00" })), /objetivo/);
  assert.throws(() => parseMissionForm(form({ ...BASE, max_steps: "13", schedule_kind: "daily", time: "08:00" })), /de 3 a 12/);
});

test("pausar, retomar e arquivar exigem UUID", () => {
  assert.deepEqual(parseMissionToggleForm(form({ mission_id: MISSION, enabled: "true" })), { missionId: MISSION, enabled: true });
  assert.deepEqual(parseMissionToggleForm(form({ mission_id: MISSION, enabled: "false" })), { missionId: MISSION, enabled: false });
  assert.throws(() => parseMissionToggleForm(form({ mission_id: "1; drop table", enabled: "true" })), /Missão inválida/);
  assert.deepEqual(parseMissionArchiveForm(form({ mission_id: MISSION })), { missionId: MISSION });
  assert.throws(() => parseMissionArchiveForm(form({})), /Missão inválida/);
});

// ---------------------------------------------------------------------------------------------------------------
// Service e rótulos
// ---------------------------------------------------------------------------------------------------------------

test("só owner e admin gerenciam missões", () => {
  assert.equal(canManageMissions("owner"), true);
  assert.equal(canManageMissions("admin"), true);
  assert.equal(canManageMissions("analyst"), false);
  assert.equal(canManageMissions("viewer"), false);
});

test("argumentos da RPC levam só os campos da agenda escolhida e o fuso de Brasília", () => {
  const base = { name: "Radar", agent: "product_research" as const, goal: "Ranquear", maxSteps: 6 };
  assert.deepEqual(missionRpcArgs(ORG, { ...base, schedule: { kind: "weekly", weekday: 1, hour: 8, minute: 0 } }), {
    p_organization_id: ORG, p_name: "Radar", p_agent: "product_research", p_goal: "Ranquear", p_max_steps: 6,
    p_schedule_kind: "weekly", p_timezone: MISSION_TIMEZONE, p_run_hour: 8, p_run_minute: 0, p_run_weekday: 1,
  });
  const interval = missionRpcArgs(ORG, { ...base, schedule: { kind: "interval", hours: 6 } });
  assert.equal(interval.p_interval_hours, 6);
  assert.equal("p_run_hour" in interval, false);
  assert.equal(MISSION_TIMEZONE, "America/Sao_Paulo");
});

test("descrição da agenda e motivo de pulo", () => {
  const row = { run_hour: 8, run_minute: 5, run_weekday: null, interval_hours: null };
  assert.equal(describeSchedule({ ...row, schedule_kind: "daily" }), "Todo dia às 08:05");
  assert.equal(describeSchedule({ ...row, schedule_kind: "weekly", run_weekday: 1 }), "Toda segunda às 08:05");
  assert.equal(describeSchedule({ ...row, schedule_kind: "weekly", run_weekday: 0 }), "Todo domingo às 08:05");
  assert.equal(describeSchedule({ schedule_kind: "interval", run_hour: null, run_minute: null, run_weekday: null, interval_hours: 1 }), "A cada hora");
  assert.equal(describeSchedule({ schedule_kind: "interval", run_hour: null, run_minute: null, run_weekday: null, interval_hours: 6 }), "A cada 6 h");
  assert.equal(describeSchedule({ ...row, schedule_kind: "weekly" }), "Agenda inválida");
  assert.equal(missionSkipReason("kill_switch"), "kill switch ligado");
  assert.equal(missionSkipReason("novo_motivo"), "novo_motivo");
  assert.equal(missionSkipReason(null), null);
});

// ---------------------------------------------------------------------------------------------------------------
// Fila do worker
// ---------------------------------------------------------------------------------------------------------------

function rpcClient(result: { data: unknown; error: { message: string; code?: string } | null }) {
  const calls: [string, unknown][] = [];
  const client = {
    rpc(fn: string, args?: Record<string, unknown>) {
      calls.push([fn, args]);
      return Promise.resolve(result);
    },
  } as unknown as AgentRpcClient;
  return { client, calls };
}

test("enqueueDue chama agent_enqueue_due_missions e mapeia execução criada ou motivo", async () => {
  const { client, calls } = rpcClient({
    data: [
      { mission_id: MISSION, run_id: RUN, skip_reason: null },
      { mission_id: ORG, run_id: null, skip_reason: "kill_switch" },
    ],
    error: null,
  });
  const queue = rpcWorkerQueue(client);
  assert.deepEqual(await queue.enqueueDue!(20), [
    { missionId: MISSION, runId: RUN, skipReason: null },
    { missionId: ORG, runId: null, skipReason: "kill_switch" },
  ]);
  assert.deepEqual(calls, [["agent_enqueue_due_missions", { p_limit: 20 }]]);
  assert.deepEqual(await rpcWorkerQueue(rpcClient({ data: null, error: null }).client).enqueueDue!(5), []);
});

test("enqueueDue: erro do banco ou formato inesperado viram AgentDbError", async () => {
  await assert.rejects(rpcWorkerQueue(rpcClient({ data: null, error: { message: "permission denied", code: "42501" } }).client).enqueueDue!(20), AgentDbError);
  await assert.rejects(rpcWorkerQueue(rpcClient({ data: { mission_id: MISSION }, error: null }).client).enqueueDue!(20), /unexpected_enqueue_result/);
  await assert.rejects(rpcWorkerQueue(rpcClient({ data: [{ run_id: RUN }], error: null }).client).enqueueDue!(20), /unexpected_enqueue_result/);
});

// ---------------------------------------------------------------------------------------------------------------
// Disparo do worker
// ---------------------------------------------------------------------------------------------------------------

const quiet: ExecutorLogger = () => {};
const model: AgentModel = {
  async plan() {
    return { steps: [] };
  },
  async summarize() {
    return { text: "", claims: [] };
  },
};
const store: AgentStore = {
  async currentStatus() {
    return "planning";
  },
  async recordStep() {
    return { seq: 1, runStatus: "executing" };
  },
  async finish() {},
  async fail() {},
};

test("tick: missões vencidas são enfileiradas antes de expirar e reservar", async () => {
  const log: string[] = [];
  const queue: WorkerQueue = {
    async enqueueDue(limit) {
      log.push(`enqueue:${limit}`);
      return [
        { missionId: MISSION, runId: RUN, skipReason: null },
        { missionId: ORG, runId: null, skipReason: "previous_run_active" },
      ];
    },
    async reap() {
      log.push("reap");
      return 0;
    },
    async claim() {
      log.push("claim");
      return null;
    },
  };
  const result = await runWorkerTick({ queue, store, model: () => model, tools: {}, logger: quiet, maxMissions: 7 });
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.deepEqual(result.missions, { enqueued: 1, skipped: 1, error: false });
  assert.deepEqual(log, ["enqueue:7", "reap", "claim"]);
});

test("tick: falha nas missões é registrada e a fila existente continua sendo processada", async () => {
  const events: string[] = [];
  const logger: ExecutorLogger = (_level, _scope, fields) => {
    events.push(String(fields.event));
  };
  const queue: WorkerQueue = {
    async enqueueDue() {
      throw new AgentDbError("function public.agent_enqueue_due_missions does not exist", "PGRST202");
    },
    async reap() {
      return 0;
    },
    async claim() {
      events.push("claim");
      return null;
    },
  };
  const result = await runWorkerTick({ queue, store, model: () => model, tools: {}, logger });
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.deepEqual(result.missions, { enqueued: 0, skipped: 0, error: true });
  assert.ok(events.includes("missions_error"));
  assert.ok(events.includes("claim"), "reserva continua depois do erro");
});

test("tick sem modelo não enfileira missões (nada é criado sem executor)", async () => {
  let called = false;
  const queue: WorkerQueue = {
    async enqueueDue() {
      called = true;
      return [];
    },
    async reap() {
      return 0;
    },
    async claim() {
      return null;
    },
  };
  const result = await runWorkerTick({ queue, store, model: null, tools: {}, logger: quiet });
  assert.deepEqual(result, { status: "model_not_configured" });
  assert.equal(called, false);
});
