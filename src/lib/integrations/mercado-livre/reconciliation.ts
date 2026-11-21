export type StoredSalesOrder = {
  id?: string;
  external_order_id: string;
  order_status: "pending" | "paid" | "fulfilled" | "cancelled" | "refunded" | "partially_refunded";
  currency: string;
  gross_amount: number;
  discount_amount: number;
  fee_amount: number;
  shipping_amount: number;
  refund_amount: number;
  occurred_at: string;
  settled_at?: string | null;
};

export type ReconciliationDiscrepancy = {
  externalOrderId: string;
  issueType:
    | "unsettled_old_paid"
    | "excessive_fee"
    | "refund_exceeds_gross"
    | "currency_mismatch"
    | "unsupported_currency";
  severity: "high" | "medium" | "low";
  description: string;
  orderAmount: number;
};

export type ReconciliationReport = {
  provider: "mercado_livre";
  currency: string;
  period: {
    from: string | null;
    to: string | null;
  };
  totalOrders: number;
  statusCounts: {
    pending: number;
    paid: number;
    fulfilled: number;
    cancelled: number;
    refunded: number;
    partially_refunded: number;
  };
  totals: {
    grossAmount: number;
    feeAmount: number;
    discountAmount: number;
    shippingAmount: number;
    refundAmount: number;
    netEstimatedAmount: number;
    settledAmount: number;
  };
  settledCount: number;
  discrepancies: ReconciliationDiscrepancy[];
  generatedAt: string;
};

function round4(val: number): number {
  return Math.round((val + Number.EPSILON) * 10_000) / 10_000;
}

export function generateReconciliationReport(
  orders: StoredSalesOrder[],
  options: {
    targetCurrency?: string;
    agingDaysThreshold?: number;
    nowDate?: Date;
  } = {},
): ReconciliationReport {
  const targetCurrency = (options.targetCurrency ?? "BRL").toUpperCase();
  const agingDaysThreshold = options.agingDaysThreshold ?? 30;
  const now = options.nowDate ?? new Date();
  const agingMillis = agingDaysThreshold * 24 * 60 * 60 * 1000;

  let earliest: string | null = null;
  let latest: string | null = null;

  const statusCounts = {
    pending: 0,
    paid: 0,
    fulfilled: 0,
    cancelled: 0,
    refunded: 0,
    partially_refunded: 0,
  };

  let grossSum = 0;
  let feeSum = 0;
  let discountSum = 0;
  let shippingSum = 0;
  let refundSum = 0;
  let settledSum = 0;
  let settledCount = 0;

  const discrepancies: ReconciliationDiscrepancy[] = [];

  for (const order of orders) {
    if (!earliest || order.occurred_at < earliest) earliest = order.occurred_at;
    if (!latest || order.occurred_at > latest) latest = order.occurred_at;

    const curr = (order.currency || "").toUpperCase();
    if (curr !== targetCurrency) {
      discrepancies.push({
        externalOrderId: order.external_order_id,
        issueType: "currency_mismatch",
        severity: "medium",
        description: `Order currency ${curr} does not match target report currency ${targetCurrency}`,
        orderAmount: order.gross_amount,
      });
      continue;
    }

    if (order.order_status in statusCounts) {
      statusCounts[order.order_status] += 1;
    }

    grossSum += order.gross_amount;
    feeSum += order.fee_amount;
    discountSum += order.discount_amount;
    shippingSum += order.shipping_amount;
    refundSum += order.refund_amount;

    if (order.settled_at) {
      settledCount += 1;
      settledSum += order.gross_amount;
    } else {
      // Check aging for paid/fulfilled orders that are still unsettled
      if (order.order_status === "paid" || order.order_status === "fulfilled") {
        const orderTime = new Date(order.occurred_at).getTime();
        if (Number.isFinite(orderTime) && now.getTime() - orderTime > agingMillis) {
          discrepancies.push({
            externalOrderId: order.external_order_id,
            issueType: "unsettled_old_paid",
            severity: "high",
            description: `Order paid on ${order.occurred_at} has remained unsettled for more than ${agingDaysThreshold} days`,
            orderAmount: order.gross_amount,
          });
        }
      }
    }

    // Check fee ratio anomaly
    if (order.gross_amount > 0 && order.fee_amount > order.gross_amount * 0.5) {
      discrepancies.push({
        externalOrderId: order.external_order_id,
        issueType: "excessive_fee",
        severity: "medium",
        description: `Fee amount (${order.fee_amount}) exceeds 50% of gross amount (${order.gross_amount})`,
        orderAmount: order.gross_amount,
      });
    }

    // Check refund anomaly
    if (order.refund_amount > order.gross_amount) {
      discrepancies.push({
        externalOrderId: order.external_order_id,
        issueType: "refund_exceeds_gross",
        severity: "high",
        description: `Refund amount (${order.refund_amount}) exceeds gross amount (${order.gross_amount})`,
        orderAmount: order.gross_amount,
      });
    }
  }

  const gross = round4(grossSum);
  const fee = round4(feeSum);
  const discount = round4(discountSum);
  const shipping = round4(shippingSum);
  const refund = round4(refundSum);
  const netEstimated = round4(gross - fee - discount - refund);
  const settledAmount = round4(settledSum);

  return {
    provider: "mercado_livre",
    currency: targetCurrency,
    period: {
      from: earliest,
      to: latest,
    },
    totalOrders: orders.length,
    statusCounts,
    totals: {
      grossAmount: gross,
      feeAmount: fee,
      discountAmount: discount,
      shippingAmount: shipping,
      refundAmount: refund,
      netEstimatedAmount: netEstimated,
      settledAmount,
    },
    settledCount,
    discrepancies,
    generatedAt: now.toISOString(),
  };
}
