import { test } from "node:test";
import assert from "node:assert/strict";
import {
  draftFromStep,
  FAILURE_REASON,
  failureReason,
  formatUsd,
  parseOutcome,
  prettyPayload,
  stepDetailText,
  summarizePayload,
  usageTotals,
} from "../../src/lib/agents/detail.ts";
import { EXECUTOR_ERROR_CODES } from "../../src/lib/agents/executor/types.ts";

const UUID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

test("todo código de erro do executor tem motivo legível", () => {
  for (const code of EXECUTOR_ERROR_CODES) assert.ok(FAILURE_REASON[code], `sem motivo para ${code}`);
  for (const code of ["step_limit", "kill_switch", "run_owner_not_allowed", "worker_timeout"]) assert.ok(FAILURE_REASON[code]);
});

test("motivo de falha: conhecido, desconhecido e vazio", () => {
  assert.match(failureReason("evidence_missing") ?? "", /evidência verificada/);
  assert.equal(failureReason("novo_codigo"), "Falha registrada pelo executor (novo_codigo).");
  // Texto fora do formato de código não é ecoado na tela.
  assert.equal(failureReason("<script>alert(1)</script>"), "Falha registrada pelo executor.");
  assert.equal(failureReason(null), null);
  assert.equal(failureReason(""), null);
});

test("detail de passo: código vira motivo, texto livre fica como está", () => {
  assert.equal(stepDetailText("tool_error"), FAILURE_REASON.tool_error);
  assert.equal(stepDetailText("Afirmação sem evidência do produto X"), "Afirmação sem evidência do produto X");
  assert.equal(stepDetailText("   "), null);
  assert.equal(stepDetailText(null), null);
});

test("resumo de payload: vazio, objeto, lista e profundidade", () => {
  assert.equal(summarizePayload({}), "—");
  assert.equal(summarizePayload(null), "—");
  assert.equal(summarizePayload([]), "—");
  assert.equal(summarizePayload({ limit: 5, status: "active" }), 'limit: 5 · status: "active"');
  assert.equal(summarizePayload({ products: [{ id: 1 }, { id: 2 }] }), "products: 2 itens: [{1 campo}, {1 campo}]");
  assert.equal(summarizePayload({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 }), "a: 1 · b: 2 · c: 3 · d: 4 · +2 campos");
  const many = summarizePayload({ items: Array.from({ length: 10 }, (_, i) => i) });
  assert.equal(many, "items: 10 itens: [0, 1, 2, 3, +6]");
});

test("resumo de payload corta texto longo e nunca passa do limite", () => {
  const out = summarizePayload({ text: "x".repeat(500) }, 60);
  assert.ok(out.length <= 60);
  assert.ok(out.endsWith("…"));
  const nested = summarizePayload({ a: { b: { c: { d: 1 } } } });
  assert.equal(nested, "a: {b: {1 campo}}");
});

test("JSON completo é cortado em 8 KB", () => {
  assert.deepEqual(prettyPayload({ a: 1 }), { text: '{\n  "a": 1\n}', truncated: false });
  const big = prettyPayload({ text: "y".repeat(20_000) });
  assert.equal(big.truncated, true);
  assert.ok(big.text.length <= 8002);
});

test("consumo soma tokens e custo sem erro de ponto flutuante e aceita numeric como texto", () => {
  const totals = usageTotals([
    { phase: "plan", model: "anthropic/claude-haiku-5.5", input_tokens: 1200, output_tokens: 300, cost_usd: 0.1, created_at: "" },
    { phase: "verify", model: "anthropic/claude-haiku-5.5", input_tokens: 800, output_tokens: 200, cost_usd: "0.2", created_at: "" },
    { phase: "verify", model: "anthropic/claude-haiku-5.5", input_tokens: 0, output_tokens: 0, cost_usd: "ilegível", created_at: "" },
  ]);
  assert.deepEqual(totals, { calls: 3, inputTokens: 2000, outputTokens: 500, costUsd: 0.3, models: ["anthropic/claude-haiku-5.5"] });
  assert.deepEqual(usageTotals([]), { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, models: [] });
});

test("custo pequeno não vira $0.00", () => {
  assert.equal(formatUsd(0), "$0.00");
  assert.equal(formatUsd(0.00042), "$0.00042");
  assert.equal(formatUsd("0.0123"), "$0.0123");
  assert.equal(formatUsd(3.5), "$3.50");
});

test("rascunho só aparece para draft_content ok com status draft", () => {
  const output = { content_id: UUID, content_version: 1, content_status: "draft" };
  assert.deepEqual(draftFromStep({ tool: "draft_content", status: "ok", output }), { contentId: UUID, version: 1 });
  assert.equal(draftFromStep({ tool: "draft_content", status: "ok", output: { ...output, content_status: "approved" } }), null);
  assert.equal(draftFromStep({ tool: "draft_content", status: "error", output }), null);
  assert.equal(draftFromStep({ tool: "read_content", status: "ok", output }), null);
  assert.equal(draftFromStep({ tool: "draft_content", status: "ok", output: { ...output, content_id: "x" } }), null);
  assert.equal(draftFromStep({ tool: "draft_content", status: "ok", output: [] }), null);
});

test("resultado final: formato do agent_finish_run", () => {
  const parsed = parseOutcome({
    summary: "Dois produtos com evidência.",
    claims: [
      { text: "Preço confirmado", productId: UUID, evidenceIds: ["e1", 2] },
      { text: "Genérico" },
      { nope: true },
    ],
    steps: 4,
  });
  assert.deepEqual(parsed, {
    summary: "Dois produtos com evidência.",
    claims: [
      { text: "Preço confirmado", productId: UUID, evidenceIds: ["e1"] },
      { text: "Genérico", productId: null, evidenceIds: [] },
    ],
  });
  assert.equal(parseOutcome(null), null);
  assert.equal(parseOutcome({ claims: [] }), null);
});
