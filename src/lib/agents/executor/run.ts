/**
 * S14 — loop do executor: Planner → Executor → Verifier.
 *
 * Puro: sem fetch e sem Supabase. Recebe modelo, store, ferramentas e verificador por injeção.
 * Garantias:
 * - toda escrita passa pelo AgentStore (agent_record_step / agent_finish_run / agent_fail_run);
 * - antes de cada fase o estado da execução é relido; fora de planning/executing/verifying (kill switch,
 *   cancelamento) o loop para sem novas escritas;
 * - cada chamada ao modelo ou ferramenta tem timeout; entradas/saídas respeitam o limite de payload do banco;
 * - ferramenta fora da allowlist/grant nunca é executada: o passo vai ao banco, que o registra como "rejected";
 * - sem modelo configurado a execução falha com model_not_configured, sem nenhuma chamada externa.
 */
import { log } from "../../observability/log.ts";
import { isActive, isAgentTool, type RunStatus } from "../types.ts";
import { fitsPayload, StepTimeoutError, withTimeout } from "./limits.ts";
import { parsePlan, parseSummary } from "./parse.ts";
import { checkDraftEvidence, verifyRun } from "./verifier.ts";
import {
  DEFAULT_LIMITS,
  type AgentModel,
  type AgentStore,
  type ExecutorErrorCode,
  type ExecutorLimits,
  type JsonObject,
  type Observation,
  type RunContext,
  type RunResult,
  type StepRecord,
  type ToolRegistry,
  type Verifier,
} from "./types.ts";

export type ExecutorLogger = (level: "info" | "warn" | "error", scope: string, fields: Record<string, unknown>) => void;

export interface ExecutorDeps {
  model: AgentModel | null;
  store: AgentStore;
  tools: ToolRegistry;
  verify?: Verifier;
  limits?: Partial<ExecutorLimits>;
  logger?: ExecutorLogger;
  /** Relógio injetável (testes do prazo total). */
  now?: () => number;
}

const SCOPE = "agents.executor";

/** Interrompe o loop com um resultado final já gravado (ou sem escrita, no caso de "stopped"). */
class Halt extends Error {
  readonly result: RunResult;
  constructor(result: RunResult) {
    super(`halt:${result.status}`);
    this.name = "Halt";
    this.result = result;
  }
}

function dbCode(error: unknown): string | undefined {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" ? message.trim() : undefined;
}

