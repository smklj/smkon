import assert from "node:assert/strict";
import test from "node:test";
import {
  MERCADO_LIVRE_ORDER_PAGE_SIZE,
  MERCADO_LIVRE_ORDER_MAX_OFFSET,
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
  assert.equal(parseMercadoLivreOrderSyncPageRequest({ createdFrom: "not-a-date", createdTo: "2026-11-21T04:00:00Z" }, now).ok, false);\n  assert.equal(parseMercadoLivreOrderSyncPageRequest({ createdFrom: "2025-11-21T04:00:00", createdTo: "2026-11-21T04:00:00Z" }, now).ok, false);
});

test("offset is bounded and must align to a 50-order page", () => {
  assert.equal(parseMercadoLivreOrderSyncPageRequest({ offset: -50 }, now).ok, false);
  assert.equal(parseMercadoLivreOrderSyncPageRequest({ offset: 51 }, now).ok, false);
  assert.equal(parseMercadoLivreOrderSyncPageRequest({ offset: MERCADO_LIVRE_ORDER_MAX_OFFSET + 50 }, now).ok, false);
  assert.equal(parseMercadoLivreOrderSyncPageRequest({ offset: 100 }, now).ok, true);
});
