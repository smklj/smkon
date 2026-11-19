import { bypassHeaders, expect, runId, snap, test } from "./fixtures.mjs";

// Dados fictícios. O contato termina anonimizado: nenhum dado pessoal fica no staging.
test("Audiência: cadastro com prova de consentimento, revogação, exportação e exclusão", async ({ page }) => {
  const id = runId.replace(/[^a-z0-9-]/gi, "").toLowerCase();
  const email = `e2e-${id}@smkon.test`;
  const name = `Contato E2E ${id}`;

  await page.goto("/audiencia");
  await expect(page.getByRole("heading", { level: 1, name: "Audiência e CRM" })).toBeVisible();

  // Base consentimento sem evidência é recusada pelo navegador/servidor; com evidência, cadastra.
  const form = page.getByRole("form", { name: "Novo contato" });
  await form.getByLabel("Nome (opcional)").fill(name);
  await form.getByLabel("E-mail", { exact: true }).fill(email);
  await form.getByLabel(/Referência da evidência/).fill("Formulário E2E, caixa não pré-marcada");
  await form.getByRole("button", { name: "Cadastrar contato" }).click();

  await expect(page).toHaveURL(/\/audiencia\?contato=[0-9a-f-]{36}$/);
  const detail = page.getByRole("region", { name });
  await expect(detail).toContainText(email);
  await expect(detail).toContainText("Newsletter · E-mail: concedido");
  await expect(detail).toContainText("Consentiu");

  // Revogar tudo: o histórico guarda o opt-in e a revogação.
  await detail.getByRole("button", { name: "Revogar tudo" }).click();
  await expect(detail).toContainText("Newsletter · E-mail: revogado");
  await expect(detail.getByText("Revogou", { exact: true })).toBeVisible();
  await snap(page, "70-audiencia-contato");

  // Exportação JSON do titular (sem cache, nome de arquivo sem dado pessoal).
  const href = await detail.getByRole("link", { name: "Exportar dados (JSON)" }).getAttribute("href");
  const response = await page.request.get(href, { headers: bypassHeaders });
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["content-disposition"]).not.toContain(email);
  const exported = await response.json();
  expect(exported.format).toBe("smkon.contact_export.v1");
  expect(exported.contact.email).toBe(email);
  expect(exported.consent_events).toHaveLength(2);

  // Exclusão exige a palavra de confirmação; depois disso o contato fica anonimizado.
  await detail.locator("summary", { hasText: "Excluir dados pessoais" }).click();
  const anonymize = page.getByRole("form", { name: "Excluir dados pessoais do contato" });
  await anonymize.getByLabel("Motivo (sem dados pessoais)").fill("Limpeza do teste E2E");
  await anonymize.getByLabel(/Digite EXCLUIR/).fill("excluir");
  await anonymize.getByRole("button", { name: "Excluir dados pessoais" }).click();
  await expect(anonymize.getByRole("alert")).toContainText("Digite EXCLUIR");
  await anonymize.getByLabel(/Digite EXCLUIR/).fill("EXCLUIR");
  await anonymize.getByRole("button", { name: "Excluir dados pessoais" }).click();

  const anonymized = page.getByRole("region", { name: "Titular anonimizado" });
  await expect(anonymized).toBeVisible();
  await expect(anonymized).not.toContainText(email);
  await expect(anonymized).toContainText("Exclusão");
  await expect(page.getByText(email)).toHaveCount(0);
});
