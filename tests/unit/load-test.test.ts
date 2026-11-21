import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, percentile, summarize } from "../../scripts/load-test.mjs";

test("load-test: percentil nearest-rank", () => {
  const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(percentile(sorted, 50), 50);
  assert.equal(percentile(sorted, 95), 95);
  assert.equal(percentile(sorted, 99), 99);
  assert.equal(percentile([7], 95), 7);
  assert.equal(percentile([], 50), null);
});

test("load-test: resumo conta 5xx e falhas de rede como erro, 4xx não", () => {
  const summary = summarize("/x", [
    { ms: 10, status: 200 }, { ms: 20, status: 401 }, { ms: 30, status: 503 }, { ms: 40, error: "timeout" },
  ], 1000);
  assert.equal(summary.requests, 4);
  assert.equal(summary.errors, 2);
  assert.deepEqual(summary.statuses, { 200: 1, 401: 1, 503: 1, timeout: 1 });
  assert.equal(summary.rps, 4);
  assert.equal(summary.p50, 20);
  assert.equal(summary.max, 40);
});

test("load-test: alvo local por padrão e remoto só com opt-in explícito", () => {
  const config = parseArgs(["--paths", "/login,/api/products", "--concurrency", "5"], {});
  assert.equal(config.target, "http://localhost:3000");
  assert.deepEqual(config.paths, ["/login", "/api/products"]);
  assert.equal(config.concurrency, 5);
  assert.throws(() => parseArgs(["--target", "https://smkon.vercel.app"], {}), /remoto recusado/);
  assert.equal(parseArgs(["--target", "https://preview.example.com/"], { LOAD_ALLOW_REMOTE: "1" }).target, "https://preview.example.com");
  assert.throws(() => parseArgs(["--concurrency", "0"], {}), /inteiro positivo/);
  assert.throws(() => parseArgs(["--paths", "login"], {}), /começar com/);
  assert.throws(() => parseArgs(["--target", "ftp://localhost"], {}), /http/);
});
