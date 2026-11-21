/**
 * Log estruturado (JSON em uma linha), legível nos Runtime Logs da Vercel.
 * Campos com nomes sensíveis são substituídos por "[redacted]".
 *
 * Destinos ("sinks"): o console é sempre o padrão. Um destino HTTP genérico é ligado só quando
 * `LOG_DRAIN_URL` está definida (docs/S6_1_HANDOFF.md). O envio nunca bloqueia nem derruba a
 * requisição: sem `await`, timeout curto, falhas engolidas e sem chamar `log()` de novo.
 */

export type Level = "info" | "warn" | "error";

export type LogRecord = { ts: string; level: Level; scope: string } & Record<string, unknown>;

export interface LogSink {
  readonly name: string;
  write(record: LogRecord, line: string): void;
}

const SENSITIVE_KEY = /token|password|senha|secret|authorization|cookie|api[_-]?key|hash/i;
const LEVEL_RANK: Record<Level, number> = { info: 0, warn: 1, error: 2 };

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

export const consoleSink: LogSink = {
  name: "console",
  write(record, line) {
    if (record.level === "error") console.error(line);
    else if (record.level === "warn") console.warn(line);
    else console.log(line);
  },
};

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export type HttpSinkOptions = {
  url: string;
  token?: string;
  minLevel?: Level;
  timeoutMs?: number;
  /** Metadados fixos anexados a cada registro (ex.: serviço e ambiente). */
  meta?: Record<string, string>;
  fetchImpl?: FetchLike;
  /** Mantém a função viva até o envio terminar (Vercel `waitUntil`), sem bloquear a resposta. */
  waitUntil?: (promise: Promise<unknown>) => void;
};

const DEFAULT_TIMEOUT_MS = 1500;
const MAX_TIMEOUT_MS = 5000;
const FAILURE_NOTICE_INTERVAL_MS = 60_000;

/** `waitUntil` do runtime da Vercel, se existir (mesmo contexto usado por @vercel/functions). */
function vercelWaitUntil(promise: Promise<unknown>): void {
  try {
    const store = (globalThis as Record<symbol, { get?: () => { waitUntil?: (p: Promise<unknown>) => void } } | undefined>)[
      Symbol.for("@vercel/request-context")
    ];
    store?.get?.()?.waitUntil?.(promise);
  } catch {
    // Fora da Vercel: o envio segue em segundo plano sem garantia de conclusão.
  }
}

export function createHttpSink(options: HttpSinkOptions): LogSink {
  const url = new URL(options.url);
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal)) {
    throw new Error("LOG_DRAIN_URL precisa usar https.");
  }
  const minRank = LEVEL_RANK[options.minLevel ?? "warn"];
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 100), MAX_TIMEOUT_MS);
  const doFetch: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const keepAlive = options.waitUntil ?? vercelWaitUntil;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  let lastFailureNotice = 0;

  function notifyFailure(reason: string) {
    const now = Date.now();
    if (now - lastFailureNotice < FAILURE_NOTICE_INTERVAL_MS) return;
    lastFailureNotice = now;
    // Direto no console (nunca via log()): evita recursão quando o destino está fora do ar.
    console.warn(JSON.stringify({ ts: new Date(now).toISOString(), level: "warn", scope: "log.sink", sink: "http", reason }));
  }

  return {
    name: "http",
    write(record) {
      if (LEVEL_RANK[record.level] < minRank) return;
      let body: string;
      try {
        body = JSON.stringify({ ...options.meta, ...record });
      } catch {
        return;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const sending = Promise.resolve()
        .then(() => doFetch(url.toString(), { method: "POST", headers, body, signal: controller.signal }))
        .then((response) => {
          if (!response.ok) notifyFailure(`status_${response.status}`);
        })
        .catch((error: unknown) => {
          notifyFailure(controller.signal.aborted ? "timeout" : error instanceof Error ? error.name : "error");
        })
        .finally(() => clearTimeout(timer));
      keepAlive(sending);
    },
  };
}

function parseLevel(value: string | undefined): Level | undefined {
  return value === "info" || value === "warn" || value === "error" ? value : undefined;
}

/** Destinos a partir do ambiente. Sem `LOG_DRAIN_URL`, apenas o console. Configuração inválida não derruba o app. */
export function sinksFromEnv(env: Record<string, string | undefined> = process.env): LogSink[] {
  const sinks: LogSink[] = [consoleSink];
  const url = env.LOG_DRAIN_URL?.trim();
  if (!url) return sinks;
  try {
    const timeout = Number(env.LOG_DRAIN_TIMEOUT_MS);
    sinks.push(
      createHttpSink({
        url,
        token: env.LOG_DRAIN_TOKEN?.trim() || undefined,
        minLevel: parseLevel(env.LOG_DRAIN_LEVEL?.trim()),
        timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : undefined,
        meta: { service: "smkon", ...(env.VERCEL_ENV ? { env: env.VERCEL_ENV } : {}) },
      }),
    );
  } catch (error) {
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "warn",
        scope: "log.sink",
        reason: "invalid_config",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
  return sinks;
}

let activeSinks: LogSink[] | null = null;

/** Substitui os destinos (testes) ou, com `null`, volta a lê-los do ambiente na próxima chamada. */
export function setLogSinks(sinks: LogSink[] | null): void {
  activeSinks = sinks;
}

export function log(level: Level, scope: string, fields: Record<string, unknown> = {}): void {
  const record = { ts: new Date().toISOString(), level, scope, ...(redact(fields) as Record<string, unknown>) } as LogRecord;
  const line = JSON.stringify(record);
  activeSinks ??= sinksFromEnv();
  for (const sink of activeSinks) {
    try {
      sink.write(record, line);
    } catch {
      // Um destino com defeito nunca interrompe a requisição nem os demais destinos.
    }
  }
}
