/**
 * S14 etapa 6 — fila de execuções sobre agent_reap_stale_runs / agent_claim_next_run (migration 20261119050000).
 * S24 — missões vencidas viram execuções na fila por agent_enqueue_due_missions (migration 20261124100000).
 */
import { AGENT_TOOLS, isAgentKind, isAgentTool, type AgentTool } from "../types.ts";
import { AgentDbError, firstRow, toDbError, type AgentRpcClient } from "../executor/rpc.ts";
import type { RunContext } from "../executor/types.ts";

export interface ClaimedRun {
  runId: string;
  organizationId: string;
  agent: string;
  goal: string;
  maxSteps: number;
  stepCount: number;
  createdBy: string;
  grantedTools: string[];
}

/** Resultado de uma missão vencida: execução criada (runId) ou o motivo de ter pulado (skipReason). */
export interface MissionEnqueueResult {
  missionId: string;
  runId: string | null;
  skipReason: string | null;
}

/** Missões avaliadas por disparo (o restante fica para o próximo). */
export const DEFAULT_MISSIONS_PER_TICK = 20;

export interface WorkerQueue {
  /** Falha (worker_timeout) execuções ativas sem atividade além do lease. Devolve quantas. */
  reap(leaseSeconds: number): Promise<number>;
  /** Reserva a próxima execução (queued → planning) ou null se não há nada liberado. */
  claim(): Promise<ClaimedRun | null>;
  /**
   * Cria na fila as execuções das missões vencidas (S24). Opcional: sem ele o disparo só processa a fila.
   * As barreiras (papel do responsável, kill switch, limite diário, passos) são aplicadas no banco.
   */
  enqueueDue?(limit: number): Promise<MissionEnqueueResult[]>;
}

export function rpcWorkerQueue(client: AgentRpcClient): WorkerQueue {
  return {
    async reap(leaseSeconds) {
      const { data, error } = await client.rpc("agent_reap_stale_runs", { p_lease_seconds: leaseSeconds });
      if (error) throw toDbError(error);
      return typeof data === "number" ? data : 0;
    },
    async claim() {
      const { data, error } = await client.rpc("agent_claim_next_run");
      if (error) throw toDbError(error);
      const row = firstRow(data);
      if (!row) return null;
      const runId = row.run_id;
      if (typeof runId !== "string") throw new AgentDbError("unexpected_claim_result");
      return {
        runId,
        organizationId: String(row.organization_id ?? ""),
        agent: String(row.agent ?? ""),
        goal: String(row.goal ?? ""),
        maxSteps: Number(row.max_steps),
        stepCount: Number(row.step_count),
        createdBy: String(row.created_by ?? ""),
        grantedTools: Array.isArray(row.granted_tools) ? row.granted_tools.map(String) : [],
      };
    },
    async enqueueDue(limit) {
      const { data, error } = await client.rpc("agent_enqueue_due_missions", { p_limit: limit });
      if (error) throw toDbError(error);
      if (data == null) return [];
      if (!Array.isArray(data)) throw new AgentDbError("unexpected_enqueue_result");
      return data.map((row: Record<string, unknown>) => {
        if (typeof row?.mission_id !== "string") throw new AgentDbError("unexpected_enqueue_result");
        return {
          missionId: row.mission_id,
          runId: typeof row.run_id === "string" ? row.run_id : null,
          skipReason: typeof row.skip_reason === "string" ? row.skip_reason : null,
        };
      });
    },
  };
}

/**
 * Converte a reserva em RunContext. Devolve null se a linha não for executável com segurança
 * (o worker então falha a execução com internal_error em vez de adivinhar).
 */
export function toRunContext(run: ClaimedRun): { ctx: RunContext } | { invalid: string } {
  if (!isAgentKind(run.agent)) return { invalid: "unknown_agent" };
  if (!run.organizationId || !run.createdBy) return { invalid: "missing_context" };
  if (!Number.isInteger(run.maxSteps) || run.maxSteps < 1) return { invalid: "invalid_max_steps" };
  // A reserva não grava passo; passos já existentes significam execução fora do fluxo do worker.
  if (run.stepCount !== 0) return { invalid: "unexpected_step_count" };
  const grantedTools = AGENT_TOOLS.filter((tool): tool is AgentTool => run.grantedTools.includes(tool) && isAgentTool(tool));
  return {
    ctx: {
      runId: run.runId,
      organizationId: run.organizationId,
      agent: run.agent,
      goal: run.goal,
      maxSteps: run.maxSteps,
      grantedTools,
      createdBy: run.createdBy,
    },
  };
}
