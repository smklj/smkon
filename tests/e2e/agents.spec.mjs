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

  // Detalhe da execução (S14 etapa 8): estado, motivo legível, consumo do modelo e nenhuma ação de publicar.
  await run.getByRole("link", { name: new RegExp(goal) }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Execução de agente" })).toBeVisible();
  const resumo = page.getByRole("region", { name: "Resumo" });
  await expect(resumo.getByText("Interrompida", { exact: true })).toBeVisible();
  await expect(resumo.getByRole("status")).toContainText("kill switch do workspace foi ligado");
  await expect(page.getByRole("region", { name: "Consumo do modelo" })).toContainText("Nenhuma chamada ao modelo registrada");
  await expect(page.getByRole("region", { name: "Passos" })).toContainText("Nenhum passo registrado");
  await expect(page.getByRole("button", { name: /publicar|aprovar/i })).toHaveCount(0);
  await snap(page, "62-agentes-detalhe");
  await page.getByRole("link", { name: "Voltar aos agentes" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Agentes de IA" })).toBeVisible();

  await kill.getByRole("button", { name: "Desligar kill switch" }).click();
  await expect(kill.getByRole("status")).toContainText("Kill switch desligado.");
  await expect(form.getByRole("button", { name: "Criar execução" })).toBeEnabled();
});

test("Agentes: missão agendada é criada, pausada, retomada e arquivada", async ({ page }) => {
  const name = `E2E missão ${runId}`;
  await page.goto("/agentes");
  await expect(page.getByRole("heading", { level: 1, name: "Agentes de IA" })).toBeVisible();
  const missions = page.getByRole("region", { name: "Missões" });
  await expect(missions).toBeVisible();
  // Ambiente sem a migration 20261124100000: a seção avisa e não oferece o formulário.
  test.skip(await missions.getByText("migration pendente").isVisible(), "migration de missões não aplicada neste banco");

  const kill = page.getByRole("region", { name: "Kill switch" });
  if (await kill.getByRole("button", { name: "Desligar kill switch" }).isVisible()) {
    await kill.getByRole("button", { name: "Desligar kill switch" }).click();
    await expect(kill.getByRole("status")).toContainText("Kill switch desligado.");
  }

  await missions.getByLabel("Nome").fill(name);
  await missions.locator('select[name="agent"]').selectOption("operations_review");
  await missions.getByLabel("Frequência").selectOption("weekly");
  await missions.getByLabel("Dia").selectOption("1");
  await missions.getByLabel("Horário (Brasília)").fill("08:00");
  await missions.getByLabel("Objetivo").fill("Resumo semanal da fila e do financeiro (E2E)");
  await missions.getByRole("button", { name: "Criar missão" }).click();
  await expect(missions.getByRole("status").filter({ hasText: "Missão criada" })).toBeVisible();

  const item = missions.getByRole("listitem").filter({ hasText: name });
  await expect(item.getByText("Ativa", { exact: true })).toBeVisible();
  await expect(item).toContainText("Toda segunda às 08:00");
  await expect(item).toContainText("Próxima:");
  await snap(page, "63-agentes-missao");

  await item.getByRole("button", { name: `Pausar missão ${name}` }).click();
  await expect(item.getByText("Pausada", { exact: true })).toBeVisible();
  await item.getByRole("button", { name: `Retomar missão ${name}` }).click();
  await expect(item.getByText("Ativa", { exact: true })).toBeVisible();
  await item.getByRole("button", { name: `Arquivar missão ${name}` }).click();
  await expect(missions.getByRole("listitem").filter({ hasText: name })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /publicar|aprovar/i })).toHaveCount(0);
});
