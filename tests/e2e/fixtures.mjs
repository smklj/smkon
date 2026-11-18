import { test as base, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseURL = process.env.E2E_BASE_URL ?? "";
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "";
export const appOrigin = baseURL ? new URL(baseURL).origin : "";
export const bypassHeaders = bypass ? { "x-vercel-protection-bypass": bypass } : {};

/** Supabase de produção: os testes nunca podem rodar contra ele. */
const PRODUCTION_SUPABASE_REF = "hpplboyysmfcjsnjrdmw";
const PRODUCTION_HOSTS = new Set(["smkon-smkon.vercel.app"]);

/** Adiciona o header de bypass só para a origem da aplicação, nunca para terceiros (ex.: Supabase). */
export async function addBypass(context) {
  if (!bypass || !appOrigin) return;
  await context.route(`${appOrigin}/**`, (route) =>
    route.continue({ headers: { ...route.request().headers(), ...bypassHeaders } }),
  );
}

/**
 * Trava de isolamento: lê a CSP do deployment e confirma que ele usa o Supabase de staging.
 * Se apontar para produção, ou se não for possível confirmar, para antes de qualquer escrita.
 */
export async function assertStagingTarget(request) {
  const expectedRef = process.env.E2E_SUPABASE_REF;
  if (!expectedRef) throw new Error("E2E_SUPABASE_REF é obrigatório (ref do Supabase de staging).");
  if (expectedRef === PRODUCTION_SUPABASE_REF) throw new Error("E2E_SUPABASE_REF aponta para produção.");
  if (PRODUCTION_HOSTS.has(new URL(baseURL).hostname)) throw new Error("E2E_BASE_URL aponta para produção.");

  const response = await request.get("/login", { headers: bypassHeaders, maxRedirects: 0 });
  if (response.status() === 401 || response.status() === 403) {
    throw new Error(`Deployment protegido respondeu ${response.status()}: confira VERCEL_AUTOMATION_BYPASS_SECRET.`);
  }
  const csp = response.headers()["content-security-policy"] ?? "";
  if (!csp.includes(`${expectedRef}.supabase.co`)) {
    throw new Error("O deployment não aponta para o Supabase de staging esperado. Testes abortados.");
  }
  if (csp.includes(PRODUCTION_SUPABASE_REF)) {
    throw new Error("O deployment referencia o Supabase de produção. Testes abortados.");
  }
}

export async function snap(page, name) {
  const dir = path.join("test-results", "screenshots");
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
}

/** Identificador único por execução, para não colidir com dados de execuções anteriores no staging. */
export const runId = `${process.env.GITHUB_RUN_ID ?? "local"}-${Date.now().toString(36)}`;

export const test = base.extend({
  // O callback do fixture não se chama "use" para não ser confundido com um React Hook pelo lint.
  context: async ({ context }, provide) => {
    await addBypass(context);
    await provide(context);
  },
  page: async ({ page }, provide) => {
    // Confirmações nativas (window.confirm) são aceitas explicitamente.
    page.on("dialog", (dialog) => dialog.accept());
    await provide(page);
  },
});

export { expect };
