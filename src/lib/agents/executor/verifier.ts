/**
 * Verifier determinístico (regra, não "outro LLM concordando").
 *
 * Regras desta etapa:
 * 1. Pelo menos uma ferramenta executou com sucesso (resultado sem nenhuma observação não é verificável).
 * 2. Toda afirmação com productId cita ao menos uma evidência, e cada evidência citada foi OBSERVADA nesta
 *    execução pela ferramenta read_product_evidence, com review_status = "verified" e do mesmo produto.
 *
 * Contrato de saída esperado de read_product_evidence (fixado na etapa 3):
 *   { items: [{ id: uuid, product_id: uuid, review_status: "pending" | "verified" | "rejected", ... }] }
 */
import type { Observation, RunContext, Summary, VerifyResult } from "./types.ts";

type EvidenceRow = { id: string; productId: string | null };

function verifiedEvidence(observations: readonly Observation[]): Map<string, EvidenceRow> {
  const found = new Map<string, EvidenceRow>();
  for (const observation of observations) {
    if (observation.tool !== "read_product_evidence" || observation.status !== "ok") continue;
    const items = observation.output.items;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      if (row.review_status !== "verified" || typeof row.id !== "string") continue;
      found.set(row.id.toLowerCase(), {
        id: row.id.toLowerCase(),
        productId: typeof row.product_id === "string" ? row.product_id.toLowerCase() : null,
      });
    }
  }
  return found;
}

export function verifyRun(_ctx: RunContext, observations: readonly Observation[], summary: Summary): VerifyResult {
  const reasons: string[] = [];
  if (!observations.some((observation) => observation.status === "ok")) {
    return { ok: false, code: "verify_failed", reasons: ["nenhuma ferramenta executou com sucesso"] };
  }

  const evidence = verifiedEvidence(observations);
  summary.claims.forEach((claim, index) => {
    if (!claim.productId) return;
    if (claim.evidenceIds.length === 0) {
      reasons.push(`afirmação ${index + 1}: produto sem evidência citada`);
      return;
    }
    for (const id of claim.evidenceIds) {
      const row = evidence.get(id);
      if (!row) reasons.push(`afirmação ${index + 1}: evidência ${id} não verificada nesta execução`);
      else if (row.productId !== claim.productId) reasons.push(`afirmação ${index + 1}: evidência ${id} é de outro produto`);
    }
  });

  return reasons.length > 0 ? { ok: false, code: "evidence_missing", reasons } : { ok: true, reasons: [] };
}
