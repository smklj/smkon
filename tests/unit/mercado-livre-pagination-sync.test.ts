import assert from "node:assert/strict";
import test from "node:test";
import { executePaginatedSync, type MercadoLivreOrderPage } from "../../src/lib/integrations/mercado-livre/sync.ts";
import type { MercadoLivreOrderSnapshot } from "../../src/lib/integrations/mercado-livre/order-snapshot.ts";

function createMockPage(pageIndex: number, totalOrders: number, pageSize: number): MercadoLivreOrderPage {
  const startId = pageIndex * pageSize + 1;
  const count = Math.min(pageSize, Math.max(0, totalOrders - pageIndex * pageSize));
  const results = Array.from({ length: count }, (_, i) => ({
    id: startId + i,
    status: "paid",
    currency_id: "BRL",
    total_amount: 100 + i,
    date_created: `2026-11-21T10:${String(i).padStart(2, "0")}:00.000Z`,
    order_items: [{ sale_fee: 10, quantity: 1 }],
  }));

  return {
    paging: {
      total: totalOrders,
      offset: pageIndex * pageSize,
      limit: pageSize,
    },
    results,
  };
}

test("paginates across multiple pages and accumulates checkpoints", async () => {
  const total = 120;
  const pageSize = 50;
  const persistedBatches: MercadoLivreOrderSnapshot[][] = [];

  const fetchPage = async ({ offset }: { offset: number }) => {
    const pageIndex = Math.floor(offset / pageSize);
    return createMockPage(pageIndex, total, pageSize);
  };

  const persistSnapshots = async (snapshots: MercadoLivreOrderSnapshot[]) => {
    persistedBatches.push(snapshots);
    return snapshots.length;
  };

  const result = await executePaginatedSync(fetchPage, persistSnapshots, "123456", {
    pageSize,
    maxPages: 5,
  });

  assert.equal(result.success, true);
  assert.equal(result.pagesProcessed, 3); // 50 + 50 + 20 = 120
  assert.equal(result.ordersFetched, 120);
  assert.equal(result.ordersPersisted, 120);
  assert.equal(result.totalProviderOrders, 120);
  assert.equal(result.hasMore, false);
  assert.equal(result.nextOffset, null);
  assert.equal(result.checkpoints.length, 3);
  assert.equal(result.checkpoints[0].offset, 0);
  assert.equal(result.checkpoints[0].batchSize, 50);
  assert.equal(result.checkpoints[1].offset, 50);
  assert.equal(result.checkpoints[1].batchSize, 50);
  assert.equal(result.checkpoints[2].offset, 100);
  assert.equal(result.checkpoints[2].batchSize, 20);
});

test("respects maxPages limit and returns nextOffset for resumption", async () => {
  const total = 200;
  const pageSize = 50;

  const fetchPage = async ({ offset }: { offset: number }) => {
    const pageIndex = Math.floor(offset / pageSize);
    return createMockPage(pageIndex, total, pageSize);
  };

  const result = await executePaginatedSync(fetchPage, null, "123456", {
    pageSize,
    maxPages: 2,
    dryRun: true,
  });

  assert.equal(result.success, true);
  assert.equal(result.pagesProcessed, 2);
  assert.equal(result.ordersFetched, 100);
  assert.equal(result.hasMore, true);
  assert.equal(result.nextOffset, 100);
  assert.equal(result.stoppedReason, "max_pages_reached");
});

test("handles empty page gracefully", async () => {
  const fetchPage = async () => ({ paging: { total: 0 }, results: [] });

  const result = await executePaginatedSync(fetchPage, null, "123456");

  assert.equal(result.success, true);
  assert.equal(result.pagesProcessed, 0);
  assert.equal(result.ordersFetched, 0);
  assert.equal(result.hasMore, false);
  assert.equal(result.stoppedReason, "empty_page");
});

test("preserves checkpoints and returns nextOffset when error occurs on page 2", async () => {
  let callCount = 0;
  const fetchPage = async () => {
    callCount += 1;
    if (callCount === 2) throw new Error("Upstream network timeout");
    return createMockPage(0, 100, 50);
  };

  const result = await executePaginatedSync(fetchPage, null, "123456", { pageSize: 50 });

  assert.equal(result.success, false);
  assert.equal(result.pagesProcessed, 1);
  assert.equal(result.ordersFetched, 50);
  assert.equal(result.checkpoints.length, 1);
  assert.equal(result.nextOffset, 50);
  assert.equal(result.stoppedReason, "error");
  assert.match(result.error ?? "", /Upstream network timeout/);
});
