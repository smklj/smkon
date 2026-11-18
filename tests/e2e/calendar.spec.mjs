import { expect, runId, snap, test, uploadLicensedMedia } from "./fixtures.mjs";

test("Calendário: agendar versão aprovada, dry-run, edição reprova, cancelar com motivo", async ({ page }) => {
  const title = `E2E Agenda ${runId}`;
  const { fileName } = await uploadLicensedMedia(page, `agenda-${runId}`);

  // Conteúdo aprovado no Studio, com a mídia licenciada.
  await page.goto("/studio");
  await page.getByRole("button", { name: "Novo conteúdo" }).click();
  await page.getByLabel("Título interno *").fill(title);
  await page.getByLabel("Legenda").fill("Legenda para o calendário E2E #smkon");
  await page.getByLabel("Mídia da peça").selectOption({ label: `${fileName} · Licenciada` });
  await page.getByRole("button", { name: /Aprovar esta versão/ }).click();
  await expect(page.getByRole("status").filter({ hasText: /Versão \d+ aprovada\. Nenhuma publicação foi enviada\./ })).toBeVisible();

  // Agendar no Instagram.
  await page.getByRole("link", { name: "Calendário" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Calendário editorial" })).toBeVisible();
  const form = page.getByRole("region", { name: "Agendar publicação" });
  await form.getByLabel("Conteúdo aprovado").selectOption({ label: `${title} · v1` });
  await form.getByLabel("Canal").selectOption("Instagram");
  await form.getByRole("button", { name: "Agendar (dry-run)" }).click();
  await expect(form.getByRole("status")).toContainText("Nada será publicado");

  const row = page.getByRole("listitem").filter({ hasText: title }).filter({ hasText: "Instagram" });
  await expect(row.getByText("Agendado", { exact: true })).toBeVisible();

  // Dry-run aprovado, com o aviso de mídia.
  await row.getByRole("button", { name: `Rodar dry-run de ${title} em Instagram` }).click();
  await expect(row.getByText("Dry-run aprovado", { exact: true })).toBeVisible();
  await expect(row).toContainText("Versão 1 aprovada e inalterada.");
  await expect(row).toContainText(`Mídia anexada: ${fileName}.`);
  await expect(row).toContainText("Licença de Equipe SMKON E2E válida");
  await snap(page, "50-calendario-dry-run");

  // Editar a peça depois de agendar: o dry-run reprova.
  await page.goto("/studio");
  await page.getByRole("button", { name: new RegExp(title) }).first().click();
  await page.getByLabel("Legenda").fill("Legenda alterada depois do agendamento");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Rascunho salvo" })).toBeVisible();
  await page.goto("/calendario");
  await row.getByRole("button", { name: `Rodar dry-run de ${title} em Instagram` }).click();
  await expect(row.getByText("Dry-run reprovado", { exact: true })).toBeVisible();
  await expect(row).toContainText("O conteúdo mudou ou deixou de estar aprovado");

  // Cancelar exige motivo.
  await row.getByRole("button", { name: "Cancelar" }).click();
  await expect(row.locator(".feedback-error")).toContainText("motivo");
  await row.getByPlaceholder("Motivo para cancelar").fill("Peça editada, agendar de novo");
  await row.getByRole("button", { name: "Cancelar" }).click();
  await expect(row.getByText("Cancelado", { exact: true })).toBeVisible();
  await expect(row).toContainText("Motivo: Peça editada, agendar de novo");
  await snap(page, "51-calendario-cancelado");
});
