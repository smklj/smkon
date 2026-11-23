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

test("Content Studio: revisão de conformidade aponta promessa de renda (sem salvar nada)", async ({ page }) => {
  await page.goto("/studio");
  await page.getByRole("button", { name: "Novo conteúdo" }).click();
  await page.getByLabel("Título interno *").fill(`E2E Conformidade ${runId}`);
  await page.getByLabel("Roteiro / estrutura do vídeo").fill("Com este curso você vai ter renda extra garantida todo mês.");
  await page.getByLabel("Legenda").fill("Garanta já o seu [preço]");
  await page.getByRole("button", { name: "Revisar conformidade" }).click();
  const review = page.locator(".ai-assist-review");
  await expect(review).toContainText("Promessa de renda");
  await expect(review).toContainText("Campo a preencher");
  await expect(review.locator(".ai-issue-bloqueio").first()).toBeVisible();
  await snap(page, "21-studio-conformidade");
});

test("Content Studio: design da capa salvo na peça cria versão nova, é aprovado e reabre", async ({ page }) => {
  const title = `E2E Design ${runId}`;
  await page.goto("/studio");
  await page.getByRole("button", { name: "Novo conteúdo" }).click();

  // Sem peça salva, não há onde gravar o design.
  await expect(page.locator(".scene-save-hint").first()).toContainText("Salve a peça");

  await page.getByLabel("Título interno *").fill(title);
  await page.getByLabel("Legenda").fill("Legenda do teste de design");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Rascunho salvo" })).toBeVisible();

  // Escolhe um preset diferente do padrão e grava a capa na peça.
  await page.getByRole("button", { name: "Achado Shopee R$ 79,90" }).click();
  await expect(page.locator(".banner-canvas-frame")).toContainText("ACHADO DA SHOPEE");
  await page.getByRole("button", { name: "Salvar capa na peça" }).click();
  await expect(page.locator(".scene-save-ok")).toContainText(/Design salvo na peça \(versão 2\)/);

  // A aprovação vale para a versão com o design.
  await page.getByRole("button", { name: /Aprovar esta versão/ }).click();
  await expect(page.getByRole("status").filter({ hasText: /Versão 2 aprovada\. Nenhuma publicação/ })).toBeVisible();
  await snap(page, "22-studio-design-salvo");

  // Reabrir a peça traz a capa salva, não o preset padrão.
  await page.reload();
  await page.locator(".studio-draft", { hasText: title }).first().click();
  await expect(page.locator(".banner-canvas-frame")).toContainText("ACHADO DA SHOPEE");

  // Aprovada não é apagada: arquiva para não acumular dados de teste.
  await page.getByRole("button", { name: "Arquivar" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Conteúdo arquivado." })).toBeVisible();
});
