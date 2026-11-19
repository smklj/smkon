import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertReadQuery,
  postgrestToolDb,
  ToolDbError,
  type FilterValue,
  type PostgrestFilterLike,
  type PostgrestLike,
  type ReadQuery,
  type Row,
  type ToolDb,
} from "../../src/lib/agents/executor/tools/db.ts";
import {
  boundedList,
  createReadTools,
  FINANCE_SCAN_LIMIT,
  FORBIDDEN_COLUMNS,
  formatScaled,
  READ_COLUMNS,
  TOOL_MAX_ITEMS,
  TOOL_OUTPUT_MAX_BYTES,
  toScaled,
  workspaceDate,
} from "../../src/lib/agents/executor/tools/read.ts";
import { jsonBytes } from "../../src/lib/agents/executor/limits.ts";
import { runAgent } from "../../src/lib/agents/executor/run.ts";
import type { AgentModel, AgentStore, JsonObject, RunContext, StepRecord, ToolHandler } from "../../src/lib/agents/executor/types.ts";
import type { RunStatus } from "../../src/lib/agents/types.ts";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PRODUCT = "11111111-1111-4111-8111-111111111111";
const EVIDENCE = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-11-19T12:00:00.000Z");
const signal = new AbortController().signal;

function context(overrides: Partial<RunContext> = {}): RunContext {
  return {
    runId: "run-1",
    organizationId: ORG,
    agent: "product_research",
    goal: "Avaliar produtos",
    maxSteps: 8,
    grantedTools: ["read_products", "read_product_evidence", "read_content", "read_publication_queue", "read_finance_summary"],
    createdBy: "user-1",
    ...overrides,
  };
}

/** Porta falsa: registra as consultas e devolve linhas por tabela. */
class FakeDb implements ToolDb {
  readonly queries: ReadQuery[] = [];
  readonly rows: Partial<Record<string, Row[]>>;
  constructor(rows: Partial<Record<string, Row[]>> = {}) {
    this.rows = rows;
  }
  async select(query: ReadQuery): Promise<Row[]> {
    assertReadQuery(query);
    this.queries.push(query);
    return (this.rows[query.table] ?? []).slice(0, query.limit);
  }
}

function tool(db: ToolDb, name: keyof ReturnType<typeof createReadTools>): ToolHandler {
  const handler = createReadTools(db, { now: () => NOW })[name];
  assert.ok(handler, name);
  return handler;
}

// ---------------------------------------------------------------------------------------------------------------
// Porta ToolDb
// ---------------------------------------------------------------------------------------------------------------

test("assertReadQuery recusa tabela fora da lista, organização vazia, coluna suspeita e filtro manual de organização", () => {
  const base: ReadQuery = { table: "products", organizationId: ORG, columns: ["id"], limit: 10 };
  assert.doesNotThrow(() => assertReadQuery(base));
  assert.throws(() => assertReadQuery({ ...base, table: "organization_members" as ReadQuery["table"] }), ToolDbError);
  assert.throws(() => assertReadQuery({ ...base, organizationId: " " }), /organization_required/);
  assert.throws(() => assertReadQuery({ ...base, columns: ["id,created_by"] }), /invalid_column/);
  assert.throws(() => assertReadQuery({ ...base, columns: ["*"] }), /invalid_column/);
  assert.throws(() => assertReadQuery({ ...base, filters: [{ op: "eq", column: "organization_id", value: "outra" }] }), /organization_filter_is_implicit/);
  assert.throws(() => assertReadQuery({ ...base, limit: 0 }), /invalid_limit/);
  assert.throws(() => assertReadQuery({ ...base, limit: 10_001 }), /invalid_limit/);
});

