import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readinessChecks, readinessSummary } from "../../src/lib/readiness/checks.ts";

const KEY = randomBytes(32).toString("base64");
const byId = (env: Record<string, string>) => Object.fromEntries(readinessChecks(env).map((check) => [check.id, check]));

const BASE = {
  NEXT_PUBLIC_SUPABASE_URL: "https://hpplboyysmfcjsnjrdmw.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_teste",
  NEXT_PUBLIC_SITE_URL: "https://smkon.vercel.app",
};

test("produção como hoje: núcleo pronto, integrações dependem da chave de servidor", () => {
  const checks = byId({
    ...BASE,
    AGENT_EXECUTOR_ENABLED: "true",
    AGENT_MODEL_PROVIDER: "vercel-ai-gateway",
    AGENT_MODEL: "anthropic/claude-haiku-5.5",
    AGENT_MODEL_AUTH: "oidc",
    AGENT_MONTHLY_BUDGET_USD: "5",
    CRON_SECRET: "x".repeat(40),
  });
  assert.equal(checks.core.status, "ready");
  assert.equal(checks["site-url"].status, "ready");
  assert.equal(checks.service.status, "action");
  assert.deepEqual(checks.service.missing, ["SUPABASE_SECRET_KEY"]);
  assert.deepEqual(checks.metricool.missing, ["SUPABASE_SECRET_KEY", "INTEGRATION_TOKEN_ENCRYPTION_KEY"]);
  assert.deepEqual(checks["mercado-livre"].missing, [
    "SUPABASE_SECRET_KEY",
    "MERCADO_LIVRE_CLIENT_ID",
    "MERCADO_LIVRE_CLIENT_SECRET",
    "MERCADO_LIVRE_REDIRECT_URI",
    "MERCADO_LIVRE_TOKEN_ENCRYPTION_KEY",
  ]);
  assert.deepEqual(checks.agents.missing, ["SUPABASE_SECRET_KEY"], "OIDC conta como credencial; só a chave de servidor falta");
  assert.equal(checks.kiwify.status, "off");
});

test("tudo configurado fica pronto", () => {
  const checks = readinessChecks({
    ...BASE,
    SUPABASE_SECRET_KEY: "sb_secret_teste",
    INTEGRATION_TOKEN_ENCRYPTION_KEY: KEY,
    INTEGRATION_TOKEN_ENCRYPTION_KEY_ID: "k2026",
    MERCADO_LIVRE_CLIENT_ID: "123",
    MERCADO_LIVRE_CLIENT_SECRET: "segredo",
    MERCADO_LIVRE_REDIRECT_URI: "https://smkon.vercel.app/api/integrations/mercado-livre/oauth/callback",
    MERCADO_LIVRE_TOKEN_ENCRYPTION_KEY: KEY,
    AGENT_MODEL: "google/gemini-3.8-flash",
    AGENT_MONTHLY_BUDGET_USD: "5",
    GEMINI_API_KEY: "g".repeat(39),
  });
  const summary = readinessSummary(checks);
  assert.equal(summary.pending, 0);
  assert.ok(checks.every((check) => check.status === "ready" || check.status === "off"));
});

test("chave de cifragem com formato errado aparece como inválida, sem vazar o valor", () => {
  const checks = byId({ ...BASE, SUPABASE_SECRET_KEY: "sb_secret_teste", INTEGRATION_TOKEN_ENCRYPTION_KEY: "curta-demais" });
  assert.equal(checks.metricool.status, "invalid");
  assert.deepEqual(checks.metricool.invalid, ["INTEGRATION_TOKEN_ENCRYPTION_KEY"]);
  const serialized = JSON.stringify(readinessChecks({ ...BASE, SUPABASE_SECRET_KEY: "sb_secret_teste", INTEGRATION_TOKEN_ENCRYPTION_KEY: KEY }));
  assert.ok(!serialized.includes(KEY), "nenhum valor de variável sai no resultado");
  assert.ok(!serialized.includes("sb_secret_teste"));
});

test("agentes: desligado por flag; ligado sem modelo aponta o que falta", () => {
  assert.equal(byId(BASE).agents.status, "off");
  const on = byId({ ...BASE, AGENT_EXECUTOR_ENABLED: "true", CRON_SECRET: "curto" });
  assert.equal(on.agents.status, "invalid");
  assert.deepEqual(on.agents.invalid, ["CRON_SECRET"]);
  assert.deepEqual(on.agents.missing, ["SUPABASE_SECRET_KEY", "AGENT_MONTHLY_BUDGET_USD", "AGENT_MODEL_PROVIDER"]);
});

test("núcleo sem Supabase configurado não fica pronto; resumo ignora recursos desligados", () => {
  const checks = readinessChecks({});
  const core = checks.find((check) => check.id === "core");
  assert.equal(core?.status, "action");
  const summary = readinessSummary(checks);
  assert.equal(summary.total, checks.filter((check) => check.status !== "off").length);
});

test("agentes: mostra o modelo e recusa modelo sem preço cadastrado", () => {
  const env = {
    ...BASE,
    SUPABASE_SECRET_KEY: "sb_secret_teste",
    AGENT_EXECUTOR_ENABLED: "true",
    AGENT_MODEL_PROVIDER: "vercel-ai-gateway",
    AGENT_MODEL_AUTH: "oidc",
    AGENT_MONTHLY_BUDGET_USD: "5",
    CRON_SECRET: "x".repeat(40),
  };
  const gemini = byId({ ...env, AGENT_MODEL: "google/gemini-3.8-flash" }).agents;
  assert.equal(gemini.status, "ready");
  assert.match(gemini.hint ?? "", /Modelo: google\/gemini-3\.8-flash\./);
  const unpriced = byId({ ...env, AGENT_MODEL: "google/gemini-9-qualquer" }).agents;
  assert.equal(unpriced.status, "invalid");
  assert.deepEqual(unpriced.invalid, ["AGENT_MODEL"]);
  assert.match(unpriced.hint ?? "", /sem preço cadastrado/);
});

test("IA nos módulos: Gemini direto com GEMINI_API_KEY; sem chave do Google aponta o que falta", () => {
  const base = { ...BASE, AGENT_MODEL: "google/gemini-3.8-flash", AGENT_MONTHLY_BUDGET_USD: "5" };
  const direct = byId({ ...base, GEMINI_API_KEY: "g".repeat(39) })["ai-assist"];
  assert.equal(direct.status, "ready");
  assert.match(direct.hint ?? "", /direto na conta Google/);
  const none = byId(base)["ai-assist"];
  assert.equal(none.status, "action");
  assert.deepEqual(none.missing, ["GEMINI_API_KEY"]);
  const gateway = byId({ ...base, AGENT_MODEL_AUTH: "oidc" })["ai-assist"];
  assert.equal(gateway.status, "ready");
  assert.match(gateway.hint ?? "", /créditos do AI Gateway/);
  const bad = byId({ ...base, GEMINI_API_KEY: "curta" })["ai-assist"];
  assert.equal(bad.status, "invalid");
  assert.ok(!JSON.stringify(byId({ ...base, GEMINI_API_KEY: "g".repeat(39) })).includes("g".repeat(39)), "nunca expõe a chave");
});
