import assert from "node:assert/strict";
import test from "node:test";
import {
  MERCADO_LIVRE_ORDER_PAGE_SIZE,
  MERCADO_LIVRE_ORDER_MAX_OFFSET,
  parseMercadoLivreOrderSearchPage,
  parseMercadoLivreOrderSyncAction,
  parseMercadoLivreOrderSyncPageRequest,
} from "../../src/lib/integrations/mercado-livre/order-sync-window.ts";

const now = new Date("2026-11-21T04:37:00.000Z");

test("creates a fixed, hour-aligned 12-month window for the first page", () => {
  const parsed = parseMercadoLivreOrderSyncPageRequest({}, now);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.offset, 0);
  assert.equal(parsed.value.createdTo, "2026-11-21T04:00:00.000Z");
  assert.equal(parsed.value.createdFrom, "2025-11-21T04:00:00.000Z");
});

test("rejects non-object payloads instead of silently starting a first-page import", () => {
  for (const input of [null, [], "invalid", 1, true]) {
    assert.equal(parseMercadoLivreOrderSyncPageRequest(input, now).ok, false);
  }
});

test("keeps the same date window when requesting the next page", () => {
  const parsed = parseMercadoLivreOrderSyncPageRequest({
    offset: 50,
    createdFrom: "2025-11-21T04:00:00.000Z",
    createdTo: "2026-11-21T04:00:00.000Z",
  }, now);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.offset, MERCADO_LIVRE_ORDER_PAGE_SIZE);
  assert.equal(parsed.value.createdFrom, "2025-11-21T04:00:00.000Z");
  assert.equal(parsed.value.createdTo, "2026-11-21T04:00:00.000Z");
});

test("rejects partial, reversed, future and oversized date windows", () => {
  assert.equal(parseMercadoLivreOrderSyncPageRequest({ createdFrom: "2025-11-21T04:00:00Z" }, now).ok, false);
  assert.equal(parseMercadoLivreOrderSyncPageRequest({ createdFrom: "2026-10-01T04:00:00Z", createdTo: "2026-09-01T04:00:00Z" }, now).ok, false);
  assert.equal(parseMercadoLivreOrderSyncPageRequest({ createdFrom: "2025-11-21T04:00:00Z", createdTo: "2026-11-22T04:00:00Z" }, now).ok, false);
  assert.equal(parseMercadoLivreOrderSyncPageRequest({ createdFrom: "2024-01-01T00:00:00Z", createdTo: "2026-11-21T04:00:00Z" }, now).ok, false);
  assert.equal(parseMercadoLivreOrderSyncPageRequest({ createdFrom: "not-a-date", createdTo: "2026-11-21T04:00:00Z" }, now).ok, false);
  assert.equal(parseMercadoLivreOrderSyncPageRequest({ createdFrom: "2025-11-21T04:00:00", createdTo: "2026-11-21T04:00:00Z" }, now).ok, false);
});

test("offset is bounded and must align to a 50-order page", () => {
  assert.equal(parseMercadoLivreOrderSyncPageRequest({ offset: 50 }, now).ok, false);
  assert.equal(parseMercadoLivreOrderSyncPageRequest({ offset: -50 }, now).ok, false);
  assert.equal(parseMercadoLivreOrderSyncPageRequest({ offset: 51 }, now).ok, false);
  assert.equal(parseMercadoLivreOrderSyncPageRequest({ offset: MERCADO_LIVRE_ORDER_MAX_OFFSET + 50 }, now).ok, false);
  assert.equal(parseMercadoLivreOrderSyncPageRequest({ offset: 100, createdFrom: "2025-11-21T04:00:00Z", createdTo: "2026-11-21T04:00:00Z" }, now).ok, true);
});

test("defaults to resume and accepts only the explicit restart action", () => {
  assert.deepEqual(parseMercadoLivreOrderSyncAction(undefined), { ok: true, value: "next" });
  assert.deepEqual(parseMercadoLivreOrderSyncAction({}), { ok: true, value: "next" });
  assert.deepEqual(parseMercadoLivreOrderSyncAction({ action: "restart" }), { ok: true, value: "restart" });
  assert.equal(parseMercadoLivreOrderSyncAction({ action: "next" }).ok, true);
});

