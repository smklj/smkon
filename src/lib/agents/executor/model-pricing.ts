/**
 * S14 — preço dos modelos e teto mensal de gasto do executor.
 *
 * O teto (AGENT_MONTHLY_BUDGET_USD) só é aplicável a modelos com preço conhecido: modelo fora de MODEL_PRICES
 * é recusado pelo worker (budget_not_configured). Preços do catálogo do Vercel AI Gateway em 19/11/2026, faixa até
 * 100 mil tokens de entrada (o prompt do resumo é limitado bem abaixo disso), com 10% de margem para preço regional.
 */

export interface ModelPrice {
  /** USD por token de entrada. */
  input: number;
  /** USD por token de saída. */
  output: number;
}

export const MODEL_PRICES: Readonly<Record<string, ModelPrice>> = {
  "anthropic/claude-haiku-5.5": { input: 0.0000001, output: 0.0000005 },
  "openai/gpt-5-mini": { input: 0.00000025, output: 0.000002 },
  "anthropic/claude-opus-5.5": { input: 0.000004, output: 0.00002 },
};
export const PRICE_MARGIN = 1.1;
export const MAX_MONTHLY_BUDGET_USD = 1000;

export function modelPrice(model: string): ModelPrice | null {
  return Object.prototype.hasOwnProperty.call(MODEL_PRICES, model) ? MODEL_PRICES[model] : null;
}

/** Custo estimado em USD, arredondado para cima no micro-dólar. */
export function estimateCost(price: ModelPrice, inputTokens: number, outputTokens: number): number {
  const raw = (inputTokens * price.input + outputTokens * price.output) * PRICE_MARGIN;
  return Math.ceil(raw * 1_000_000) / 1_000_000;
}

/** 0 < valor ≤ 1000, até 2 casas decimais; qualquer outra coisa é null (teto não configurado). */
export function parseBudget(raw: string | undefined): number | null {
  if (typeof raw !== "string" || !/^\d{1,4}(\.\d{1,2})?$/.test(raw.trim())) return null;
  const value = Number(raw.trim());
  return value > 0 && value <= MAX_MONTHLY_BUDGET_USD ? value : null;
}

/** Início do mês corrente em UTC (janela do teto mensal). */
export function monthStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
