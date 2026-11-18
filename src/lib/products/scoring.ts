/** Scoring explicável para produtos digitais/infoprodutos. */

import type { ProductPayload, ProductSource } from "./types";

export type ScoreResult = {
  score: number; // 0–100
  reasons: string[];
};

const SOURCE_WEIGHT: Record<ProductSource, number> = {
  kiwify: 15,
  hotmart: 15,
  shopify: 12,
  amazon: 10,
  manual: 5,
  other: 3,
};

export function calculateProductScore(payload: ProductPayload): ScoreResult {
  const reasons: string[] = [];
  let score = 40;

  const sourceBonus = SOURCE_WEIGHT[payload.source] ?? 0;
  score += sourceBonus;
  reasons.push(`Fonte ${payload.source}: +${sourceBonus}`);

  if (payload.commissionPercent && payload.commissionPercent > 0) {
    const commBonus = Math.min(25, Math.round(payload.commissionPercent / 2));
    score += commBonus;
    reasons.push(`Comissão ${payload.commissionPercent}%: +${commBonus}`);
  } else {
    reasons.push("Sem comissão informada");
  }

  if (payload.type === "digital" || payload.type === "info") {
    score += 10;
    reasons.push("Tipo digital/info: +10");
  }

  if (payload.revenueDomain === "affiliate") {
    score += 5;
    reasons.push("Afiliado (menor risco inicial): +5");
  } else if (payload.revenueDomain === "own_sales") {
    score += 8;
    reasons.push("Venda própria: +8");
  }

  const evidenceCount = payload.evidence?.length ?? 0;
  if (evidenceCount > 0) {
    const evBonus = Math.min(15, evidenceCount * 5);
    score += evBonus;
    reasons.push(`${evidenceCount} evidência(s): +${evBonus}`);
  }

  if (payload.priceCents && payload.priceCents >= 9700 && payload.priceCents <= 49700) {
    score += 7;
    reasons.push("Ticket médio ideal (R$97–R$497): +7");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  reasons.push(`Score final: ${score}/100`);

  return { score, reasons };
}
