import { test } from "node:test";
import assert from "node:assert/strict";
import { consoleSink, createHttpSink, log, setLogSinks, sinksFromEnv, type LogSink } from "../../src/lib/observability/log.ts";

type Call = { url: string; init: RequestInit };

function fakeFetch(respond: (call: Call) => Promise<Response>) {
  const calls: Call[] = [];
  const fetchImpl = (url: string, init: RequestInit) => {
    const call = { url, init };
    calls.push(call);
    return respond(call);
  };
  return { calls, fetchImpl };
}

function collector() {
  const pending: Promise<unknown>[] = [];
  return { pending, waitUntil: (p: Promise<unknown>) => void pending.push(p) };
}

test("sem LOG_DRAIN_URL só existe o console", () => {
  const sinks = sinksFromEnv({});
  assert.deepEqual(sinks.map((s) => s.name), ["console"]);
  assert.equal(sinks[0], consoleSink);
});

test("com LOG_DRAIN_URL https o destino HTTP é ligado", () => {
  const sinks = sinksFromEnv({ LOG_DRAIN_URL: "https://logs.example.com/ingest" });
  assert.deepEqual(sinks.map((s) => s.name), ["console", "http"]);
});

test("URL sem https é recusada sem derrubar o app (fica só o console)", (t) => {
  const warnings: string[] = [];
  t.mock.method(console, "warn", (line: string) => warnings.push(line));
  const sinks = sinksFromEnv({ LOG_DRAIN_URL: "http://logs.example.com", LOG_DRAIN_TOKEN: "tok-secreto" });
  assert.deepEqual(sinks.map((s) => s.name), ["console"]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /invalid_config/);
  assert.equal(warnings[0].includes("tok-secreto"), false);
  assert.deepEqual(sinksFromEnv({ LOG_DRAIN_URL: "não é url" }).map((s) => s.name), ["console"]);
});

test("envia o registro já redigido, com token e metadados, sem bloquear o log()", async (t) => {
  t.mock.method(console, "warn", () => {});
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const { calls, fetchImpl } = fakeFetch(async () => {
    await gate;
    return new Response(null, { status: 202 });
  });
  const keep = collector();
  setLogSinks([
    consoleSink,
    createHttpSink({ url: "https://logs.example.com/i", token: "tok", fetchImpl, waitUntil: keep.waitUntil, meta: { service: "smkon", env: "preview" } }),
  ]);
  try {
    log("warn", "teste", { password: "p", nested: { apiKey: "k" }, count: 1 });
    // log() retornou antes de o envio terminar.
    assert.equal(keep.pending.length, 1);
    await new Promise((r) => setImmediate(r));
    assert.equal(calls.length, 1);
    const { url, init } = calls[0];
    assert.equal(url, "https://logs.example.com/i");
    assert.equal(init.method, "POST");
    const headers = init.headers as Record<string, string>;
    assert.equal(headers.authorization, "Bearer tok");
    assert.equal(headers["content-type"], "application/json");
    const body = JSON.parse(String(init.body));
    assert.equal(body.password, "[redacted]");
    assert.deepEqual(body.nested, { apiKey: "[redacted]" });
    assert.equal(body.count, 1);
    assert.equal(body.level, "warn");
    assert.equal(body.scope, "teste");
    assert.equal(body.service, "smkon");
    assert.equal(body.env, "preview");
    release();
    await Promise.all(keep.pending);
  } finally {
    setLogSinks(null);
  }
});

test("nível mínimo padrão é warn; info não sai do console", async (t) => {
  t.mock.method(console, "log", () => {});
  t.mock.method(console, "error", () => {});
  const { calls, fetchImpl } = fakeFetch(async () => new Response(null, { status: 200 }));
  const keep = collector();
  const sink = createHttpSink({ url: "https://logs.example.com", fetchImpl, waitUntil: keep.waitUntil });
  setLogSinks([consoleSink, sink]);
  try {
    log("info", "x");
    log("error", "y");
    await Promise.all(keep.pending);
    assert.equal(calls.length, 1);
    assert.equal(JSON.parse(String(calls[0].init.body)).scope, "y");
  } finally {
    setLogSinks(null);
  }
});

test("timeout curto aborta o envio e a falha não propaga nem chama log()", async (t) => {
  const warnings: string[] = [];
  t.mock.method(console, "warn", (line: string) => warnings.push(line));
  const { fetchImpl } = fakeFetch(
    ({ init }) =>
      new Promise((_, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
  );
  const keep = collector();
  const sink = createHttpSink({ url: "https://logs.example.com", timeoutMs: 100, fetchImpl, waitUntil: keep.waitUntil });
  const started = Date.now();
  sink.write({ ts: "t", level: "error", scope: "s" }, "{}");
  await Promise.all(keep.pending);
  assert.ok(Date.now() - started < 2000);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /"reason":"timeout"/);
});

test("erro HTTP e exceção de rede são engolidos; aviso no máximo uma vez por minuto", async (t) => {
  const warnings: string[] = [];
  t.mock.method(console, "warn", (line: string) => warnings.push(line));
  let mode: "500" | "throw" = "500";
  const { fetchImpl } = fakeFetch(async () => {
    if (mode === "throw") throw new TypeError("fetch failed");
    return new Response(null, { status: 500 });
  });
  const keep = collector();
  const sink = createHttpSink({ url: "https://logs.example.com", fetchImpl, waitUntil: keep.waitUntil });
  sink.write({ ts: "t", level: "error", scope: "s" }, "{}");
  await Promise.all(keep.pending);
  mode = "throw";
  sink.write({ ts: "t", level: "error", scope: "s" }, "{}");
  await Promise.all(keep.pending);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /status_500/);
});

test("destino que lança exceção não interrompe log() nem os outros destinos", (t) => {
  const lines: string[] = [];
  t.mock.method(console, "error", (line: string) => lines.push(line));
  const broken: LogSink = { name: "broken", write: () => { throw new Error("boom"); } };
  setLogSinks([broken, consoleSink]);
  try {
    assert.doesNotThrow(() => log("error", "z", { a: 1 }));
    assert.equal(lines.length, 1);
  } finally {
    setLogSinks(null);
  }
});
