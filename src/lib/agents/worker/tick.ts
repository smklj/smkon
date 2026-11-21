/**
 * S14 etapa 6 — um disparo do worker: expira execuções presas, reserva e executa até N execuções.
 *
 * Puro em relação a infraestrutura: fila, store, modelo e ferramentas são injetados. A rota
 * /api/agents/worker monta as dependências reais (cliente service_role) e chama esta função.
 *
 * - Sem modelo configurado: nada é reservado nem expirado (as execuções continuam na fila) e o disparo
 *   devolve model_not_configured. runAgent também recusa sem modelo, como segunda barreira.
 * - Teto de gasto: antes de CADA reserva o gasto do mês é relido; atingido o teto, nada mais é reservado
 *   (stoppedBy = budget_exhausted). Teto "suave": a execução em andamento termina, então o gasto pode passar do
 *   teto pelo custo de uma execução (frações de centavo com o modelo padrão).
 * - Começa execuções novas só dentro do orçamento de tempo (budgetMs) e até maxRuns por disparo.
 *   Uma execução já iniciada não é interrompida pelo orçamento; se a função da Vercel for encerrada no meio,
 *   o lease (agent_reap_stale_runs) falha a execução com worker_timeout no disparo seguinte.
 */
import { log } from "../../observability/log.ts";
import { runAgent, type ExecutorLogger } from "../executor/run.ts";
import { DEFAULT_LIMITS, type AgentModel, type AgentStore, type ExecutorLimits, type RunContext, type RunResult, type ToolRegistry } from "../executor/types.ts";
import type { Budget } from "./budget.ts";
import { toRunContext, type WorkerQueue } from "./queue.ts";

export const DEFAULT_LEASE_SECONDS = 600;
export const DEFAULT_MAX_RUNS_PER_TICK = 3;
export const DEFAULT_TICK_BUDGET_MS = 120_000;
/**
 * Teto do disparo inteiro, abaixo do maxDuration (300 s) da rota: cada execução recebe como prazo total o menor
 * entre o seu maxRunMs e o que resta até este teto, e falha com worker_timeout em vez de ser cortada no meio.
 */
export const DEFAULT_TICK_HARD_LIMIT_MS = 270_000;

export interface WorkerTickDeps {
  queue: WorkerQueue;
  store: AgentStore;
  /** Modelo por execução (o registro de consumo precisa do runId); null = não configurado. */
  model: ((ctx: RunContext) => AgentModel) | null;
  /** Teto mensal; a rota sempre passa um. Ausente só em testes. */
  budget?: Budget;
  tools: ToolRegistry;
  limits?: Partial<ExecutorLimits>;
  leaseSeconds?: number;
  maxRuns?: number;
  budgetMs?: number;
  hardLimitMs?: number;
  now?: () => number;
  logger?: ExecutorLogger;
  /** Injeção para testes; padrão runAgent. */
  execute?: typeof runAgent;
}

export type TickRun =
  | { runId: string; status: RunResult["status"]; code?: string }
  | { runId: string; status: "invalid"; code: "internal_error"; reason: string };

export type WorkerTickResult =
  | { status: "model_not_configured" }
  | { status: "ok"; reaped: number; runs: TickRun[]; stoppedBy: StoppedBy };

/** budget = orçamento de TEMPO do disparo; budget_exhausted = teto mensal de GASTO atingido. */
export type StoppedBy = "empty_queue" | "max_runs" | "budget" | "budget_exhausted";

const SCOPE = "agents.worker";

export async function runWorkerTick(deps: WorkerTickDeps): Promise<WorkerTickResult> {
  const logger = deps.logger ?? log;
  if (!deps.model) {
    logger("warn", SCOPE, { event: "model_not_configured" });
    return { status: "model_not_configured" };
  }

  const now = deps.now ?? Date.now;
  const execute = deps.execute ?? runAgent;
  const maxRuns = deps.maxRuns ?? DEFAULT_MAX_RUNS_PER_TICK;
  const budgetMs = deps.budgetMs ?? DEFAULT_TICK_BUDGET_MS;
  const hardLimitMs = deps.hardLimitMs ?? DEFAULT_TICK_HARD_LIMIT_MS;
  const startedAt = now();

  const reaped = await deps.queue.reap(deps.leaseSeconds ?? DEFAULT_LEASE_SECONDS);
  if (reaped > 0) logger("warn", SCOPE, { event: "reaped", count: reaped });

  const runs: TickRun[] = [];
  let stoppedBy: StoppedBy = "max_runs";
  while (runs.length < maxRuns) {
    if (now() - startedAt >= budgetMs) {
      stoppedBy = "budget";
      break;
    }
    if (deps.budget) {
      const spent = await deps.budget.spent();
      if (spent >= deps.budget.limitUsd) {
        logger("warn", SCOPE, { event: "budget_exhausted", spentUsd: spent, limitUsd: deps.budget.limitUsd });
        stoppedBy = "budget_exhausted";
        break;
      }
    }
    const claimed = await deps.queue.claim();
    if (!claimed) {
      stoppedBy = "empty_queue";
      break;
    }

    const mapped = toRunContext(claimed);
    if ("invalid" in mapped) {
      logger("error", SCOPE, { event: "invalid_claim", runId: claimed.runId, reason: mapped.invalid });
      try {
        await deps.store.fail(claimed.runId, "internal_error");
      } catch (error) {
        logger("error", SCOPE, { event: "fail_invalid_claim_error", runId: claimed.runId, message: String((error as Error)?.message ?? error) });
      }
      runs.push({ runId: claimed.runId, status: "invalid", code: "internal_error", reason: mapped.invalid });
      continue;
    }

    logger("info", SCOPE, { event: "claimed", runId: claimed.runId, agent: mapped.ctx.agent });
    const remainingMs = startedAt + hardLimitMs - now();
    const maxRunMs = Math.max(1, Math.min(deps.limits?.maxRunMs ?? DEFAULT_LIMITS.maxRunMs, remainingMs));
    const result = await execute(mapped.ctx, {
      model: deps.model(mapped.ctx),
      store: deps.store,
      tools: deps.tools,
      limits: { ...deps.limits, maxRunMs },
      logger,
      now,
    });
    runs.push(result.status === "failed"
      ? { runId: claimed.runId, status: "failed", code: result.code }
      : { runId: claimed.runId, status: result.status });
  }

  logger("info", SCOPE, { event: "tick_done", reaped, runs: runs.length, stoppedBy, ms: now() - startedAt });
  return { status: "ok", reaped, runs, stoppedBy };
}
