/**
 * Log estruturado (JSON em uma linha), legível nos Runtime Logs da Vercel.
 * Campos com nomes sensíveis são substituídos por "[redacted]".
 */

type Level = "info" | "warn" | "error";

const SENSITIVE_KEY = /token|password|senha|secret|authorization|cookie|api[_-]?key|hash/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[redacted]" : redact(item, depth + 1),
    ]),
  );
}

export function errorFields(error: unknown): { code?: string; message: string } {
  if (error instanceof Error) return { message: error.message };
  const db = error as { code?: string; message?: string } | null | undefined;
  return { code: db?.code, message: db?.message ?? String(error) };
}

export function log(level: Level, scope: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, scope, ...(redact(fields) as Record<string, unknown>) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