export async function runAgent(ctx: RunContext, deps: ExecutorDeps): Promise<RunResult> {
  const { model, store, tools } = deps;
  const verify = deps.verify ?? verifyRun;
  const limits: ExecutorLimits = { ...DEFAULT_LIMITS, ...deps.limits };
  const logger = deps.logger ?? log;
  const now = deps.now ?? Date.now;
  const deadline = now() + Math.max(limits.maxRunMs, 0);
  let steps = 0;

  /** Tempo do próximo passo e qual limite o restringiu (sem depender da precisão do timer). */
  function stepBudget(): { ms: number; runDeadlineLimited: boolean } {
    const remaining = deadline - now();
    return {
      ms: Math.max(1, Math.min(limits.stepTimeoutMs, remaining)),
      runDeadlineLimited: remaining <= limits.stepTimeoutMs,
    };
  }

  async function stopped(): Promise<Halt> {
    let runStatus: RunStatus | "unknown" = "unknown";
    try {
      runStatus = await store.currentStatus(ctx.runId);
    } catch {
      // Sem como reler: o banco já recusou a escrita, então a execução não está ativa.
    }
    logger("info", SCOPE, { event: "stopped", runId: ctx.runId, runStatus, steps });
    return new Halt({ status: "stopped", runStatus, steps });
  }

  async function ensureActive(): Promise<void> {
    if (now() >= deadline) {
      logger("warn", SCOPE, { event: "run_deadline", runId: ctx.runId, steps });
      await failRun("worker_timeout");
    }
    const status = await store.currentStatus(ctx.runId);
    if (!isActive(status)) {
      logger("info", SCOPE, { event: "stopped", runId: ctx.runId, runStatus: status, steps });
      throw new Halt({ status: "stopped", runStatus: status, steps });
    }
  }

  async function record(step: Omit<StepRecord, "runId">): Promise<number | null> {
    let result;
    try {
      result = await store.recordStep({ runId: ctx.runId, ...step });
    } catch (error) {
      if (dbCode(error) === "run_not_active") throw await stopped();
      throw error;
    }
    if (result.seq === null) {
      // agent_record_step aplicou o limite de passos e já marcou a execução como failed/step_limit.
      logger("warn", SCOPE, { event: "step_limit", runId: ctx.runId, steps });
      throw new Halt({ status: "failed", code: "step_limit", steps });
    }
    steps += 1;
    if (!isActive(result.runStatus)) throw await stopped();
    return result.seq;
  }

  async function failRun(code: ExecutorErrorCode): Promise<never> {
    try {
      await store.fail(ctx.runId, code);
    } catch (error) {
      if (dbCode(error) === "run_not_active") throw await stopped();
      throw error;
    }
    logger("warn", SCOPE, { event: "failed", runId: ctx.runId, code, steps });
    throw new Halt({ status: "failed", code, steps });
  }

  /** Registra o passo com erro e encerra a execução com o mesmo código. */
  async function failStep(step: Omit<StepRecord, "runId" | "status" | "output" | "detail">, code: ExecutorErrorCode): Promise<never> {
    await record({ ...step, output: {}, status: "error", detail: code });
    return failRun(code);
  }

  const timeoutCode = (error: unknown, fallback: ExecutorErrorCode, runDeadlineLimited: boolean): ExecutorErrorCode =>
    error instanceof StepTimeoutError ? (runDeadlineLimited ? "worker_timeout" : "step_timeout") : fallback;

  try {
    if (!model) return await failRun("model_not_configured");
    await ensureActive();

    // ---------------- Planner ----------------
    const maxCalls = ctx.maxSteps - 2; // 1 plan + N execute + 1 verify
    const planInput: JsonObject = { agent: ctx.agent, goal: ctx.goal, tools: [...ctx.grantedTools], maxCalls };
    if (maxCalls < 1) return await failStep({ phase: "plan", tool: null, input: planInput }, "invalid_plan");

    let rawPlan: unknown;
    try {
      const planTimeout = stepBudget();
      rawPlan = await withTimeout(planTimeout.ms, (signal) =>
        model.plan({ goal: ctx.goal, agent: ctx.agent, tools: ctx.grantedTools, maxCalls }, signal),
      );
    } catch (error) {
      if (error instanceof Halt) throw error;
      logger("warn", SCOPE, { event: "model_plan_error", runId: ctx.runId, message: String((error as Error)?.message ?? error) });
      return await failStep({ phase: "plan", tool: null, input: planInput }, timeoutCode(error, "model_error", planTimeout.runDeadlineLimited));
    }
    const calls = parsePlan(rawPlan, maxCalls);
    if (!calls) return await failStep({ phase: "plan", tool: null, input: planInput }, "invalid_plan");
    const planOutput: JsonObject = { steps: calls };
    if (!fitsPayload(planOutput, limits.maxPayloadBytes)) {
      return await failStep({ phase: "plan", tool: null, input: planInput }, "payload_too_large");
    }
    await record({ phase: "plan", tool: null, input: planInput, output: planOutput, status: "ok" });

    // ---------------- Executor ----------------
    const observations: Observation[] = [];
    for (const call of calls) {
      await ensureActive();
      if (!fitsPayload(call.input, limits.maxPayloadBytes)) {
        return await failStep({ phase: "execute", tool: call.tool, input: {} }, "payload_too_large");
      }

      const granted = isAgentTool(call.tool) && ctx.grantedTools.includes(call.tool);
      if (!granted) {
        // Não executa. O banco registra o passo como "rejected" (tool_not_allowed) e conta no limite.
        const seq = await record({ phase: "execute", tool: call.tool, input: call.input, output: {}, status: "ok" });
        observations.push({ seq, tool: call.tool, status: "rejected", input: call.input, output: {} });
        continue;
      }

      const handler = tools[call.tool as keyof ToolRegistry];
      if (!handler) return await failStep({ phase: "execute", tool: call.tool, input: call.input }, "tool_error");

      if (call.tool === "draft_content") {
        // Rascunho sobre produto só depois de evidência verificada observada (o rascunho é gravado já aqui,
        // antes do Verifier final, então a regra precisa valer antes da escrita).
        const gate = checkDraftEvidence(observations, call.input);
        if (!gate.ok) {
          logger("warn", SCOPE, { event: "draft_blocked", runId: ctx.runId, reasons: gate.reasons });
          return await failStep({ phase: "execute", tool: call.tool, input: call.input }, gate.code ?? "evidence_missing");
        }
      }

      let output: JsonObject;
      try {
        const toolTimeout = stepBudget();
        output = await withTimeout(toolTimeout.ms, (signal) => handler(ctx, call.input, signal));
      } catch (error) {
        if (error instanceof Halt) throw error;
        logger("warn", SCOPE, { event: "tool_error", runId: ctx.runId, tool: call.tool, message: String((error as Error)?.message ?? error) });
        return await failStep({ phase: "execute", tool: call.tool, input: call.input }, timeoutCode(error, "tool_error", toolTimeout.runDeadlineLimited));
      }
      if (!output || typeof output !== "object" || Array.isArray(output)) {
        return await failStep({ phase: "execute", tool: call.tool, input: call.input }, "tool_error");
      }
      if (!fitsPayload(output, limits.maxPayloadBytes)) {
        return await failStep({ phase: "execute", tool: call.tool, input: call.input }, "payload_too_large");
      }
      const seq = await record({ phase: "execute", tool: call.tool, input: call.input, output, status: "ok" });
      observations.push({ seq, tool: call.tool, status: "ok", input: call.input, output });
    }

    // ---------------- Verifier ----------------
    await ensureActive();
    const verifyInput: JsonObject = { observed: observations.map(({ seq, tool, status }) => ({ seq, tool, status })) };
    let rawSummary: unknown;
    try {
      const summaryTimeout = stepBudget();
      rawSummary = await withTimeout(summaryTimeout.ms, (signal) =>
        model.summarize({ goal: ctx.goal, agent: ctx.agent, observations }, signal),
      );
    } catch (error) {
      if (error instanceof Halt) throw error;
      logger("warn", SCOPE, { event: "model_summary_error", runId: ctx.runId, message: String((error as Error)?.message ?? error) });
      return await failStep({ phase: "verify", tool: null, input: verifyInput }, timeoutCode(error, "model_error", summaryTimeout.runDeadlineLimited));
    }
    const summary = parseSummary(rawSummary);
    if (!summary) return await failStep({ phase: "verify", tool: null, input: verifyInput }, "invalid_summary");

    const verdict = verify(ctx, observations, summary);
    const verifyStepInput: JsonObject = { ...verifyInput, summary: summary.text, claims: summary.claims };
    if (!fitsPayload(verifyStepInput, limits.maxPayloadBytes)) {
      return await failStep({ phase: "verify", tool: null, input: verifyInput }, "payload_too_large");
    }
    await record({
      phase: "verify",
      tool: null,
      input: verifyStepInput,
      output: { ok: verdict.ok, reasons: verdict.reasons },
      status: verdict.ok ? "ok" : "error",
      detail: verdict.ok ? null : (verdict.code ?? "verify_failed"),
    });
    if (!verdict.ok) return await failRun(verdict.code ?? "verify_failed");

    const outcome: JsonObject = { summary: summary.text, claims: summary.claims, steps };
    if (!fitsPayload(outcome, limits.maxPayloadBytes)) return await failRun("payload_too_large");
    try {
      await store.finish(ctx.runId, outcome);
    } catch (error) {
      if (dbCode(error) === "run_not_active") throw await stopped();
      if (dbCode(error) === "verification_required") {
        // Só é parada legítima se a execução deixou de estar ativa (kill switch entre o verify e o finish).
        const halt = await stopped();
        const status = (halt.result as { runStatus?: RunStatus | "unknown" }).runStatus;
        if (status && status !== "unknown" && !isActive(status)) throw halt;
      }
      throw error;
    }
    logger("info", SCOPE, { event: "succeeded", runId: ctx.runId, steps });
    return { status: "succeeded", steps };
  } catch (error) {
    if (error instanceof Halt) return error.result;
    // Falha inesperada (store, bug): tenta registrar internal_error sem esconder o erro original nos logs.
    logger("error", SCOPE, { event: "internal_error", runId: ctx.runId, message: String((error as Error)?.message ?? error) });
    try {
      await store.fail(ctx.runId, "internal_error");
    } catch {
      // A execução pode já estar encerrada; o worker (etapa 6) trata execuções presas por lease.
    }
    return { status: "failed", code: "internal_error", steps };
  }
}
