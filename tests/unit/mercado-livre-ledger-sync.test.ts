import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveLedgerEntriesFromOrder,
} from "../../src/lib/integrations/mercado-livre/ledger-sync.ts";
import type { StoredSalesOrder } from "../../src/lib/integrations/mercado-livre/reconciliation.ts";

const orgId = "11111111-2222-3333-4444-555555555555";

test("derives gross and fee ledger entries for paid orders with idempotency keys", () => {
  const order: StoredSalesOrder = {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    external_order_id: "ORD-999",
    order_status: "paid",
    currency: "BRL",
    gross_amount: 250,
    fee_amount: 32.5,
    discount_amount: 0,
    shipping_amount: 0,
    refund_amount: 0,
    occurred_at: "2026-11-21T08:00:00.000Z",
  };

  const entries = deriveLedgerEntriesFromOrder(order, orgId);

  assert.equal(entries.length, 2);

  // Entry 1: sales_gross
  assert.equal(entries[0].domain, "owned_sales");
  assert.equal(entries[0].entry_type, "sales_gross");
  assert.equal(entries[0].source_table, "sales_orders");
  assert.equal(entries[0].source_id, order.id);
  assert.equal(entries[0].amount, 250);
  assert.equal(entries[0].currency, "BRL");
  assert.equal(
    entries[0].idempotency_key,
    `${orgId}:sales_orders:${order.id}:sales_gross`,
  );

  // Entry 2: sales_fee (negative)
  assert.equal(entries[1].domain, "owned_sales");
  assert.equal(entries[1].entry_type, "sales_fee");
  assert.equal(entries[1].amount, -32.5);
  assert.equal(
    entries[1].idempotency_key,
    `${orgId}:sales_orders:${order.id}:sales_fee`,
  );
});

test("derives refund ledger entry for refunded orders", () => {
  const order: StoredSalesOrder = {
    id: "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
    external_order_id: "ORD-REFUND",
    order_status: "refunded",
    currency: "BRL",
    gross_amount: 150,
    fee_amount: 0,
    discount_amount: 0,
    shipping_amount: 0,
    refund_amount: 150,
    occurred_at: "2026-11-20T12:00:00.000Z",
  };

  const entries = deriveLedgerEntriesFromOrder(order, orgId);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].entry_type, "sales_refund");
  assert.equal(entries[0].amount, -150);
  assert.equal(
    entries[0].idempotency_key,
    `${orgId}:sales_orders:${order.id}:sales_refund`,
  );
});

test("does not generate ledger entries for pending or cancelled orders", () => {
  const pendingOrder: StoredSalesOrder = {
    id: "cccccccc-dddd-eeee-ffff-000000000000",
    external_order_id: "ORD-PENDING",
    order_status: "pending",
    currency: "BRL",
    gross_amount: 100,
    fee_amount: 10,
    discount_amount: 0,
    shipping_amount: 0,
    refund_amount: 0,
    occurred_at: "2026-11-21T00:00:00.000Z",
  };

  const cancelledOrder: StoredSalesOrder = {
    id: "dddddddd-eeee-ffff-0000-111111111111",
    external_order_id: "ORD-CANCELLED",
    order_status: "cancelled",
    currency: "BRL",
    gross_amount: 100,
    fee_amount: 0,
    discount_amount: 0,
    shipping_amount: 0,
    refund_amount: 0,
    occurred_at: "2026-11-21T00:00:00.000Z",
  };

  assert.equal(deriveLedgerEntriesFromOrder(pendingOrder, orgId).length, 0);
  assert.equal(deriveLedgerEntriesFromOrder(cancelledOrder, orgId).length, 0);
});
