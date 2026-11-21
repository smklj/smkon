import assert from "node:assert/strict";
import test from "node:test";
import {
  generateReconciliationReport,
  type StoredSalesOrder,
} from "../../src/lib/integrations/mercado-livre/reconciliation.ts";

const sampleOrders: StoredSalesOrder[] = [
  {
    external_order_id: "ORD-001",
    order_status: "paid",
    currency: "BRL",
    gross_amount: 200,
    fee_amount: 25,
    discount_amount: 0,
    shipping_amount: 0,
    refund_amount: 0,
    occurred_at: "2026-11-20T10:00:00.000Z",
    settled_at: "2026-11-21T10:00:00.000Z",
  },
  {
    external_order_id: "ORD-002",
    order_status: "fulfilled",
    currency: "BRL",
    gross_amount: 350,
    fee_amount: 45,
    discount_amount: 10,
    shipping_amount: 15,
    refund_amount: 0,
    occurred_at: "2026-11-19T14:00:00.000Z",
    settled_at: null,
  },
  {
    external_order_id: "ORD-003",
    order_status: "cancelled",
    currency: "BRL",
    gross_amount: 100,
    fee_amount: 0,
    discount_amount: 0,
    shipping_amount: 0,
    refund_amount: 0,
    occurred_at: "2026-11-18T09:00:00.000Z",
    settled_at: null,
  },
  {
    external_order_id: "ORD-004",
    order_status: "refunded",
    currency: "BRL",
    gross_amount: 150,
    fee_amount: 15,
    discount_amount: 0,
    shipping_amount: 0,
    refund_amount: 150,
    occurred_at: "2026-11-15T12:00:00.000Z",
    settled_at: null,
  },
];

test("generates accurate totals and breakdown by status", () => {
  const report = generateReconciliationReport(sampleOrders);

  assert.equal(report.provider, "mercado_livre");
  assert.equal(report.currency, "BRL");
  assert.equal(report.totalOrders, 4);

  assert.equal(report.statusCounts.paid, 1);
  assert.equal(report.statusCounts.fulfilled, 1);
  assert.equal(report.statusCounts.cancelled, 1);
  assert.equal(report.statusCounts.refunded, 1);

  assert.equal(report.totals.grossAmount, 800);
  assert.equal(report.totals.feeAmount, 85);
  assert.equal(report.totals.discountAmount, 10);
  assert.equal(report.totals.shippingAmount, 15);
  assert.equal(report.totals.refundAmount, 150);

  // Net: 800 - 85 - 10 - 150 = 555
  assert.equal(report.totals.netEstimatedAmount, 555);
  assert.equal(report.settledCount, 1);
  assert.equal(report.totals.settledAmount, 200);
});

test("detects aging discrepancy for paid orders older than threshold without settlement", () => {
  const testNow = new Date("2026-11-21T12:00:00.000Z");
  const oldPaidOrder: StoredSalesOrder = {
    external_order_id: "OLD-001",
    order_status: "paid",
    currency: "BRL",
    gross_amount: 500,
    fee_amount: 50,
    discount_amount: 0,
    shipping_amount: 0,
    refund_amount: 0,
    occurred_at: "2026-10-01T00:00:00.000Z", // ~50 days ago
    settled_at: null,
  };

  const report = generateReconciliationReport([oldPaidOrder], {
    nowDate: testNow,
    agingDaysThreshold: 30,
  });

  assert.equal(report.discrepancies.length, 1);
  assert.equal(report.discrepancies[0].issueType, "unsettled_old_paid");
  assert.equal(report.discrepancies[0].severity, "high");
  assert.match(report.discrepancies[0].description, /unsettled for more than 30 days/);
});

test("detects fee ratio and refund anomalies without dropping orders", () => {
  const anomalyOrders: StoredSalesOrder[] = [
    {
      external_order_id: "FEE-ANOMALY",
      order_status: "paid",
      currency: "BRL",
      gross_amount: 100,
      fee_amount: 60, // 60% fee
      discount_amount: 0,
      shipping_amount: 0,
      refund_amount: 0,
      occurred_at: "2026-11-21T00:00:00.000Z",
    },
    {
      external_order_id: "REFUND-ANOMALY",
      order_status: "refunded",
      currency: "BRL",
      gross_amount: 100,
      fee_amount: 10,
      discount_amount: 0,
      shipping_amount: 0,
      refund_amount: 120, // refund > gross
      occurred_at: "2026-11-21T00:00:00.000Z",
    },
  ];

  const report = generateReconciliationReport(anomalyOrders);
  const feeAnomaly = report.discrepancies.find((d) => d.issueType === "excessive_fee");
  const refundAnomaly = report.discrepancies.find((d) => d.issueType === "refund_exceeds_gross");

  assert.ok(feeAnomaly, "Excessive fee discrepancy must be flagged");
  assert.ok(refundAnomaly, "Excessive refund discrepancy must be flagged");
});
