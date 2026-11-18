import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateProductScore } from "../../src/lib/products/scoring.ts";

test("score mínimo explica a ausência de comissão", () => {
  const result = calculateProductScore({ name: "Produto", source: "manual" });
  assert.equal(result.score, 45);
  assert.ok(result.reasons.includes("Sem comissão informada"));
  assert.equal(result.reasons.at(-1), "Score final: 45/100");
});

test("score é limitado a 100", () => {
  const result = calculateProductScore({
    name: "Curso",
    source: "kiwify",
    commissionPercent: 50,
    type: "digital",
    revenueDomain: "affiliate",
    priceCents: 19700,
    evidence: [
      { source: "a", capturedAt: "2026-11-18T00:00:00Z" },
      { source: "b", capturedAt: "2026-11-18T00:00:00Z" },
    ],
  });
  assert.equal(result.score, 100);
});

test("venda própria usa o vocabulário do banco (owned_sales)", () => {
  const owned = calculateProductScore({ name: "P", source: "manual", revenueDomain: "owned_sales" });
  const media = calculateProductScore({ name: "P", source: "manual", revenueDomain: "paid_media" });
  assert.equal(owned.score, 53);
  assert.equal(media.score, 45);
});
