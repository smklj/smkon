import assert from "node:assert/strict";
import test from "node:test";
import { normalizeMercadoLivreOrder } from "../../src/lib/integrations/mercado-livre/order-snapshot.ts";

const order = {
  id: 900001,
  status: "paid",
  currency_id: "brl",
  total_amount: 149.9,
  date_created: "2026-11-21T01:00:00.000Z",
  date_last_updated: "2026-11-21T02:00:00.000Z",
  order_items: [{ sale_fee: 6.25, quantity: 2 }],
};

test("normalizes a PII-free order snapshot, item fees and provider update watermark", () => {
  const snapshot = normalizeMercadoLivreOrder(order);
  assert.equal(snapshot.external_order_id, "900001");
  assert.equal(snapshot.order_status, "paid");
  assert.equal(snapshot.currency, "BRL");
  assert.equal(snapshot.gross_amount, 149.9);
  assert.equal(snapshot.fee_amount, 12.5);
  assert.equal(snapshot.discount_amount, 0);
  assert.equal(snapshot.shipping_amount, 0);
  assert.equal(snapshot.refund_amount, 0);
  assert.equal(snapshot.occurred_at, "2026-11-21T01:00:00.000Z");
  assert.equal(snapshot.source_updated_at, "2026-11-21T02:00:00.000Z");
  assert.equal(snapshot.normalization_version, 2);
  assert.match(snapshot.payload_hash, /^[a-f0-9]{64}$/);
  assert.equal("buyer_email" in snapshot, false);
});

test("falls back to creation time when the provider omits last-updated and clamps earlier updates", () => {
  const missing = normalizeMercadoLivreOrder({ ...order, date_last_updated: null });
  assert.equal(missing.source_updated_at, missing.occurred_at);
  const earlier = normalizeMercadoLivreOrder({ ...order, date_last_updated: "2026-11-20T23:00:00.000Z" });
  assert.equal(earlier.source_updated_at, earlier.occurred_at);
});

test("maps lifecycle statuses conservatively", () => {
  assert.equal(normalizeMercadoLivreOrder({ ...order, status: "delivered" }).order_status, "fulfilled");
  assert.equal(normalizeMercadoLivreOrder({ ...order, status: "canceled" }).order_status, "cancelled");
  assert.equal(normalizeMercadoLivreOrder({ ...order, status: "partially_refunded" }).order_status, "partially_refunded");
  assert.equal(normalizeMercadoLivreOrder({ ...order, status: "unknown_provider_state" }).order_status, "pending");
});

test("hash changes when normalized values or provider version change but is stable for the same snapshot", () => {
  const first = normalizeMercadoLivreOrder(order);
  const replay = normalizeMercadoLivreOrder({ ...order });
  const changedStatus = normalizeMercadoLivreOrder({ ...order, status: "cancelled" });
  const changedVersion = normalizeMercadoLivreOrder({ ...order, date_last_updated: "2026-11-21T03:00:00.000Z" });
  assert.equal(first.payload_hash, replay.payload_hash);
  assert.notEqual(first.payload_hash, changedStatus.payload_hash);
  assert.notEqual(first.payload_hash, changedVersion.payload_hash);
});

test("rejects invalid identifiers, currency, dates, amounts and item quantities", () => {
  assert.throws(() => normalizeMercadoLivreOrder({ ...order, id: Number.MAX_SAFE_INTEGER + 1 }));
  assert.throws(() => normalizeMercadoLivreOrder({ ...order, currency_id: "R$" }));
  assert.throws(() => normalizeMercadoLivreOrder({ ...order, date_created: "not-a-date" }));
  assert.throws(() => normalizeMercadoLivreOrder({ ...order, date_last_updated: "not-a-date" }));
  assert.throws(() => normalizeMercadoLivreOrder({ ...order, total_amount: -1 }));
  assert.throws(() => normalizeMercadoLivreOrder({ ...order, order_items: [{ sale_fee: 1, quantity: 0 }] }));
});
