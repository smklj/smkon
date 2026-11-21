import assert from "node:assert/strict";
import test from "node:test";
import { normalizeMercadoLivreOrder } from "../../src/lib/integrations/mercado-livre/order-snapshot.ts";

const order = {
  id: 900001,
  status: "paid",
  currency_id: "brl",
  total_amount: 149.9,
  date_created: "2026-11-21T01:00:00.000Z",
  order_items: [{ sale_fee: 6.25, quantity: 2 }],
};

test("normalizes a PII-free order snapshot and aggregates item fees", () => {
  const snapshot = normalizeMercadoLivreOrder(order);
  assert.equal(snapshot.external_order_id, "900001");
  assert.equal(snapshot.order_status, "paid");
  assert.equal(snapshot.currency, "BRL");
  assert.equal(snapshot.gross_amount, 149.9);
  assert.equal(snapshot.fee_amount, 12.5);
  assert.equal(snapshot.discount_amount, 0);
  assert.equal(snapshot.shipping_amount, 0);
  assert.equal(snapshot.refund_amount, 0);
  assert.equal(snapshot.normalization_version, 1);
  assert.match(snapshot.payload_hash, /^[a-f0-9]{64}$/);
  assert.equal("buyer_email" in snapshot, false);
});

test("maps lifecycle statuses conservatively", () => {
  assert.equal(normalizeMercadoLivreOrder({ ...order, status: "delivered" }).order_status, "fulfilled");
  assert.equal(normalizeMercadoLivreOrder({ ...order, status: "canceled" }).order_status, "cancelled");
  assert.equal(normalizeMercadoLivreOrder({ ...order, status: "partially_refunded" }).order_status, "partially_refunded");
  assert.equal(normalizeMercadoLivreOrder({ ...order, status: "unknown_provider_state" }).order_status, "pending");
});

test("hash changes when normalized values change but is stable for the same snapshot", () => {
  const first = normalizeMercadoLivreOrder(order);
  const replay = normalizeMercadoLivreOrder({ ...order });
  const changed = normalizeMercadoLivreOrder({ ...order, status: "cancelled" });
  assert.equal(first.payload_hash, replay.payload_hash);
  assert.notEqual(first.payload_hash, changed.payload_hash);
});

test("rejects invalid identifiers, currency, date, amounts and item quantities", () => {
  assert.throws(() => normalizeMercadoLivreOrder({ ...order, id: Number.MAX_SAFE_INTEGER + 1 }));
  assert.throws(() => normalizeMercadoLivreOrder({ ...order, currency_id: "R$" }));
  assert.throws(() => normalizeMercadoLivreOrder({ ...order, date_created: "not-a-date" }));
  assert.throws(() => normalizeMercadoLivreOrder({ ...order, total_amount: -1 }));
  assert.throws(() => normalizeMercadoLivreOrder({ ...order, order_items: [{ sale_fee: 1, quantity: 0 }] }));
});
