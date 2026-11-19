/**
 * S14 etapa 6 — ferramenta draft_content sobre agent_draft_content (migration 20261119040000).
 *
 * A única escrita que um agente faz: um rascunho (status draft), vinculado à execução, sem aprovação, sem
 * agendamento, sem mídia e sem direitos declarados. O run vem de RunContext (do banco), nunca do modelo, e a
 * validação estrita da entrada é do banco (invalid_draft). Erros do banco viram um código curto, sem vazar
 * mensagem original; o executor grava tool_error.
 */
import { firstRow, type AgentRpcClient } from "../rpc.ts";
import type { JsonObject, ToolHandler } from "../types.ts";

/** Códigos de agent_draft_content que podem ir para o log do executor como estão. */
const KNOWN_DRAFT_ERRORS = new Set([
  "invalid_draft",
  "draft_limit_reached",
  "tool_not_allowed",
  "run_not_active",
  "run_owner_not_allowed",
  "agents_killed",
  "agent_run_not_found",
]);

export class DraftToolError extends Error {
  constructor(code: string) {
    super(code);
    this.name = "DraftToolError";
  }
}

export function createDraftTool(client: AgentRpcClient): ToolHandler {
  return async (ctx, input, signal): Promise<JsonObject> => {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new DraftToolError("invalid_draft");
    const { data, error } = await client
      .rpc("agent_draft_content", { p_run_id: ctx.runId, p_draft: input })
      .abortSignal(signal);
    if (error) {
      const code = String(error.message ?? "").trim();
      throw new DraftToolError(KNOWN_DRAFT_ERRORS.has(code) ? code : "draft_failed");
    }
    const row = firstRow(data);
    const contentId = row?.content_id;
    const version = row?.content_version;
    const status = row?.content_status;
    // Defesa em profundidade: qualquer coisa diferente de um rascunho novo é tratada como erro.
    if (typeof contentId !== "string" || typeof version !== "number" || status !== "draft") {
      throw new DraftToolError("draft_unexpected_result");
    }
    return { content_id: contentId, content_version: version, content_status: status };
  };
}
