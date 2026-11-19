/**
 * S14 etapa 6 — AgentStore real sobre as funções service_role do S13.
 *
 * Toda escrita passa por agent_record_step / agent_finish_run / agent_fail_run: o banco aplica ordem
 * plan → execute → verify, allowlist, limite de passos e kill switch. Este módulo só traduz chamadas e erros.
 */
import { isRunStatus, type RunStatus } from "../types.ts";
import { AgentDbError, firstRow, toDbError, type AgentRpcClient } from "./rpc.ts";
import type { AgentStore, ExecutorErrorCode, JsonObject, StepRecord, StepResult } from "./types.ts";

export function rpcAgentStore(client: AgentRpcClient): AgentStore {
  return {
    async currentStatus(runId: string): Promise<RunStatus> {
      const { data, error } = await client.from("agent_runs").select("status").eq("id", runId).maybeSingle();
      if (error) throw toDbError(error);
      const status = (data as { status?: unknown } | null)?.status;
      if (data === null || data === undefined) throw new AgentDbError("agent_run_not_found");
      if (typeof status !== "string" || !isRunStatus(status)) throw new AgentDbError("unexpected_run_status");
      return status;
    },

    async recordStep(step: StepRecord): Promise<StepResult> {
      const { data, error } = await client.rpc("agent_record_step", {
        p_run_id: step.runId,
        p_phase: step.phase,
        p_tool: step.tool,
        p_input: step.input,
        p_output: step.output,
        p_status: step.status,
        p_detail: step.detail ?? null,
      });
      if (error) throw toDbError(error);
      const row = firstRow(data);
      const runStatus = row?.run_status;
      if (typeof runStatus !== "string" || !isRunStatus(runStatus)) throw new AgentDbError("unexpected_step_result");
      const seq = row?.step_seq;
      return { seq: typeof seq === "number" ? seq : null, runStatus };
    },

    async finish(runId: string, outcome: JsonObject): Promise<void> {
      const { error } = await client.rpc("agent_finish_run", { p_run_id: runId, p_outcome: outcome });
      if (error) throw toDbError(error);
    },

    async fail(runId: string, code: ExecutorErrorCode): Promise<void> {
      const { error } = await client.rpc("agent_fail_run", { p_run_id: runId, p_error_code: code });
      if (error) throw toDbError(error);
    },
  };
}
