import { expect, runId, snap, test } from "./fixtures.mjs";

test("Content Studio: rascunho, aprovação da versão exata e exclusão bloqueada após aprovação", async ({ page }) => {
  const title = `E2E Conteúdo ${runId}`;
  await page.goto("/studio");
  await page.getByRole("button", { name: "Novo conteúdo" }).click();
  await page.getByLabel("Título interno *").fill(title);
  await page.getByLabel("Produto / oferta").fill("Produto E2E");
  await page.getByLabel("Roteiro / estrutura do vídeo").fill("HOOK\nDEMONSTRAÇÃO\nFECHAMENTO");
  await page.getByLabel("Legenda").fill("Legenda de teste E2E");

  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Rascunho salvo" })).toBeVisible();

  await page.getByRole("button", { name: /Aprovar esta versão/ }).click();
  await expect(page.getByRole("status").filter({ hasText: /Versão \d+ aprovada\. Nenhuma publicação foi enviada\./ })).toBeVisible();
  await snap(page, "20-studio-aprovado");

  // Conteúdo aprovado não é apagado: o banco exige arquivar.
  await page.getByRole("button", { name: "Excluir esta peça" }).click();
  // Só a mensagem do SMKON: o anunciador de rotas do Next também tem role="alert".
  await expect(page.locator(".feedback-error")).toContainText("Arquive");
  await page.getByRole("button", { name: "Arquivar" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Conteúdo arquivado." })).toBeVisible();
});
