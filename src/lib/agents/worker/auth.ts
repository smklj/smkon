/**
 * S14 etapa 6 — proteção da rota do worker.
 *
 * - Desligado por padrão: só roda com AGENT_EXECUTOR_ENABLED === "true" (exatamente).
 * - Segredo do cron (CRON_SECRET) no header Authorization: Bearer <segredo>. A Vercel envia esse header nas
 *   chamadas de Cron Jobs quando CRON_SECRET existe no projeto.
 * - Comparação em tempo constante: compara os SHA-256 dos dois lados com timingSafeEqual, então nem o conteúdo
 *   nem o tamanho do segredo influenciam o tempo da comparação.
 */
import { createHash, timingSafeEqual } from "node:crypto";

/** Tamanho mínimo aceito para CRON_SECRET; abaixo disso o worker se recusa a rodar. */
export const MIN_CRON_SECRET_LENGTH = 32;

export type WorkerEnv = Readonly<Record<string, string | undefined>>;

export function executorEnabled(env: WorkerEnv): boolean {
  return env.AGENT_EXECUTOR_ENABLED === "true";
}

/** Segredo utilizável ou null (ausente, curto demais ou com espaços nas pontas). */
export function cronSecret(env: WorkerEnv): string | null {
  const secret = env.CRON_SECRET;
  if (typeof secret !== "string" || secret.length < MIN_CRON_SECRET_LENGTH || secret.trim() !== secret) return null;
  return secret;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** true só se o header for exatamente "Bearer <secret>". */
export function bearerMatches(header: string | null | undefined, secret: string): boolean {
  const presented = typeof header === "string" && header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  // Sempre compara (mesmo com header ausente) para não criar um caminho mais rápido.
  const equal = timingSafeEqual(digest(presented), digest(secret));
  return equal && presented.length > 0;
}