/** Builder falso do PostgREST que grava a cadeia de chamadas. */
function fakePostgrest(result: { data: unknown; error: { message: string; code?: string } | null }) {
  const calls: Array<[string, ...unknown[]]> = [];
  const builder: PostgrestFilterLike = {
    eq: (column: string, value: FilterValue) => (calls.push(["eq", column, value]), builder),
    neq: (column: string, value: FilterValue) => (calls.push(["neq", column, value]), builder),
    gte: (column: string, value: FilterValue) => (calls.push(["gte", column, value]), builder),
    lt: (column: string, value: FilterValue) => (calls.push(["lt", column, value]), builder),
    in: (column: string, values: readonly FilterValue[]) => (calls.push(["in", column, values]), builder),
    order: (column: string, options: unknown) => (calls.push(["order", column, options]), builder),
    limit: (count: number) => (calls.push(["limit", count]), builder),
    abortSignal: () => (calls.push(["abortSignal"]), builder),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  const client: PostgrestLike = {
    from: (table: string) => (calls.push(["from", table]), { select: (columns: string) => (calls.push(["select", columns]), builder) }),
  };
  return { client, calls };
}

test("adaptador PostgREST aplica organization_id antes de qualquer outro filtro, limite e abortSignal", async () => {
  const { client, calls } = fakePostgrest({ data: [{ id: "x" }, null, [1]], error: null });
  const rows = await postgrestToolDb(client).select({
    table: "products",
    organizationId: ORG,
    columns: ["id", "name"],
    filters: [{ op: "neq", column: "status", value: "archived" }, { op: "in", column: "id", value: [PRODUCT] }],
    order: [{ column: "score", ascending: false, nullsFirst: false }],
    limit: 21,
  }, signal);
  assert.deepEqual(rows, [{ id: "x" }]);
  assert.deepEqual(calls, [
    ["from", "products"],
    ["select", "id,name"],
    ["eq", "organization_id", ORG],
    ["neq", "status", "archived"],
    ["in", "id", [PRODUCT]],
    ["order", "score", { ascending: false, nullsFirst: false }],
    ["limit", 21],
    ["abortSignal"],
  ]);
});

test("adaptador PostgREST não chega ao banco com consulta inválida e não vaza a mensagem do banco", async () => {
  const invalid = fakePostgrest({ data: [], error: null });
  await assert.rejects(postgrestToolDb(invalid.client).select({ table: "products", organizationId: "", columns: ["id"], limit: 1 }, signal), /organization_required/);
  assert.equal(invalid.calls.length, 0);

  const failing = fakePostgrest({ data: null, error: { message: "relation secret_table permission denied", code: "42501" } });
  await assert.rejects(
    postgrestToolDb(failing.client).select({ table: "products", organizationId: ORG, columns: ["id"], limit: 1 }, signal),
    (error: unknown) => error instanceof ToolDbError && error.code === "42501" && !error.message.includes("secret_table"),
  );
});

// ---------------------------------------------------------------------------------------------------------------
// Isolamento, colunas mínimas, entrada estrita
// ---------------------------------------------------------------------------------------------------------------

test("toda ferramenta consulta com a organização do contexto, nunca com algo vindo da entrada", async () => {
  const db = new FakeDb();
  const ctx = context();
  for (const name of ["read_products", "read_product_evidence", "read_content", "read_publication_queue", "read_finance_summary"] as const) {
    await tool(db, name)(ctx, {}, signal);
  }
  assert.ok(db.queries.length >= 7);
  for (const query of db.queries) assert.equal(query.organizationId, ORG, query.table);

  await assert.rejects(tool(db, "read_products")(ctx, { organization_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }, signal), /campo desconhecido/);
});

test("colunas lidas são mínimas: sem autoria, e-mail, link de afiliado ou id externo", () => {
  for (const [table, columns] of Object.entries(READ_COLUMNS)) {
    for (const forbidden of FORBIDDEN_COLUMNS) assert.ok(!(columns as readonly string[]).includes(forbidden), `${table}.${forbidden}`);
  }
});

test("entrada estrita: valores fora do domínio viram erro de entrada", async () => {
  const db = new FakeDb();
  const ctx = context();
  await assert.rejects(tool(db, "read_products")(ctx, { status: "deleted" }, signal), /invalid_input: status/);
  await assert.rejects(tool(db, "read_products")(ctx, { limit: 51 }, signal), /invalid_input: limit/);
  await assert.rejects(tool(db, "read_products")(ctx, { limit: 2.5 }, signal), /invalid_input: limit/);
  await assert.rejects(tool(db, "read_products")(ctx, { min_score: 101 }, signal), /invalid_input: min_score/);
  await assert.rejects(tool(db, "read_product_evidence")(ctx, { product_ids: ["nao-e-uuid"] }, signal), /invalid_input: product_ids/);
  await assert.rejects(tool(db, "read_product_evidence")(ctx, { product_ids: Array.from({ length: 21 }, () => PRODUCT) }, signal), /invalid_input/);
  await assert.rejects(tool(db, "read_publication_queue")(ctx, { upcoming_only: "sim" }, signal), /invalid_input: upcoming_only/);
  await assert.rejects(tool(db, "read_finance_summary")(ctx, { period_days: 365 }, signal), /invalid_input: period_days/);
  assert.equal(db.queries.length, 0, "entrada inválida não consulta o banco");
});

// ---------------------------------------------------------------------------------------------------------------
// Ferramentas
// ---------------------------------------------------------------------------------------------------------------

test("read_products: exclui arquivados por padrão, ordena por score e sinaliza quando havia mais itens", async () => {
  const rows = Array.from({ length: 4 }, (_, index) => ({
    id: `p${index}`, name: `Produto ${index}`, source: "manual", type: "digital", status: "active", revenue_domain: "affiliate",
    price_cents: 1990, currency: "BRL", commission_percent: "40.00", score: index === 0 ? "87.50" : null,
    score_reasons: ["demanda verificada", 7, "comissão verificada"], updated_at: "2026-11-18T10:00:00Z",
  }));
  const db = new FakeDb({ products: rows });
  const output = await tool(db, "read_products")(context(), { limit: 3 }, signal);

  const [query] = db.queries;
  assert.deepEqual(query.filters, [{ op: "neq", column: "status", value: "archived" }]);
  assert.equal(query.limit, 4, "pede limit + 1 para detectar truncamento");
  assert.equal(query.order?.[0].column, "score");
  assert.equal(output.count, 3);
  assert.equal(output.truncated, true);
  const first = (output.items as JsonObject[])[0];
  assert.equal(first.score, 87.5);
  assert.equal(first.commission_percent, 40);
  assert.deepEqual(first.score_reasons, ["demanda verificada", "comissão verificada"]);
});

test("read_product_evidence: filtra por produtos e status e entrega o contrato do Verifier (id/product_id/review_status)", async () => {
  const db = new FakeDb({
    product_evidence: [{
      id: EVIDENCE.toUpperCase(), product_id: PRODUCT.toUpperCase(), kind: "price", claim: "Preço na página de vendas",
      source_url: "https://exemplo.com.br/produto", value: "97.00", observed_at: "2026-11-18T10:00:00Z",
      review_status: "verified", reviewed_at: "2026-11-18T11:00:00Z", captured_by: "user-x", reviewed_by: "user-y",
    }],
  });
  const output = await tool(db, "read_product_evidence")(context(), { product_ids: [PRODUCT, PRODUCT.toUpperCase()], review_status: "verified" }, signal);
  assert.deepEqual(db.queries[0].filters, [
    { op: "in", column: "product_id", value: [PRODUCT] },
    { op: "eq", column: "review_status", value: "verified" },
  ]);
  const [item] = output.items as JsonObject[];
  assert.equal(item.id, EVIDENCE);
  assert.equal(item.product_id, PRODUCT);
  assert.equal(item.review_status, "verified");
  assert.equal(item.value, 97);
  assert.ok(!("captured_by" in item) && !("reviewed_by" in item), "sem autoria na saída");
});

test("read_content: corta textos longos e não lista arquivados por padrão", async () => {
  const db = new FakeDb({
    content_items: [{
      id: "c1", title: "Roteiro", product: "Produto", status: "draft", version: 2, approved_version: null,
      channels: ["Instagram", 3], caption: "x".repeat(5_000), cta: "Compre", hashtags: "#a", script: "y".repeat(9_000), updated_at: "2026-11-18T10:00:00Z",
    }],
  });
  const output = await tool(db, "read_content")(context(), {}, signal);
  assert.deepEqual(db.queries[0].filters, [{ op: "neq", column: "status", value: "archived" }]);
  const [item] = output.items as JsonObject[];
  assert.equal((item.caption as string).length, 600);
  assert.equal((item.script as string).length, 1_000);
  assert.deepEqual(item.channels, ["Instagram"]);
  assert.equal(output.truncated, false);
});

test("read_publication_queue: por padrão só próximos e não cancelados, em ordem de agenda", async () => {
  const db = new FakeDb();
  await tool(db, "read_publication_queue")(context(), {}, signal);
  await tool(db, "read_publication_queue")(context(), { status: "cancelled", upcoming_only: false }, signal);
  assert.deepEqual(db.queries[0].filters, [
    { op: "neq", column: "status", value: "cancelled" },
    { op: "gte", column: "scheduled_for", value: NOW.toISOString() },
  ]);
  assert.deepEqual(db.queries[0].order, [{ column: "scheduled_for", ascending: true }]);
  assert.deepEqual(db.queries[1].filters, [{ op: "eq", column: "status", value: "cancelled" }]);
});

test("read_finance_summary: domínios separados, sem somar entre si, regra de cancelados e aritmética exata", async () => {
  const db = new FakeDb({
    affiliate_commission_summary: [{
      currency: "BRL", conversions: 3, forecast_amount: "10.10", approved_amount: "20.20", settled_amount: "0",
      paid_amount: "5.0000", cancelled_amount: "1.1", reversed_amount: 0,
    }],
    sales_orders: [
      { currency: "BRL", order_status: "paid", gross_amount: "0.1", refund_amount: "0", fee_amount: "0.01" },
      { currency: "BRL", order_status: "paid", gross_amount: "0.2", refund_amount: "0.05", fee_amount: "0.02" },
      { currency: "BRL", order_status: "cancelled", gross_amount: "999", refund_amount: "0", fee_amount: "9" },
      { currency: "usd", order_status: "fulfilled", gross_amount: 10, refund_amount: null, fee_amount: 1 },
    ],
    ad_campaign_daily_metrics: [
      { currency: "BRL", spend: "12.3456", impressions: 1000, clicks: "10" },
      { currency: "BRL", spend: "0.0001", impressions: 1, clicks: 0 },
    ],
  });
  const output = await tool(db, "read_finance_summary")(context(), {}, signal);

  const sales = db.queries.find((query) => query.table === "sales_orders");
  const media = db.queries.find((query) => query.table === "ad_campaign_daily_metrics");
  assert.deepEqual(sales?.filters, [{ op: "gte", column: "occurred_at", value: "2026-10-20T12:00:00.000Z" }]);
  assert.deepEqual(media?.filters, [{ op: "gte", column: "metric_date", value: "2026-10-20" }]);
  assert.equal(sales?.limit, FINANCE_SCAN_LIMIT + 1);

  assert.equal(output.period_days, 30);
  assert.deepEqual((output.affiliate as JsonObject).by_currency, [{
    currency: "BRL", conversions: 3, forecast: "10.1000", approved: "20.2000", settled: "0.0000",
    paid: "5.0000", cancelled: "1.1000", reversed: "0.0000",
  }]);
  assert.deepEqual((output.owned_sales as JsonObject).by_currency, [
    { currency: "BRL", orders: 2, gross: "0.3000", refunds: "0.0500", fees: "0.0300" },
    { currency: "USD", orders: 1, gross: "10.0000", refunds: "0.0000", fees: "1.0000" },
  ]);
  assert.deepEqual((output.paid_media as JsonObject).by_currency, [{ currency: "BRL", spend: "12.3457", impressions: 1001, clicks: 10 }]);
  assert.equal((output.owned_sales as JsonObject).truncated, false);
  assert.ok(!("total" in output), "nenhum total somando domínios");
});

test("read_finance_summary marca truncated quando o período tem mais linhas que o limite de leitura", async () => {
  const many = Array.from({ length: FINANCE_SCAN_LIMIT + 1 }, () => ({ currency: "BRL", order_status: "paid", gross_amount: "1", refund_amount: "0", fee_amount: "0" }));
  const output = await tool(new FakeDb({ sales_orders: many }), "read_finance_summary")(context(), { period_days: 7 }, signal);
  const sales = output.owned_sales as JsonObject;
  assert.equal(sales.truncated, true);
  assert.deepEqual(sales.by_currency, [{ currency: "BRL", orders: FINANCE_SCAN_LIMIT, gross: `${FINANCE_SCAN_LIMIT}.0000`, refunds: "0.0000", fees: "0.0000" }]);
});

// ---------------------------------------------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------------------------------------------

test("toScaled/formatScaled somam decimais sem erro de ponto flutuante", () => {
  assert.equal(formatScaled(toScaled("0.1") + toScaled("0.2")), "0.3000");
  assert.equal(formatScaled(toScaled(0.1) + toScaled(0.2)), "0.3000");
  assert.equal(formatScaled(toScaled("99999999999999.9999")), "99999999999999.9999");
  assert.equal(formatScaled(toScaled("-1.5")), "-1.5000");
  assert.equal(formatScaled(toScaled(null)), "0.0000");
  assert.throws(() => toScaled("1e3"), /numeric inválido/);
});

test("workspaceDate usa o dia de São Paulo", () => {
  assert.equal(workspaceDate(new Date("2026-11-19T02:00:00Z")), "2026-11-18");
  assert.equal(workspaceDate(new Date("2026-11-19T03:00:00Z")), "2026-11-19");
});

test("boundedList respeita 50 itens e o teto de bytes, marcando truncated", () => {
  const items = Array.from({ length: 80 }, (_, index) => ({ id: index, text: "z".repeat(2_000) }));
  const output = boundedList(items, 50);
  assert.ok((output.count as number) <= TOOL_MAX_ITEMS);
  assert.ok(jsonBytes(output) <= TOOL_OUTPUT_MAX_BYTES);
  assert.equal(output.truncated, true);
  assert.deepEqual(boundedList([{ id: 1 }], 20), { items: [{ id: 1 }], count: 1, truncated: false });
});

// ---------------------------------------------------------------------------------------------------------------
// Integração com o loop do executor (modelo e store falsos)
// ---------------------------------------------------------------------------------------------------------------

test("executor + ferramentas reais: afirmação de produto passa só com evidência verificada lida na execução", async () => {
  const db = new FakeDb({
    products: [{ id: PRODUCT, name: "Curso", source: "manual", type: "digital", status: "active", revenue_domain: "affiliate", price_cents: 9700, currency: "BRL", commission_percent: 40, score: 80, score_reasons: [], updated_at: "2026-11-18T10:00:00Z" }],
    product_evidence: [{ id: EVIDENCE, product_id: PRODUCT, kind: "price", claim: "Preço R$ 97", source_url: "https://exemplo.com.br/p", value: 97, observed_at: "2026-11-18T10:00:00Z", review_status: "verified", reviewed_at: "2026-11-18T11:00:00Z" }],
  });

  const recorded: StepRecord[] = [];
  let status: RunStatus = "queued";
  let outcome: JsonObject | null = null;
  const store: AgentStore = {
    currentStatus: async () => status,
    recordStep: async (step) => {
      recorded.push(step);
      status = step.phase === "plan" ? "planning" : step.phase === "execute" ? "executing" : "verifying";
      return { seq: recorded.length, runStatus: status };
    },
    finish: async (_runId, value) => { outcome = value; status = "succeeded"; },
    fail: async () => { status = "failed"; },
  };
  const model: AgentModel = {
    plan: async () => ({ steps: [
      { tool: "read_products", input: { status: "active" } },
      { tool: "read_product_evidence", input: { product_ids: [PRODUCT], review_status: "verified" } },
    ] }),
    summarize: async () => ({ text: "Curso com preço verificado.", claims: [{ text: "Preço R$ 97", productId: PRODUCT, evidenceIds: [EVIDENCE] }] }),
  };

  const result = await runAgent(context({ grantedTools: ["read_products", "read_product_evidence"] }), {
    model, store, tools: createReadTools(db, { now: () => NOW }), logger: () => {},
  });
  assert.equal(result.status, "succeeded");
  assert.ok(outcome);
  assert.deepEqual(recorded.map((step) => `${step.phase}:${step.tool ?? "-"}`), ["plan:-", "execute:read_products", "execute:read_product_evidence", "verify:-"]);
  for (const query of db.queries) assert.equal(query.organizationId, ORG);
});
