import { expect, runId, snap, test } from "./fixtures.mjs";

test("Convites: criar, link exibido uma única vez e revogar", async ({ page }) => {
  const email = `e2e-${runId}@example.com`.toLowerCase();
  await page.goto("/admin");
  await page.getByLabel("E-mail do convidado").fill(email);
  await page.getByLabel("Papel").selectOption("viewer");
  await page.getByRole("button", { name: "Convidar" }).click();
  await expect(page.getByRole("status")).toContainText("Convite criado");
  await expect(page.getByLabel("Link do convite")).toHaveValue(/\/convite\?token=/);

  const row = page.getByRole("listitem").filter({ hasText: email });
  await expect(row.getByText("Pendente", { exact: true })).toBeVisible();
  await row.getByRole("button", { name: "Revogar" }).click();
  await expect(page.getByRole("status")).toContainText("Convite revogado");
  await expect(row.getByText("Revogado", { exact: true })).toBeVisible();
  // Depois de recarregar, o link não aparece de novo.
  await page.reload();
  await expect(page.getByLabel("Link do convite")).toHaveCount(0);
  await snap(page, "30-admin-convites");
});

test("Financeiro: estados das comissões separados e sem valores inventados", async ({ page }) => {
  await page.goto("/financeiro");
  await expect(page.getByRole("heading", { name: "Comissões de afiliado" })).toBeVisible();
  await expect(page.getByText("Nenhuma comissão registrada")).toBeVisible();
  await snap(page, "40-financeiro");
});

test("Membros: lista do workspace com o próprio usuário", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Membros", exact: true })).toBeVisible();
  // A migration S5.1 (20261119070000_workspace_members) já está aplicada no staging:
  // o aviso de migration ausente não é mais aceito.
  await expect(page.getByText("20261119070000_workspace_members")).toHaveCount(0);
  const list = page.getByRole("list", { name: "Membros do workspace" });
  await expect(list).toBeVisible();
  // O próprio usuário aparece na lista.
  await expect(list.getByText("· você").first()).toBeVisible();
  await snap(page, "31-admin-membros");
});

test("Prontidão para uso: lista o que falta sem expor valores", async ({ page }) => {
  await page.goto("/admin");
  const panel = page.locator("#prontidao");
  await expect(panel.getByRole("heading", { name: "Prontidão para uso" })).toBeVisible();
  const core = panel.getByRole("listitem").filter({ hasText: "Núcleo do app" });
  await expect(core.getByText("Pronto", { exact: true })).toBeVisible();
  // Só nomes de variáveis aparecem; nenhum valor de chave do Supabase.
  await expect(panel).not.toContainText("sb_publishable_");
  await expect(panel).not.toContainText("sb_secret_");
  await snap(page, "32-admin-prontidao");
});
