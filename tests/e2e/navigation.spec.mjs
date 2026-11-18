import { addBypass, appOrigin, bypassHeaders, expect, snap, test } from "./fixtures.mjs";

const MODULES = [
  { path: "/", heading: "Operação SMKON", name: "01-overview" },
  { path: "/produtos", heading: "Inteligência de produtos", name: "02-produtos" },
  { path: "/studio", heading: "Content Studio", name: "03-studio" },
  { path: "/financeiro", heading: "Financeiro", name: "05-financeiro" },
  { path: "/admin", heading: "Administração", name: "08-admin" },
];

for (const target of MODULES) {
  test(`módulo ${target.path} carrega sem erro`, async ({ page }) => {
    await page.goto(target.path);
    await expect(page.getByRole("heading", { level: 1, name: target.heading })).toBeVisible();
    // Só mensagens de erro do SMKON (o anunciador de rotas do Next também usa role="alert").
    await expect(page.locator(".feedback-error")).toHaveCount(0);
    await snap(page, target.name);
  });
}

test("visitante sem sessão é levado ao login preservando o destino", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, baseURL: appOrigin });
  await addBypass(context);
  const page = await context.newPage();
  await page.goto("/produtos");
  await expect(page).toHaveURL(/\/login\?next=%2Fprodutos$/);
  await expect(page.getByRole("heading", { name: "Acesse sua operação." })).toBeVisible();
  await context.close();
});

test("API sem sessão responde 401 em JSON", async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: appOrigin, extraHTTPHeaders: bypassHeaders });
  const response = await api.get("/api/products");
  expect(response.status()).toBe(401);
  expect((await response.json()).error).toBeTruthy();
  await api.dispose();
});

test("headers de segurança presentes", async ({ request }) => {
  const response = await request.get("/login", { headers: bypassHeaders });
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["strict-transport-security"]).toContain("max-age=");
});
