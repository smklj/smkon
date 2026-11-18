import { expect, runId, snap, test, uploadLicensedMedia } from "./fixtures.mjs";

test("Mídia e licenças: upload privado, licença exige comprovação, revogação com motivo", async ({ page }) => {
  const { fileName, row } = await uploadLicensedMedia(page, `midia-${runId}`);
  await expect(row.getByRole("link", { name: "Abrir" })).toHaveAttribute("href", /\/storage\/v1\/object\/sign\/content-media\//);

  // Licença de terceiro sem link de comprovação é recusada.
  const form = row.getByRole("form", { name: `Licença de ${fileName}` });
  // O formulário continua aberto depois da primeira licença; só abre se estiver fechado.
  if (!(await form.isVisible())) await row.getByText("Registrar licença").click();
  await form.getByLabel("Tipo de licença").selectOption("creator_authorization");
  await form.getByLabel("Quem concede").fill("@criador_e2e");
  await form.getByRole("button", { name: "Salvar licença" }).click();
  await expect(form.getByRole("alert")).toContainText("comprovação");

  // Revogar a licença própria exige motivo e muda o estado.
  await row.getByRole("button", { name: "Revogar" }).click();
  await expect(row.locator(".feedback-error").filter({ hasText: "motivo da revogação" })).toBeVisible();
  await row.getByPlaceholder("Motivo para revogar").fill("Teste de revogação E2E");
  await row.getByRole("button", { name: "Revogar" }).click();
  await expect(row.getByText("Licença revogada", { exact: true })).toBeVisible();
  await expect(row).toContainText("revogada: Teste de revogação E2E");
  await snap(page, "60-midia-licencas");

  // Arquivar tira o arquivo da biblioteca.
  await row.getByRole("button", { name: `Arquivar ${fileName}` }).click();
  await expect(page.getByText(fileName, { exact: true })).toHaveCount(0);
});

test("Storage recusa formato fora da lista antes do upload", async ({ page }) => {
  await page.goto("/midia");
  await page.getByLabel("Arquivo de mídia").setInputFiles({ name: "contrato.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF") });
  await page.getByRole("button", { name: "Enviar arquivo" }).click();
  await expect(page.locator(".feedback-error")).toContainText("Formato não aceito");
});
