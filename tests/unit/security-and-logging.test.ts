import { test } from "node:test";
import assert from "node:assert/strict";
import { contentSecurityPolicy, securityHeaders } from "../../src/lib/http/security-headers.ts";
import { errorFields, log, redact, setLogSinks } from "../../src/lib/observability/log.ts";
import { clientIp, consumeLoginRateLimit, rateLimitSubject } from "../../src/lib/http/rate-limit.ts";

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

test("limite de login: usa só a chave de servidor e libera (registrando) quando ela falta", async () => {
  const lines: string[] = [];
  setLogSinks([{ name: "memoria", write: (_record, line) => void lines.push(line) }]);
  try {
    const subject = rateLimitSubject("pessoa@empresa.com");
    assert.deepEqual(await consumeLoginRateLimit(null, "login_email", subject), { allowed: true, retryAfterSeconds: 0 });
    assert.ok(lines.some((line) => line.includes("rate_limit.login_unprotected")), "registra que o limite está desligado");

    const calls: Array<{ fn: string; args: unknown }> = [];
    const blocked = {
      rpc: async (fn: string, args: unknown) => {
        calls.push({ fn, args });
        return { data: [{ allowed: false, remaining: 0, retry_after_seconds: 120 }], error: null };
      },
    };
    // @ts-expect-error cliente mínimo para o teste
    assert.deepEqual(await consumeLoginRateLimit(blocked, "login_ip", subject), { allowed: false, retryAfterSeconds: 120 });
    assert.deepEqual(calls, [{ fn: "rate_limit_consume_login", args: { p_scope: "login_ip", p_subject: subject } }]);

    const failing = { rpc: async () => ({ data: null, error: { message: "boom", code: "XX000" } }) };
    // @ts-expect-error cliente mínimo para o teste
    assert.deepEqual(await consumeLoginRateLimit(failing, "login_email", subject), { allowed: true, retryAfterSeconds: 0 });
  } finally {
    setLogSinks(null);
  }
});
