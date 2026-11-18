import { test } from "node:test";
import assert from "node:assert/strict";
import { AGENT_TOOLS, isActive, isAgentKind, isAgentTool, parseLimits, parseRunInput } from "../../src/lib/agents/types.ts";

test("allowlist não tem ferramenta de publicação nem de aprovação", () => {
  assert.equal(AGENT_TOOLS.length, 6);
  assert.ok(AGENT_TOOLS.every((tool) => !/publish|approve/.test(tool)));
  assert.equal(isAgentTool("publish_content"), false);
  assert.ok(isAgentTool("draft_content"));
});

test("agentes aceitos espelham o banco", () => {
  assert.ok(isAgentKind("operations_review"));
  assert.equal(isAgentKind("publisher"), false);
});

test("formulário de execução valida agente, objetivo e passos", () => {
  assert.deepEqual(parseRunInput("product_research", "  Pesquisar  ", "5", 12), { agent: "product_research", goal: "Pesquisar", maxSteps: 5 });
  assert.throws(() => parseRunInput("x", "Pesquisar", "5", 12), /agente/);
  assert.throws(() => parseRunInput("product_research", "ab", "5", 12), /objetivo/);
  assert.throws(() => parseRunInput("product_research", "Pesquisar", "13", 12), /3 a 12/);
  assert.throws(() => parseRunInput("product_research", "Pesquisar", "2", 12), /3 a 12/);
  assert.throws(() => parseRunInput("product_research", "Pesquisar", "4.5", 12), /3 a 12/);
});

test("limites seguem as faixas do banco", () => {
  assert.deepEqual(parseLimits("20", "12"), { maxRunsPerDay: 20, maxStepsPerRun: 12 });
  assert.throws(() => parseLimits("0", "12"), /1 a 500/);
  assert.throws(() => parseLimits("20", "51"), /3 a 50/);
});

test("estados ativos", () => {
  assert.ok(isActive("queued"));
  assert.ok(isActive("verifying"));
  assert.equal(isActive("killed"), false);
  assert.equal(isActive("succeeded"), false);
});
