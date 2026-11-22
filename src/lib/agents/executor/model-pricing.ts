/**
 * S14 — catálogo de modelos do executor: preço, faixa de contexto longo e ajustes da requisição.
 *
 * O teto (AGENT_MONTHLY_BUDGET_USD) só é aplicável a modelos com preço conhecido: modelo fora de MODEL_PRICES
 * é recusado pelo worker (budget_not_configured). Preços do catálogo do Vercel AI Gateway conferidos em
 * 22/11/2026, com 10% de margem para preço regional. Quando o catálogo mostra promoção, vale o preço de tabela
 * (o teto nunca subestima o gasto se a promoção acabar).
 */

export interface ModelPrice {
  /** USD por token de entrada. */
  input: number;
  /** USD por token de saída (inclui tokens de raciocínio). */
  output: number;
  /**
   * Faixa de contexto longo: quando a entrada passa de `aboveInputTokens`, a chamada inteira é cobrada
   * com estes preços (como no catálogo: Haiku 5.5 acima de 100 mil tokens custa 5x).
   */
  longContext?: { aboveInputTokens: number; input: number; output: number };
}

export const MODEL_PRICES: Readonly<Record<string, ModelPrice>> = {
  "anthropic/claude-haiku-5.5": {
    input: 0.0000001,
    output: 0.0000005,
    longContext: { aboveInputTokens: 100_000, input: 0.0000005, output: 0.0000025 },
  },
  "openai/gpt-5-mini": { input: 0.00000025, output: 0.000002 },
  "anthropic/claude-opus-5.5": { input: 0.000004, output: 0.00002 },
  // Google Gemini pelo AI Gateway (endpoints Google AI Studio e Vertex, sem treino com os dados).
  // Catálogo com 50% de desconto promocional (0,75/3,75 e 2/10 por milhão); aqui fica o preço de tabela.
  "google/gemini-3.8-flash": { input: 0.0000015, output: 0.0000075 },
  "google/gemini-4-argon": { input: 0.000004, output: 0.00002 },
};

/** Ajustes por modelo na chamada ao Gateway. */
export interface ModelRequestProfile {
  /** Esforço de raciocínio (extensão `reasoning.effort` do Gateway), suportado pelo modelo no catálogo. */
  reasoningEffort?: "low";
  /** Tokens extras de saída para o raciocínio não truncar a resposta em JSON. */
  outputHeadroom?: number;
}

const MODEL_REQUEST: Readonly<Record<string, ModelRequestProfile>> = {
  // Gemini raciocina por padrão e os tokens de raciocínio contam no limite de saída.
  "google/gemini-3.8-flash": { reasoningEffort: "low", outputHeadroom: 1_024 },
  "google/gemini-4-argon": { reasoningEffort: "low", outputHeadroom: 1_024 },
};

export function modelRequestProfile(model: string): ModelRequestProfile {
  return Object.prototype.hasOwnProperty.call(MODEL_REQUEST, model) ? MODEL_REQUEST[model] : {};
}

export const PRICE_MARGIN = 1.1;
export const MAX_MONTHLY_BUDGET_USD = 1000;

export function modelPrice(model: string): ModelPrice | null {
  return Object.prototype.hasOwnProperty.call(MODEL_PRICES, model) ? MODEL_PRICES[model] : null;
}

/** Custo estimado em USD, arredondado para cima no micro-dólar. */
export function estimateCost(price: ModelPrice, inputTokens: number, outputTokens: number): number {
  const rates = price.longContext && inputTokens > price.longContext.aboveInputTokens ? price.longContext : price;
  const raw = (inputTokens * rates.input + outputTokens * rates.output) * PRICE_MARGIN;
  // toFixed elimina o ruído de ponto flutuante (11550.000000000002 → 11550) antes de arredondar para cima.
  return Math.ceil(Number((raw * 1_000_000).toFixed(6))) / 1_000_000;
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
