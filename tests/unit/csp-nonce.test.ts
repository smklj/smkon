import { test } from "node:test";
import assert from "node:assert/strict";
import { contentSecurityPolicy, generateNonce } from "../../src/lib/http/security-headers.ts";

function directives(csp: string): Map<string, string[]> {
  return new Map(
    csp.split(";").map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name, values] as [string, string[]];
    }),
  );
}

test("nonce: 128 bits em base64, diferente a cada chamada", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i += 1) {
    const nonce = generateNonce();
    assert.match(nonce, /^[A-Za-z0-9+/]{22}==$/);
    assert.equal(Buffer.from(nonce, "base64").length, 16);
    seen.add(nonce);
  }
  assert.equal(seen.size, 200);
});

test("script-src usa o nonce, sem 'unsafe-inline' e sem 'strict-dynamic'", () => {
  const nonce = generateNonce();
  const d = directives(contentSecurityPolicy({ nonce, supabaseUrl: "https://abc.supabase.co" }));
  const script = d.get("script-src") ?? [];
  assert.ok(script.includes(`'nonce-${nonce}'`));
  assert.ok(script.includes("'self'"));
  assert.equal(script.includes("'unsafe-inline'"), false);
  assert.equal(script.includes("'strict-dynamic'"), false);
  assert.equal(script.includes("'unsafe-eval'"), false);
  // A allowlist de host continua valendo (sem strict-dynamic) para a barra da Vercel nos Previews.
  assert.ok(script.includes("https://vercel.live"));
});

test("style-src: <style> só com nonce; 'unsafe-inline' restrito a atributos", () => {
  const nonce = generateNonce();
  const d = directives(contentSecurityPolicy({ nonce }));
  assert.deepEqual(d.get("style-src"), ["'self'", `'nonce-${nonce}'`]);
  assert.deepEqual(d.get("style-src-attr"), ["'unsafe-inline'"]);
  assert.equal(d.has("style-src-elem"), false);
});

test("nenhuma diretiva aceita 'unsafe-inline' além de style-src-attr", () => {
  const d = directives(contentSecurityPolicy({ nonce: generateNonce(), isDev: true }));
  for (const [name, values] of d) {
    if (name === "style-src-attr") continue;
    assert.equal(values.includes("'unsafe-inline'"), false, name);
  }
});

test("Supabase: origem exata quando configurado; curinga quando ausente ou inválido", () => {
  const nonce = generateNonce();
  const exact = directives(contentSecurityPolicy({ nonce, supabaseUrl: "https://abc.supabase.co/rest/v1" }));
  assert.ok(exact.get("connect-src")?.includes("https://abc.supabase.co"));
  assert.ok(exact.get("connect-src")?.includes("wss://abc.supabase.co"));
  assert.ok(exact.get("img-src")?.includes("https://abc.supabase.co"));
  const wildcard = directives(contentSecurityPolicy({ nonce, supabaseUrl: "não é url" }));
  assert.ok(wildcard.get("connect-src")?.includes("https://*.supabase.co"));
});

test("nonce inválido é recusado (evita injeção de diretivas)", () => {
  for (const bad of ["", "curto", "abc'; script-src *", "AAAAAAAAAAAAAAAAAAAAAA== 'unsafe-inline'"]) {
    assert.throws(() => contentSecurityPolicy({ nonce: bad }), /nonce/);
  }
});
