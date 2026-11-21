import { expect, runId, snap, test } from "./fixtures.mjs";

test("produto: cadastro, evidências, revisão humana e score baseado em evidência", async ({ page }) => {
  const name = `E2E Produto ${runId}`;
  const evidenceRow = (claim) => page.getByRole("listitem").filter({ hasText: claim });
  const scoreRegion = page.getByRole("region", { name: "Score" });
  const form = page.getByRole("region", { name: "Registrar evidência" });

  async function addEvidence({ kind, claim, url, value }) {
    await form.getByLabel("Tipo de evidência").selectOption(kind);
    await form.getByLabel("O que a fonte mostra").fill(claim);
    await form.getByLabel("Link da fonte (https)").fill(url);
    if (value !== undefined) await form.getByLabel(/^Valor/).fill(value);
    await form.getByRole("button", { name: "Registrar evidência" }).click();
    await expect(form.getByRole("status")).toContainText("Evidência registrada como pendente");
    await expect(evidenceRow(claim).getByText("Pendente", { exact: true })).toBeVisible();
  }
  async function review(claim, decision, note) {
    const row = evidenceRow(claim);
    if (note) await row.getByPlaceholder("Observação (obrigatória para rejeitar)").fill(note);
    await row.getByRole("button", { name: decision === "verified" ? "Verificar" : "Rejeitar" }).click();
  }

  await page.goto("/produtos");
  await page.getByLabel("Nome do produto").fill(name);
  await page.getByLabel("Fonte").selectOption("hotmart");
  await page.getByLabel("Tipo").selectOption("info");
  await page.getByLabel("Preço informado (opcional)").fill("999");
  await page.getByLabel("Comissão informada % (opcional)").fill("90");
  await page.getByRole("button", { name: "Cadastrar produto" }).click();

  await expect(page).toHaveURL(/\/produtos\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  // Dados digitados no cadastro não geram score.
  await expect(scoreRegion.getByText("sem score")).toBeVisible();
  await snap(page, "10-produto-novo");

  // Validação no servidor: link sem domínio válido é recusado.
  await form.getByLabel("Tipo de evidência").selectOption("sales_page");
  await form.getByLabel("O que a fonte mostra").fill("Fonte inválida");
  await form.getByLabel("Link da fonte (https)").fill("https://exemplo");
  await form.getByRole("button", { name: "Registrar evidência" }).click();
  await expect(form.getByRole("alert")).toContainText("https");

  await addEvidence({ kind: "commission", claim: `Comissão 40% ${runId}`, url: "https://hotmart.com/e2e/afiliado", value: "40" });
  await review(`Comissão 40% ${runId}`, "verified");
  await expect(evidenceRow(`Comissão 40% ${runId}`).getByText("Verificada", { exact: true })).toBeVisible();
  // Comissão verificada sem página de venda verificada: continua sem score.
  await expect(scoreRegion.getByText("sem score")).toBeVisible();
  await expect(scoreRegion).toContainText("Sem página de venda verificada");

  await addEvidence({ kind: "sales_page", claim: `Página de venda ${runId}`, url: "https://hotmart.com/e2e/produto" });
  await review(`Página de venda ${runId}`, "verified", "Conferido no E2E");
  await expect(scoreRegion.locator(".score-large")).toHaveText(/^40/);

  await addEvidence({ kind: "price", claim: `Preço 197 ${runId}`, url: "https://hotmart.com/e2e/produto", value: "197,00" });
  await review(`Preço 197 ${runId}`, "verified");
  await expect(scoreRegion.locator(".score-large")).toHaveText(/^50/);

  await addEvidence({ kind: "rating", claim: `Nota 4,5 ${runId}`, url: "https://hotmart.com/e2e/avaliacoes", value: "4,5" });
  await review(`Nota 4,5 ${runId}`, "rejected");
  await expect(evidenceRow(`Nota 4,5 ${runId}`).getByRole("alert")).toContainText("motivo");
  await review(`Nota 4,5 ${runId}`, "rejected", "Nota não aparece na página");
  await expect(evidenceRow(`Nota 4,5 ${runId}`).getByText("Rejeitada", { exact: true })).toBeVisible();
  await expect(scoreRegion.locator(".score-large")).toHaveText(/^50/);
  await expect(scoreRegion).toContainText("Preço verificado de 197");
  await snap(page, "11-produto-score");

  // Produto com evidência não é apagado: arquivar.
  await page.getByLabel("Status do produto").selectOption("archived");
  await page.getByRole("button", { name: "Alterar status" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Status atualizado." })).toBeVisible();
  await page.goto("/produtos");
  await expect(page.getByRole("link", { name })).toHaveCount(0);
  await page.getByRole("link", { name: "Mostrar arquivados" }).click();
  await expect(page.getByRole("link", { name })).toBeVisible();
  await snap(page, "12-catalogo-arquivados");
});

test("API de produtos valida entrada e ignora score enviado pelo cliente", async ({ page }) => {
  await page.goto("/produtos");
  const result = await page.evaluate(async (suffix) => {
    const post = (body) =>
      fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const invalid = await post({ name: "x", source: "tiktok" });
    const created = await post({ name: `E2E API ${suffix}`, source: "manual", score: 100 });
    const createdBody = await created.json();
    const items = (await (await fetch("/api/products")).json()).items ?? [];
    const item = items.find((entry) => entry.id === createdBody.id);
    return { invalid: invalid.status, created: created.status, score: item ? item.score : "missing" };
  }, runId);
  expect(result.invalid).toBe(400);
  expect(result.created).toBe(201);
  expect(result.score).toBeNull();
});

// S16: paginação por cursor da API de produtos (depende de `score_rank`, migration 20261119120000 no staging).
test("API de produtos pagina por cursor sem repetir nem perder itens", async ({ page }) => {
  await page.goto("/produtos");
  const result = await page.evaluate(async (suffix) => {
    const names = [1, 2, 3].map((n) => `E2E Página ${n} ${suffix}`);
    const ids = [];
    for (const name of names) {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, source: "manual" }),
      });
      if (response.status !== 201) return { error: `criação ${response.status}` };
      ids.push((await response.json()).id);
    }

    // Percorre o catálogo de 2 em 2 até achar os 3 produtos criados (ou acabar o catálogo).
    const seen = new Set();
    const order = [];
    let duplicates = 0;
    let pages = 0;
    let cursor = null;
    let cacheControl = "";
    const pageSizes = [];
    do {
      const url = `/api/products?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const response = await fetch(url);
      if (response.status !== 200) return { error: `página ${pages + 1}: ${response.status}` };
      if (pages === 0) cacheControl = response.headers.get("cache-control") ?? "";
      const body = await response.json();
      pageSizes.push(body.items.length);
      for (const item of body.items) {
        if (seen.has(item.id)) duplicates += 1;
        seen.add(item.id);
        if (ids.includes(item.id)) order.push(item.id);
      }
      cursor = body.nextCursor;
      pages += 1;
    } while (cursor && order.length < ids.length && pages < 200);

    const invalid = await fetch("/api/products?cursor=nao-e-um-cursor");
    return {
      found: order.length,
      // Sem score, a ordem é updated_at desc: o último criado aparece primeiro.
      newestFirst: order.join() === [...ids].reverse().join(),
      duplicates,
      maxPageSize: Math.max(...pageSizes),
      cacheControl,
      invalid: invalid.status,
      invalidCode: (await invalid.json()).code ?? null,
    };
  }, runId);

  expect(result.error).toBeUndefined();
  expect(result.found).toBe(3);
  expect(result.newestFirst).toBe(true);
  expect(result.duplicates).toBe(0);
  expect(result.maxPageSize).toBeLessThanOrEqual(2);
  expect(result.cacheControl).toContain("no-store");
  expect(result.invalid).toBe(400);
  expect(result.invalidCode).toBe("invalid_input");
});
