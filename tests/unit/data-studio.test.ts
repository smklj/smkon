import { test } from "node:test";
import assert from "node:assert/strict";
import { distinctValues, queryRows, toCsv } from "../../src/lib/data-studio/query.ts";
import { mapContents, mapLedger, mapProducts, productKey } from "../../src/lib/data-studio/mappers.ts";
import { DATA_MODELS, type DataRow } from "../../src/lib/data-studio/types.ts";

const product = (overrides: Record<string, unknown> = {}) => ({
  id: "p1",
  name: "Curso de Fotografia",
  source: "hotmart",
  type: "info",
  revenue_domain: "affiliate",
  price_cents: 19790,
  currency: "BRL",
  commission_percent: "40.00",
  score: null,
  status: "selected",
  updated_at: "2026-11-20T12:00:00Z",
  ...overrides,
});

const content = (overrides: Record<string, unknown> = {}) => ({
  id: "c1",
  title: "Reels de lançamento",
  product: "  curso de fotografia ",
  channels: ["Instagram", "TikTok"],
  status: "approved",
  version: 3,
  approved_version: 3,
  updated_at: "2026-11-21T09:00:00Z",
  ...overrides,
});

test("modelos: colunas espelham só campos reais e cada modelo aponta para a tela de edição", () => {
  assert.deepEqual(Object.keys(DATA_MODELS), ["products", "content", "ledger"]);
  for (const model of Object.values(DATA_MODELS)) {
    assert.ok(model.editHref.startsWith("/"));
    assert.ok(model.columns.some((column) => column.key === model.filterKey));
  }
});

test("mapProducts: rótulos, centavos para reais, números de texto e contagem de conteúdos pelo nome", () => {
  const [row] = mapProducts([product()], [content(), content({ id: "c2", product: "Outro" }), content({ id: "c3", product: null })]);
  assert.equal(row.source, "Hotmart");
  assert.equal(row.type, "Infoproduto");
  assert.equal(row.domain, "Afiliado");
  assert.equal(row.status, "Selecionado");
  assert.equal(row.price, 197.9);
  assert.equal(row.commission, 40);
  assert.equal(row.score, null, "score ausente continua ausente, nunca vira zero");
  assert.equal(row.contents, 1);
});

test("mapProducts: preço nulo e moeda nula não inventam valores", () => {
  const [row] = mapProducts([product({ price_cents: null, currency: null, commission_percent: null })], []);
  assert.equal(row.price, null);
  assert.equal(row.commission, null);
  assert.equal(row.currency, "BRL");
  assert.equal(row.contents, 0);
});

test("mapContents: versão atual e aprovada, produto vazio vira nulo", () => {
  const [approved, draft] = mapContents([
    content(),
    content({ id: "c2", status: "draft", approved_version: null, product: "   ", channels: null }),
  ]);
  assert.equal(approved.status, "Aprovado");
  assert.equal(approved.version, "v3");
  assert.equal(approved.approved_version, "v3");
  assert.equal(draft.status, "Rascunho");
  assert.equal(draft.approved_version, null);
  assert.equal(draft.product, null);
  assert.deepEqual(draft.channels, []);
});

test("mapLedger: domínio, tipo e origem legíveis; valor numérico preserva o sinal", () => {
  const [row] = mapLedger([
    {
      id: "l1",
      domain: "owned_sales",
      entry_type: "sales_refund",
      source_table: "sales_order_adjustments",
      amount: "-49.90",
      currency: "BRL",
      effective_at: "2026-11-19T15:00:00Z",
    },
  ]);
  assert.equal(row.domain, "Venda própria");
  assert.equal(row.entry_type, "Reembolso");
  assert.equal(row.source, "Ajuste de pedido");
  assert.equal(row.amount, -49.9);
});

test("productKey: ignora espaços e caixa", () => {
  assert.equal(productKey("  Curso De Fotografia "), productKey("curso de fotografia"));
  assert.equal(productKey(null), "");
});

const rows: DataRow[] = [
  { id: "1", name: "Beta", status: "Ativo", score: 80, channels: ["Instagram"] },
  { id: "2", name: "alfa", status: "Descoberto", score: null, channels: ["TikTok", "YouTube"] },
  { id: "3", name: "Gama", status: "Ativo", score: 35, channels: [] },
];
const columns = [
  { key: "name", label: "Produto", kind: "text" as const },
  { key: "status", label: "Status", kind: "badge" as const },
  { key: "score", label: "Score", kind: "score" as const },
  { key: "channels", label: "Canais", kind: "list" as const },
];

test("queryRows: busca sem distinção de caixa, inclusive em listas", () => {
  assert.deepEqual(queryRows(rows, { columns, search: "ALFA" }).map((row) => row.id), ["2"]);
  assert.deepEqual(queryRows(rows, { columns, search: "youtube" }).map((row) => row.id), ["2"]);
  assert.equal(queryRows(rows, { columns, search: "   " }).length, 3);
});

test("queryRows: filtro exato combina com a busca", () => {
  assert.deepEqual(queryRows(rows, { columns, filter: { key: "status", value: "Ativo" } }).map((row) => row.id), ["1", "3"]);
  assert.deepEqual(
    queryRows(rows, { columns, search: "gama", filter: { key: "status", value: "Ativo" } }).map((row) => row.id),
    ["3"],
  );
});

test("queryRows: ordena números e textos; vazios ficam no fim nos dois sentidos", () => {
  assert.deepEqual(queryRows(rows, { columns, sort: { column: "score", direction: "asc" } }).map((row) => row.id), ["3", "1", "2"]);
  assert.deepEqual(queryRows(rows, { columns, sort: { column: "score", direction: "desc" } }).map((row) => row.id), ["1", "3", "2"]);
  assert.deepEqual(queryRows(rows, { columns, sort: { column: "name", direction: "asc" } }).map((row) => row.id), ["2", "1", "3"]);
});

test("queryRows: não altera o array de entrada", () => {
  const copy = structuredClone(rows);
  queryRows(rows, { columns, sort: { column: "name", direction: "desc" } });
  assert.deepEqual(rows, copy);
});

test("distinctValues: valores únicos ordenados, sem vazios", () => {
  assert.deepEqual(distinctValues([...rows, { id: "4", status: null }], "status"), ["Ativo", "Descoberto"]);
});

test("toCsv: separador ponto e vírgula, aspas e proteção contra fórmula", () => {
  const csv = toCsv(
    [
      { name: '=HYPERLINK("http://x")', note: 'tem "aspas"; e ponto e vírgula', amount: -49.9 },
      { name: "@cmd", note: "+soma", amount: 10 },
    ],
    [
      { key: "name", label: "Nome", kind: "text" },
      { key: "note", label: "Nota", kind: "text" },
      { key: "amount", label: "Valor", kind: "money" },
    ],
  );
  const lines = csv.split("\r\n");
  assert.equal(lines[0], "Nome;Nota;Valor");
  assert.equal(lines[1], `"'=HYPERLINK(""http://x"")";"tem ""aspas""; e ponto e vírgula";-49.9`);
  assert.equal(lines[2], "'@cmd;'+soma;10", "número negativo continua número; texto com sinal é neutralizado");
});
