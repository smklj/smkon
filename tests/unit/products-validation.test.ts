import { test } from "node:test";
import assert from "node:assert/strict";
import { isHttpsUrl, parseDecimal, parseEvidenceInput, parseProductInput, parseReviewInput } from "../../src/lib/products/validation.ts";
import { ValidationError } from "../../src/lib/http/errors.ts";

const now = new Date("2026-11-18T15:00:00Z");

test("parseDecimal aceita formato brasileiro e internacional", () => {
  assert.equal(parseDecimal("197"), 197);
  assert.equal(parseDecimal("1.234,56"), 1234.56);
  assert.equal(parseDecimal("1234.56"), 1234.56);
  assert.equal(parseDecimal(""), null);
  assert.ok(Number.isNaN(parseDecimal("abc")));
});

test("isHttpsUrl exige https, host e nada de credenciais", () => {
  assert.ok(isHttpsUrl("https://hotmart.com/produto/x"));
  assert.equal(isHttpsUrl("http://hotmart.com"), false);
  assert.equal(isHttpsUrl("javascript:alert(1)"), false);
  assert.equal(isHttpsUrl("https://user:senha@hotmart.com"), false);
  assert.equal(isHttpsUrl("https://localhost/x"), false);
  assert.equal(isHttpsUrl("https://a.com/x y"), false);
});

test("produto: padrões, conversão para centavos e erros", () => {
  const product = parseProductInput({ name: "  Curso X ", source: "hotmart", price: "197,90", commission_percent: "40" });
  assert.equal(product.name, "Curso X");
  assert.equal(product.price_cents, 19790);
  assert.equal(product.commission_percent, 40);
  assert.equal(product.revenue_domain, "affiliate");
  assert.equal(product.status, "discovered");
  assert.equal(product.type, "unknown");
  assert.throws(() => parseProductInput({ name: "", source: "hotmart" }), ValidationError);
  assert.throws(() => parseProductInput({ name: "X", source: "tiktok" }), /Fonte inválida/);
  assert.throws(() => parseProductInput({ name: "X", source: "manual", commission_percent: "120" }), /Comissão/);
  assert.throws(() => parseProductInput({ name: "X", source: "manual", affiliate_url: "http://a.com" }), /https/);
  assert.throws(() => parseProductInput({ name: "X", source: "manual", revenue_domain: "outro" }), /Domínio/);
});

test("produto: payload não injeta score nem workspace", () => {
  const product = parseProductInput({ name: "X", source: "manual", score: 100, organization_id: "x", created_by: "y" }) as Record<string, unknown>;
  for (const key of ["score", "score_reasons", "organization_id", "created_by", "evidence"]) assert.equal(key in product, false, key);
});

test("evidência: valor obrigatório, proibido ou com faixa conforme o tipo", () => {
  const page = parseEvidenceInput({ kind: "sales_page", claim: "Página ativa", source_url: "https://hotmart.com/p" }, now);
  assert.equal(page.value, null);
  assert.equal(page.observed_at, now.toISOString());
  assert.throws(() => parseEvidenceInput({ kind: "sales_page", claim: "Página", source_url: "https://a.com/p", value: "3" }, now), /não leva valor/);
  assert.throws(() => parseEvidenceInput({ kind: "commission", claim: "Comissão", source_url: "https://a.com/p" }, now), /exige um valor/);
  assert.throws(() => parseEvidenceInput({ kind: "rating", claim: "Nota", source_url: "https://a.com/p", value: "6" }, now), /fora do intervalo/);
  assert.equal(parseEvidenceInput({ kind: "rating", claim: "Nota", source_url: "https://a.com/p", value: "4,5" }, now).value, 4.5);
  assert.equal(parseEvidenceInput({ kind: "refund_policy", claim: "7 dias", source_url: "https://a.com/p" }, now).value, null);
});

test("evidência: fonte https e data no passado", () => {
  assert.throws(() => parseEvidenceInput({ kind: "other", claim: "Algo", source_url: "ftp://a.com" }, now), /https/);
  assert.throws(() => parseEvidenceInput({ kind: "other", claim: "Algo", source_url: "https://a.com/x", observed_at: "2026-12-01" }, now), /futuro/);
  assert.equal(
    parseEvidenceInput({ kind: "other", claim: "Algo", source_url: "https://a.com/x", observed_at: "2026-11-01" }, now).observed_at,
    "2026-11-01T12:00:00.000Z",
  );
  assert.throws(() => parseEvidenceInput({ kind: "other", claim: "Algo", source_url: "https://a.com/x", observed_at: "ontem" }, now), /inválida/);
  assert.throws(() => parseEvidenceInput({ kind: "outro", claim: "Algo", source_url: "https://a.com/x" }, now), /Tipo/);
});

test("revisão: rejeição exige motivo", () => {
  const id = "11111111-2222-4333-8444-555555555555";
  assert.deepEqual(parseReviewInput({ evidence_id: id, decision: "verified" }), { evidenceId: id, decision: "verified", note: null });
  assert.throws(() => parseReviewInput({ evidence_id: id, decision: "rejected" }), /motivo/);
  assert.throws(() => parseReviewInput({ evidence_id: "x", decision: "verified" }), /Evidência inválida/);
  assert.throws(() => parseReviewInput({ evidence_id: id, decision: "aprovado" }), /Decisão/);
});