test("rejects client-supplied cursor/window fields and malformed actions", () => {
  for (const input of [
    null,
    [],
    "next",
    { action: "delete" },
    { offset: 50 },
    { createdFrom: "2025-11-21T04:00:00Z", createdTo: "2026-11-21T04:00:00Z" },
    { action: "next", offset: 0 },
  ]) {
    assert.equal(parseMercadoLivreOrderSyncAction(input).ok, false);
  }
});


const providerOrder = (id: number) => ({
  id,
  status: "paid",
  currency_id: "BRL",
  total_amount: 10,
  date_created: "2026-11-21T01:00:00.000Z",
});

test("rejects missing, malformed, oversized and non-object order search results", () => {
  assert.equal(parseMercadoLivreOrderSearchPage({ paging: { total: 1 } }, 0).ok, false);
  for (const results of [null, "not-an-array", {}, [null], [[]], ["order"], [{}], [{ ...providerOrder(1), order_items: "invalid" }]]) {
    assert.equal(parseMercadoLivreOrderSearchPage({ results }, 0).ok, false);
  }
  assert.equal(parseMercadoLivreOrderSearchPage({
    results: Array.from({ length: 51 }, (_, index) => providerOrder(index + 1)),
  }, 0).ok, false);
});

test("rejects malformed paging metadata and invalid provider totals", () => {
  for (const paging of [null, [], "invalid", { total: null }, { total: -1 }, { total: 1.5 }, { total: "50" }, { total: Number.MAX_SAFE_INTEGER + 1 }]) {
    assert.equal(parseMercadoLivreOrderSearchPage({ results: [], paging }, 0).ok, false);
  }
});

test("rejects an empty page before the provider total without advancing the checkpoint", () => {
  const parsed = parseMercadoLivreOrderSearchPage({ results: [], paging: { total: 51 } }, 50);
  assert.equal(parsed.ok, false);
});

test("rejects a partial page when the provider reports more orders remain", () => {
  const partial = Array.from({ length: 17 }, (_, index) => providerOrder(index + 1));
  const parsed = parseMercadoLivreOrderSearchPage({ results: partial, paging: { total: 100 } }, 0);
  assert.equal(parsed.ok, false);
});

test("accepts a full page with more results and advances by the returned count", () => {
  const results = Array.from({ length: 50 }, (_, index) => providerOrder(index + 1));
  const parsed = parseMercadoLivreOrderSearchPage({ results, paging: { total: 51 } }, 0);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.providerTotal, 51);
  assert.equal(parsed.value.hasMore, true);
  assert.equal(parsed.value.nextOffset, 50);
  assert.equal(parsed.value.orders.length, 50);
});

test("accepts a short terminal page only when it reaches the provider total", () => {
  const results = [providerOrder(51), providerOrder(52)];
  const parsed = parseMercadoLivreOrderSearchPage({ results, paging: { total: 52 } }, 50);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.hasMore, false);
  assert.equal(parsed.value.nextOffset, 52);
});

test("rejects provider totals smaller than the requested page range", () => {
  const parsed = parseMercadoLivreOrderSearchPage({
    results: [providerOrder(1), providerOrder(2)],
    paging: { total: 1 },
  }, 0);
  assert.equal(parsed.ok, false);
});

test("preserves full-page continuation when the provider omits paging.total", () => {
  const full = Array.from({ length: 50 }, (_, index) => providerOrder(index + 1));
  const parsed = parseMercadoLivreOrderSearchPage({ results: full }, 0);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.providerTotal, null);
  assert.equal(parsed.value.hasMore, true);
});

test("rejects empty or partial pages when the provider omits total because completion cannot be proven", () => {
  const partial = Array.from({ length: 17 }, (_, index) => providerOrder(index + 1));
  for (const results of [[], partial, Array.from({ length: 49 }, (_, index) => providerOrder(index + 1))]) {
    assert.equal(parseMercadoLivreOrderSearchPage({ results }, 0).ok, false);
    assert.equal(parseMercadoLivreOrderSearchPage({ results, paging: {} }, 0).ok, false);
  }
});

test("never allows a caller to raise the provider page-size cap above 50", () => {
  const results = Array.from({ length: 51 }, (_, index) => providerOrder(index + 1));
  assert.equal(parseMercadoLivreOrderSearchPage({ results }, 0, 51).ok, false);
  assert.equal(parseMercadoLivreOrderSearchPage({ results: [] }, 0, 0).ok, false);
});
