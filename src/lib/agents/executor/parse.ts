/**
 * Validação da saída do modelo. O modelo é tratado como entrada não confiável: só o formato aceito aqui
 * chega ao loop. Ferramenta desconhecida NÃO é erro de formato — o banco a registra como "rejected".
 */
import type { Claim, JsonObject, PlannedCall, Summary } from "./types.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOOL_NAME = /^[a-z][a-z0-9_]{1,63}$/;
export const MAX_SUMMARY_CHARS = 8000;
export const MAX_CLAIMS = 50;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Plano: { steps: [{ tool, input? }] } com 1..maxCalls chamadas. Retorna null se inválido. */
export function parsePlan(raw: unknown, maxCalls: number): PlannedCall[] | null {
  if (!isObject(raw) || !Array.isArray(raw.steps)) return null;
  const steps = raw.steps;
  if (steps.length < 1 || steps.length > maxCalls) return null;
  const calls: PlannedCall[] = [];
  for (const step of steps) {
    if (!isObject(step) || typeof step.tool !== "string" || !TOOL_NAME.test(step.tool)) return null;
    if (step.input !== undefined && !isObject(step.input)) return null;
    calls.push({ tool: step.tool, input: (step.input as JsonObject | undefined) ?? {} });
  }
  return calls;
}

/** Resumo: { text, claims?: [{ text, productId?, evidenceIds? }] }. Retorna null se inválido. */
export function parseSummary(raw: unknown): Summary | null {
  if (!isObject(raw) || typeof raw.text !== "string") return null;
  const text = raw.text.trim();
  if (text.length === 0 || text.length > MAX_SUMMARY_CHARS) return null;
  const rawClaims = raw.claims ?? [];
  if (!Array.isArray(rawClaims) || rawClaims.length > MAX_CLAIMS) return null;
  const claims: Claim[] = [];
  for (const item of rawClaims) {
    if (!isObject(item) || typeof item.text !== "string" || item.text.trim().length === 0) return null;
    if (item.productId !== undefined && (typeof item.productId !== "string" || !UUID.test(item.productId))) return null;
    const evidenceIds = item.evidenceIds ?? [];
    if (!Array.isArray(evidenceIds) || !evidenceIds.every((id) => typeof id === "string" && UUID.test(id))) return null;
    claims.push({
      text: item.text.trim(),
      ...(item.productId ? { productId: (item.productId as string).toLowerCase() } : {}),
      evidenceIds: (evidenceIds as string[]).map((id) => id.toLowerCase()),
    });
  }
  return { text, claims };
}
