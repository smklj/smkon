import { mkdir } from "node:fs/promises";
import path from "node:path";
import { AUTH_FILE } from "../../playwright.config.mjs";
import { assertStagingTarget, expect, snap, test } from "./fixtures.mjs";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test("staging isolado, login da conta QA e bootstrap do workspace", async ({ page, request }) => {
  if (!email || !password) throw new Error("E2E_EMAIL e E2E_PASSWORD são obrigatórios.");
  await assertStagingTarget(request);

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Acesse sua operação." })).toBeVisible();

  // Senha errada mostra erro genérico, sem revelar se o e-mail existe.
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("senha-incorreta-e2e");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("E-mail ou senha inválidos.")).toBeVisible();

  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByRole("heading", { name: "Operação SMKON" })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
  await snap(page, "00-overview");

  await mkdir(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
});
