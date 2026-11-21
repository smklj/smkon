import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createInitialStagingState,
  applyFieldEdit,
  applyAddRecord,
  applyDeleteRecord,
  discardChange,
  discardAll,
  getRecordStatus,
  getRecordMergedValue,
  computeStagingSummary,
  buildCommitPayload,
  filterAndSortRecords,
} from "../../src/lib/data-studio/staging-engine.ts";
import { SMKON_MODELS } from "../../src/lib/data-studio/types.ts";

test("Data Studio Models: definições padrão do SMKON", () => {
  assert.ok(SMKON_MODELS.products);
  assert.ok(SMKON_MODELS.content);
  assert.ok(SMKON_MODELS.transactions);

  assert.equal(SMKON_MODELS.products.primaryKey, "id");
  assert.ok(SMKON_MODELS.products.columns.some((c) => c.key === "price" && c.type === "currency"));
  assert.ok(SMKON_MODELS.products.columns.some((c) => c.key === "contentsCount" && c.type === "relation"));
});

test("Staging Engine: registrar edição de campo com diffing", () => {
  let state = createInitialStagingState();

  state = applyFieldEdit(state, "products", "prod-1", "price", 39.9, 49.9);
  assert.equal(state.changes.length, 1);
  assert.equal(getRecordStatus(state, "products", "prod-1"), "modified");

  // Se alterar de volta para o valor original, remove a alteração
  state = applyFieldEdit(state, "products", "prod-1", "price", 39.9, 39.9);
  assert.equal(state.changes.length, 0);
  assert.equal(getRecordStatus(state, "products", "prod-1"), "pristine");
});

test("Staging Engine: mesclagem de valores editados (Merged Value)", () => {
  let state = createInitialStagingState();
  const original = { id: "prod-1", name: "Mouse Gamer", price: 50 };

  state = applyFieldEdit(state, "products", "prod-1", "name", "Mouse Gamer", "Mouse Gamer RGB");
  state = applyFieldEdit(state, "products", "prod-1", "price", 50, 75);

  const merged = getRecordMergedValue(state, "products", original);
  assert.equal(merged.name, "Mouse Gamer RGB");
  assert.equal(merged.price, 75);
});

test("Staging Engine: adicionar nova linha e sumário", () => {
  let state = createInitialStagingState();

  state = applyAddRecord(state, "products", { id: "prod-new", name: "Novo Fone", price: 99 });
  assert.equal(state.changes.length, 1);
  assert.equal(getRecordStatus(state, "products", "prod-new"), "created");

  const summary = computeStagingSummary(state);
  assert.equal(summary.totalChanges, 1);
  assert.equal(summary.createsCount, 1);
  assert.equal(summary.editsCount, 0);
});

test("Staging Engine: marcar para deleção e toggle", () => {
  let state = createInitialStagingState();

  state = applyDeleteRecord(state, "products", "prod-existing");
  assert.equal(getRecordStatus(state, "products", "prod-existing"), "deleted");

  // Toggle de desfazer
  state = applyDeleteRecord(state, "products", "prod-existing");
  assert.equal(getRecordStatus(state, "products", "prod-existing"), "pristine");
});

test("Staging Engine: descartar alteração específica (Discard Change)", () => {
  let state = createInitialStagingState();
  state = applyFieldEdit(state, "products", "prod-1", "name", "A", "B");
  const changeId = state.changes[0].id;
  assert.equal(state.changes.length, 1);

  state = discardChange(state, changeId);
  assert.equal(state.changes.length, 0);
});

test("Staging Engine: descartar tudo (Discard All)", () => {
  let state = createInitialStagingState();
  state = applyFieldEdit(state, "products", "prod-1", "name", "A", "B");
  state = applyAddRecord(state, "products", { id: "prod-2" });
  assert.equal(state.changes.length, 2);

  state = discardAll();
  assert.equal(state.changes.length, 0);
});

test("Staging Engine: construção de payload de commit em lote", () => {
  let state = createInitialStagingState();
  state = applyAddRecord(state, "products", { id: "prod-new", name: "Produto Novo" });
  state = applyFieldEdit(state, "products", "prod-1", "price", 30, 40);
  state = applyDeleteRecord(state, "products", "prod-del");

  const payload = buildCommitPayload(state);
  assert.equal(payload.toCreate.length, 1);
  assert.equal(payload.toUpdate.length, 1);
  assert.equal(payload.toDelete.length, 1);
  assert.equal(payload.toUpdate[0].updates.price, 40);
});

test("Staging Engine: filtragem e ordenação de registros", () => {
  const data = [
    { id: "1", name: "Mini Aspirador", price: 39.9, status: "active" },
    { id: "2", name: "Teclado RGB", price: 89.9, status: "review" },
    { id: "3", name: "Fone Bluetooth", price: 129.9, status: "active" },
  ];

  // Busca textual
  const searchResults = filterAndSortRecords(data, [], undefined, "teclado");
  assert.equal(searchResults.length, 1);
  assert.equal(searchResults[0].name, "Teclado RGB");

  // Filtro numérico (preço > 50)
  const filtered = filterAndSortRecords(data, [{ column: "price", operator: "gt", value: 50 }]);
  assert.equal(filtered.length, 2);

  // Ordenação descendente por preço
  const sorted = filterAndSortRecords(data, [], { column: "price", direction: "desc" });
  assert.equal(sorted[0].name, "Fone Bluetooth");
  assert.equal(sorted[2].name, "Mini Aspirador");
});
