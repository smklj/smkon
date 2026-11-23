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

test("Content Studio: editor de camadas move, edita texto, respeita a trava da marca, muda formato, exporta e salva", async ({ page }) => {
  const title = `E2E Camadas ${runId}`;
  await page.goto("/studio");
  await page.getByRole("button", { name: "Novo conteúdo" }).click();
  await page.getByLabel("Título interno *").fill(title);
  await page.getByLabel("Legenda").fill("Legenda do teste do editor");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Rascunho salvo" })).toBeVisible();

  await page.getByRole("button", { name: "Editar em camadas" }).click();
  const editor = page.getByRole("region", { name: "Editor de camadas" });
  await expect(editor).toBeVisible();
  const canvas = editor.getByTestId("scene-canvas");
  const layers = editor.getByRole("region", { name: "Camadas" });
  const props = editor.getByRole("region", { name: "Propriedades" });

  // Texto direto na tela: duplo clique no título.
  const headline = canvas.locator('[data-layer="headline"]');
  await headline.click();
  await headline.dblclick();
  const inline = editor.getByLabel("Texto da camada");
  await inline.fill("TITULO DO TESTE E2E");
  await inline.press("Enter");
  await expect(canvas).toContainText("TITULO DO TESTE E2E");

  // Arrastar move a camada; Ctrl+Z desfaz o arrasto inteiro de uma vez.
  const xField = props.getByLabel("X", { exact: true });
  const x0 = Number(await xField.inputValue());
  const boxBefore = await headline.boundingBox();
  if (!boxBefore) throw new Error("título sem caixa na tela");
  await page.mouse.move(boxBefore.x + 20, boxBefore.y + boxBefore.height / 2);
  await page.mouse.down();
  await page.mouse.move(boxBefore.x + 60, boxBefore.y + boxBefore.height / 2 + 30, { steps: 6 });
  await page.mouse.up();
  await expect(xField).not.toHaveValue(String(x0));
  expect(Number(await xField.inputValue())).toBeGreaterThan(x0);
  await page.keyboard.press("Control+z");
  await expect(xField).toHaveValue(String(x0));

  // Camada da marca: travada até alguém com permissão destravar; Delete é recusado.
  await layers.getByRole("button", { name: /^Selecionar Logo SMKON/ }).click();
  await expect(props).toContainText("Camada da marca, travada");
  await page.keyboard.press("Delete");
  await expect(editor.getByRole("alert")).toContainText("é da marca e está travada");
  await expect(canvas.locator('[data-layer="logo"]')).toHaveCount(1);

  // Forma nova + alça de redimensionar.
  await editor.getByRole("button", { name: "+ Forma" }).click();
  const width = props.getByLabel("Largura");
  const w0 = Number(await width.inputValue());
  const handle = editor.getByTestId("scene-resize-handle");
  const hb = await handle.boundingBox();
  if (!hb) throw new Error("alça sem caixa");
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + 60, hb.y + 20, { steps: 6 });
  await page.mouse.up();
  expect(Number(await width.inputValue())).toBeGreaterThan(w0);
  await expect(layers.getByRole("button", { name: /^Selecionar Forma/ })).toBeVisible();

  // Formato 9:16 (design já editado à mão: adaptação automática) e exportação PNG.
  await editor.getByLabel("Formato").selectOption("9:16");
  await expect(editor.locator(".scene-save-ok")).toContainText("Formato 9:16");
  const download = page.waitForEvent("download");
  await editor.getByRole("button", { name: "PNG", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("smkon-capa-9x16.png");
  await snap(page, "23-studio-editor-camadas");

  await editor.getByRole("button", { name: "Salvar na peça" }).click();
  await expect(editor.locator(".scene-save-ok")).toContainText(/Design salvo na peça \(versão 2\)/);

  // Reabrir: o design editado à mão volta para o editor, não para o formulário.
  await page.reload();
  await page.locator(".studio-draft", { hasText: title }).first().click();
  await page.getByRole("button", { name: "Abrir no editor de camadas" }).click();
  await expect(page.getByTestId("scene-canvas")).toContainText("TITULO DO TESTE E2E");
  await expect(page.getByLabel("Formato")).toHaveValue("9:16");

  await page.getByRole("button", { name: "Fechar editor" }).click();
  await page.getByRole("button", { name: "Arquivar" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Conteúdo arquivado." })).toBeVisible();
});
