/** Limites do executor: timeout por passo e tamanho de payload (mesma regra do banco: 64 KB do JSON). */

export class StepTimeoutError extends Error {
  constructor(ms: number) {
    super(`step_timeout after ${ms}ms`);
    this.name = "StepTimeoutError";
  }
}

/**
 * Executa `fn` com um AbortSignal que dispara após `ms`. Rejeita com StepTimeoutError no prazo,
 * mesmo que `fn` ignore o sinal; o timer é sempre limpo.
 */
export async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new StepTimeoutError(ms);
      controller.abort(error);
      reject(error);
    }, ms);
  });
  try {
    return await Promise.race([fn(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

const encoder = new TextEncoder();

/** Espaços que jsonb::text acrescenta: ", " entre itens e ": " entre chave e valor (JSON.stringify não usa). */
function jsonbSpacing(value: unknown, depth = 0): number {
  if (depth > 64 || value === null || typeof value !== "object") return 0;
  if (Array.isArray(value)) {
    return Math.max(value.length - 1, 0) + value.reduce<number>((sum, item) => sum + jsonbSpacing(item, depth + 1), 0);
  }
  const entries = Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined && typeof item !== "function");
  return entries.length + Math.max(entries.length - 1, 0) + entries.reduce((sum, [, item]) => sum + jsonbSpacing(item, depth + 1), 0);
}

/**
 * Bytes de octet_length(jsonb::text), a regra de 64 KB de agent_record_step / agent_finish_run:
 * JSON UTF-8 mais os espaços do formato jsonb. Infinity se o valor não for serializável.
 */
export function jsonBytes(value: unknown): number {
  try {
    const normalized = value ?? {};
    const text = JSON.stringify(normalized);
    return text === undefined ? Infinity : encoder.encode(text).length + jsonbSpacing(JSON.parse(text));
  } catch {
    return Infinity;
  }
}

export function fitsPayload(value: unknown, maxBytes: number): boolean {
  return jsonBytes(value) <= maxBytes;
}
