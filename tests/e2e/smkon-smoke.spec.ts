import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test("login, workspace bootstrap and core module smoke test", async ({ page }) => {
  test.skip(!email || !password, "E2E_EMAIL and E2E_PASSWORD secrets are required.");

  await mkdir(path.join("test-results", "screenshots"), { recursive: true });
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Acesse sua operação." })).toBeVisible();

  await page.getByLabel("E-mail").fill(email!);
  await page.getByLabel("Senha").fill(password!);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Operação SMKON" })).toBeVisible();
  await expect(page.getByText("Seu workspace ainda não foi criado")).toHaveCount(0);
  await page.screenshot({ path: path.join("test-results", "screenshots", "01-overview.png"), fullPage: true });

  const routes = [
    { path: "/produtos", name: "produtos" },
    { path: "/studio", name: "content-studio" },
    { path: "/financeiro", name: "financeiro" },
    { path: "/admin", name: "admin" },
  ];

  for (const route of routes) {
    await page.goto(route.path);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.screenshot({
      path: path.join("test-results", "screenshots", `${route.name}.png`),
      fullPage: true,
    });
  }
});
