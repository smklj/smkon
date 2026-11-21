/**
 * S14 etapa 7 — consumo do modelo e teto mensal sobre agent_record_model_usage / agent_model_spend_since
 * (migration 20261119060000).
 */
import { toDbError, type AgentRpcClient } from "../executor/rpc.ts";
import type { ModelUsage } from "../executor/model-gateway.ts";

export interface Budget {
  limitUsd: number;
  /** Gasto do ambiente na janela corrente (mês UTC). */
  spent(): Promise<number>;
}

export function rpcUsageRecorder(client: AgentRpcClient, runId: string): (usage: ModelUsage) => Promise<void> {
  return async (usage) => {
    const { error } = await client.rpc("agent_record_model_usage", {
      p_run_id: runId,
      p_phase: usage.phase,
      p_model: usage.model,
      p_input_tokens: usage.inputTokens,
      p_output_tokens: usage.outputTokens,
      p_cost_usd: usage.costUsd,
    });
    if (error) throw toDbError(error);
  };
}

export function rpcBudget(client: AgentRpcClient, limitUsd: number, since: () => Date): Budget {
  return {
    limitUsd,
    async spent() {
      const { data, error } = await client.rpc("agent_model_spend_since", { p_since: since().toISOString() });
      if (error) throw toDbError(error);
      const value = typeof data === "number" ? data : Number(data);
      // Valor ilegível conta como teto atingido: melhor não executar do que gastar sem controle.
      return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
    },
  };
}
