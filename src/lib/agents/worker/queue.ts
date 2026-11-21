/**
 * S14 etapa 6 — fila de execuções sobre agent_reap_stale_runs / agent_claim_next_run (migration 20261119050000).
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

export interface WorkerQueue {
  /** Falha (worker_timeout) execuções ativas sem atividade além do lease. Devolve quantas. */
  reap(leaseSeconds: number): Promise<number>;
  /** Reserva a próxima execução (queued → planning) ou null se não há nada liberado. */
  claim(): Promise<ClaimedRun | null>;
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
