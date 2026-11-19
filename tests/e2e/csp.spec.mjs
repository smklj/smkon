import { appOrigin, bypassHeaders, expect, test } from "./fixtures.mjs";

/**
 * S6.1 — CSP com nonce por requisição. Cada página deve:
 * - responder com script-src com nonce, sem 'unsafe-inline';
 * - marcar todos os <script> e <style> com o nonce da própria resposta;
 * - carregar e hidratar sem nenhuma violação de CSP no console.
 */
const PAGES = ["/", "/produtos", "/studio", "/agentes", "/financeiro", "/calendario", "/midia", "/admin", "/conta/senha"];

/**
 * A barra de comentários da Vercel existe só em Previews (nunca em produção). Seu script
 * (vercel.live/_next-live/feedback) injeta <style> sem o nosso nonce e é bloqueado pela CSP; o
 * header x-vercel-skip-toolbar não a desligou (run 44531870185). Essas violações são registradas
 * como anotação do teste; qualquer violação com outra origem reprova.
 */
const TOOLBAR_ORIGIN = "https://vercel.live";

function nonceFrom(csp) {
  return /'nonce-([^']+)'/.exec(csp ?? "")?.[1];
}

for (const path of PAGES) {
  test(`CSP com nonce sem violações em ${path}`, async ({ page }) => {
    const violations = [];
    const toolbarViolations = [];
    page.on("console", (message) => {
      if (!/content security policy/i.test(message.text())) return;
      const text = `${message.text()} @ ${message.location().url}`;
      (text.includes(TOOLBAR_ORIGIN) ? toolbarViolations : violations).push(text);
    });
    // Captura também violações sem mensagem própria no console; a origem vem em sourceFile.
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (event) => {
        console.error(
          `Content Security Policy violation: ${event.violatedDirective} blocked=${event.blockedURI} source=${event.sourceFile}`,
        );
      });
    });

    const response = await page.goto(path);
    expect(response?.ok()).toBeTruthy();
    const csp = response?.headers()["content-security-policy"] ?? "";
    const scriptSrc = /script-src ([^;]+)/.exec(csp)?.[1] ?? "";
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    const nonce = nonceFrom(csp);
    expect(nonce).toBeTruthy();
    expect(scriptSrc).toContain(`'nonce-${nonce}'`);

    // Sem "networkidle": conexões de longa duração de terceiros não devem travar o teste.
    await page.waitForLoadState("load");
    await page.waitForFunction(() => typeof window.next === "object");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Scripts inline precisam do nonce da resposta; scripts externos só da própria origem
    // (chunks carregados depois pelo runtime do Next não recebem nonce e são liberados por 'self').
    const scripts = await page.$$eval("script", (nodes) =>
      nodes.map((node) => ({ nonce: node.nonce, src: node.src })),
    );
    const origin = new URL(page.url()).origin;
    const badInline = scripts.filter((script) => !script.src && script.nonce !== nonce);
    const badExternal = scripts.filter(
      (script) => script.src && !script.src.startsWith(`${origin}/`) && !script.src.startsWith(`${TOOLBAR_ORIGIN}/`),
    );
    expect(badInline, JSON.stringify(badInline)).toEqual([]);
    expect(badExternal, JSON.stringify(badExternal)).toEqual([]);
    const styles = await page.$$eval("style", (nodes) => nodes.map((node) => node.nonce));
    // <style> sem nonce só pode ter vindo da barra da Vercel (e foi bloqueado pela CSP).
    if (toolbarViolations.length === 0) expect(styles.filter((value) => value !== nonce)).toEqual([]);
    if (toolbarViolations.length > 0) {
      test.info().annotations.push({ type: "vercel-toolbar", description: `${toolbarViolations.length} violações da barra da Vercel (só Preview)` });
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });
}

test("nonce muda a cada requisição", async ({ request }) => {
  const first = nonceFrom((await request.get("/login", { headers: bypassHeaders })).headers()["content-security-policy"]);
  const second = nonceFrom((await request.get("/login", { headers: bypassHeaders })).headers()["content-security-policy"]);
  expect(first).toBeTruthy();
  expect(first).not.toBe(second);
});

test("rota de máquina do worker não exige sessão", async ({ playwright }) => {
  const api = await playwright.request.newContext({
    baseURL: appOrigin,
    extraHTTPHeaders: bypassHeaders,
    storageState: { cookies: [], origins: [] },
  });
  const response = await api.get("/api/agents/worker");
  // A rota decide sozinha (desligada → 503; segredo errado → 401 com no-store, emitido pelo handler).
  // O 401 de sessão do proxy não tem no-store: se aparecer, o proxy voltou a exigir sessão.
  expect([200, 401, 503]).toContain(response.status());
  if (response.status() === 401) expect(response.headers()["cache-control"] ?? "").toContain("no-store");
  expect(response.headers()["content-security-policy"] ?? "").toContain("'nonce-");
  await api.dispose();
});
