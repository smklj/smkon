import { expect, runId, snap, test } from "./fixtures.mjs";

test("Agentes: limites, nova execução na fila, kill switch interrompe e bloqueia", async ({ page }) => {
  const goal = `E2E agentes ${runId}`;
  await page.goto("/agentes");
  await expect(page.getByRole("heading", { level: 1, name: "Agentes de IA" })).toBeVisible();
  await expect(page.locator(".feedback-error")).toHaveCount(0);

  const kill = page.getByRole("region", { name: "Kill switch" });
  // Sobra de execução anterior interrompida no meio: desliga antes de começar.
  if (await kill.getByRole("button", { name: "Desligar kill switch" }).isVisible()) {
    await kill.getByRole("button", { name: "Desligar kill switch" }).click();
    await expect(kill.getByRole("status")).toContainText("Kill switch desligado.");
  }

  // Limite alto para que execuções repetidas do E2E no mesmo dia não esbarrem no limite diário.
  const limits = page.getByRole("region", { name: "Limites" });
  await limits.getByLabel("Execuções por 24 h").fill("500");
  await limits.getByLabel("Passos por execução").fill("12");
  await limits.getByRole("button", { name: "Salvar limites" }).click();
  await expect(limits.getByRole("status")).toContainText("Limites salvos.");

  // Nova execução fica na fila (executor do servidor ainda não ativo).
  const form = page.getByRole("region", { name: "Nova execução" });
  await form.locator('select[name="agent"]').selectOption("operations_review");
  await form.getByLabel("Objetivo").fill(goal);
  await form.getByRole("button", { name: "Criar execução" }).click();
  await expect(form.getByRole("status").filter({ hasText: "Execução criada na fila" })).toBeVisible();
  const run = page.getByRole("listitem").filter({ hasText: goal });
  await expect(run.getByText("Na fila", { exact: true })).toBeVisible();
  await snap(page, "60-agentes-fila");

  // Kill switch: exige motivo, interrompe a execução ativa e bloqueia novas.
  await kill.getByLabel("Motivo").fill("Teste E2E do kill switch");
  await kill.getByRole("button", { name: "Ligar kill switch" }).click();
  await expect(kill.getByRole("status")).toContainText("Kill switch ligado.");
  await expect(run.getByText("Interrompida", { exact: true })).toBeVisible();
  await expect(form.getByRole("button", { name: "Criar execução" })).toBeDisabled();
  await snap(page, "61-agentes-kill-switch");

  await kill.getByRole("button", { name: "Desligar kill switch" }).click();
  await expect(kill.getByRole("status")).toContainText("Kill switch desligado.");
  await expect(form.getByRole("button", { name: "Criar execução" })).toBeEnabled();
});
