import { test } from "node:test";
import assert from "node:assert/strict";
import { contentSecurityPolicy, securityHeaders } from "../../src/lib/http/security-headers.ts";
import { errorFields, log, redact, setLogSinks } from "../../src/lib/observability/log.ts";
import { clientIp, rateLimitSubject } from "../../src/lib/http/rate-limit.ts";

const NONCE = "AAAAAAAAAAAAAAAAAAAAAA==";

test("CSP bloqueia iframe, plugins, base e formulários externos", () => {
  const csp = contentSecurityPolicy({ nonce: NONCE, supabaseUrl: "https://abc.supabase.co" });
  for (const directive of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "default-src 'self'"]) {
    assert.ok(csp.includes(directive), directive);
  }
  assert.ok(csp.includes("connect-src 'self' https://abc.supabase.co wss://abc.supabase.co"));
  assert.equal(csp.includes("'unsafe-eval'"), false);
  assert.ok(contentSecurityPolicy({ nonce: NONCE, isDev: true }).includes("'unsafe-eval'"));
});

test("headers essenciais presentes (CSP sai do next.config e vai para o Proxy)", () => {
  const keys = securityHeaders().map((h) => h.key);
  assert.equal(keys.includes("Content-Security-Policy"), false);
  for (const key of ["X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Strict-Transport-Security"]) {
    assert.ok(keys.includes(key), key);
  }
});

test("redact esconde campos sensíveis em qualquer nível", () => {
  const out = redact({ token: "x", nested: { password: "y", ok: 1, list: [{ apiKey: "z" }] }, tokenHash: "h", email: "e@x.com" }) as Record<string, unknown>;
  assert.equal(out.token, "[redacted]");
  assert.equal(out.tokenHash, "[redacted]");
  assert.deepEqual(out.nested, { password: "[redacted]", ok: 1, list: [{ apiKey: "[redacted]" }] });
  assert.equal(out.email, "e@x.com");
});

test("log escreve uma linha JSON com nível e escopo", (t) => {
  setLogSinks(null);
  const lines: string[] = [];
  t.mock.method(console, "warn", (line: string) => lines.push(line));
  log("warn", "teste", { cookie: "segredo", count: 2 });
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.level, "warn");
  assert.equal(parsed.scope, "teste");
  assert.equal(parsed.cookie, "[redacted]");
  assert.equal(parsed.count, 2);
});

test("errorFields aceita Error e erros do banco", () => {
  assert.deepEqual(errorFields(new Error("falhou")), { message: "falhou" });
  assert.deepEqual(errorFields({ code: "23505", message: "dup" }), { code: "23505", message: "dup" });
});

test("sujeito do rate limit é hash normalizado (nunca o valor real)", () => {
  const a = rateLimitSubject("  Pessoa@Empresa.com ");
  assert.match(a, /^[a-f0-9]{64}$/);
  assert.equal(a, rateLimitSubject("pessoa@empresa.com"));
  assert.notEqual(a, rateLimitSubject("outra@empresa.com"));
});

test("IP do cliente vem do primeiro X-Forwarded-For", () => {
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })), "203.0.113.7");
  assert.equal(clientIp(new Headers({ "x-real-ip": "198.51.100.2" })), "198.51.100.2");
  assert.equal(clientIp(new Headers()), "unknown");
});
