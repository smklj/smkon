import { appOrigin, bypassHeaders, expect, test } from "./fixtures.mjs";

/**
 * S6.1 — CSP com nonce por requisição. Cada página deve:
 * - responder com script-src com nonce, sem 'unsafe-inline';
 * - marcar todos os <script> e <style> com o nonce da própria resposta;
 * - carregar e hidratar sem nenhuma violação de CSP no console.
 */
const PAGES = ["/", "/produtos", "/studio", "/agentes", "/financeiro", "/calendario", "/midia", "/admin", "/conta/senha"];

/**
 * A barra de comentários da Vercel (só em Previews, nunca em produção) injeta <style> sem o nosso
 * nonce e é bloqueada pela CSP; ela também mantém a rede ocupada. O header oficial
 * `x-vercel-skip-toolbar` a desliga só nas requisições à própria aplicação. A falha anterior
 * (run 44527391146) mostrou que todas as violações vinham de vercel.live/_next-live/feedback.
 */
async function skipVercelToolbar(context) {
  await context.route(`${appOrigin}/**`, (route) =>
    route.fallback({ headers: { ...route.request().headers(), "x-vercel-skip-toolbar": "1" } }),
  );
}

function nonceFrom(csp) {
  return /'nonce-([^']+)'/.exec(csp ?? "")?.[1];
}

for (const path of PAGES) {
  test(`CSP com nonce sem violações em ${path}`, async ({ page }) => {
    await skipVercelToolbar(page.context());
    const violations = [];
    page.on("console", (message) => {
      if (/content security policy|refused to (load|execute|apply)/i.test(message.text())) {
        violations.push(`${message.text()} @ ${message.location().url}`);
      }
    });
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (event) => {
        console.error(`Content Security Policy violation: ${event.violatedDirective} ${event.blockedURI}`);
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
    const tags = await page.$$eval("script, style", (nodes) =>
      nodes.map((node) => ({ tag: node.tagName, nonce: node.nonce, src: node.getAttribute("src") ?? "" })),
    );
    const withoutNonce = tags.filter((tag) => tag.nonce !== nonce && !tag.src.startsWith("https://vercel.live"));
    expect(withoutNonce, JSON.stringify(withoutNonce)).toEqual([]);
    expect(violations, violations.join("\n")).toEqual([]);
  });
}

test("nonce muda a cada requisição", async ({ request }) => {
  const first = nonceFrom((await request.get("/login")).headers()["content-security-policy"]);
  const second = nonceFrom((await request.get("/login")).headers()["content-security-policy"]);
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
