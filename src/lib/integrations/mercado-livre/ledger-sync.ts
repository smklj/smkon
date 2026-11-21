import type { StoredSalesOrder } from "./reconciliation";

export type CanonicalLedgerEntry = {
  domain: "owned_sales";
  entry_type: "sales_gross" | "sales_fee" | "sales_refund";
  source_table: "sales_orders";
  source_id: string;
  currency: string;
  amount: number;
  effective_at: string;
  idempotency_key: string;
};

function round4(val: number): number {
  return Math.round((val + Number.EPSILON) * 10_000) / 10_000;
}

/**
 * Derives canonical, idempotent ledger entry representations from a sales order.
 * Ensures gross sales, fees and refunds are recorded as separate, auditable entries.
 */
export function deriveLedgerEntriesFromOrder(
  order: StoredSalesOrder,
  organizationId: string,
): CanonicalLedgerEntry[] {
  if (!order.id) throw new Error("Order ID is required to generate ledger entries.");
  if (!organizationId) throw new Error("Organization ID is required.");

  const entries: CanonicalLedgerEntry[] = [];
  const currency = order.currency.toUpperCase();

  // Paid or fulfilled orders generate sales_gross
  if (order.order_status === "paid" || order.order_status === "fulfilled") {
    if (order.gross_amount > 0) {
      entries.push({
        domain: "owned_sales",
        entry_type: "sales_gross",
        source_table: "sales_orders",
        source_id: order.id,
        currency,
        amount: round4(order.gross_amount),
        effective_at: order.occurred_at,
        idempotency_key: `${organizationId}:sales_orders:${order.id}:sales_gross`,
      });
    }

    // Platform/sale fee recorded as a separate deduction
    if (order.fee_amount > 0) {
      entries.push({
        domain: "owned_sales",
        entry_type: "sales_fee",
        source_table: "sales_orders",
        source_id: order.id,
        currency,
        amount: round4(-order.fee_amount),
        effective_at: order.occurred_at,
        idempotency_key: `${organizationId}:sales_orders:${order.id}:sales_fee`,
      });
    }
  }

  // Refunds recorded as deductions
  if (
    (order.order_status === "refunded" || order.order_status === "partially_refunded") &&
    order.refund_amount > 0
  ) {
    entries.push({
      domain: "owned_sales",
      entry_type: "sales_refund",
      source_table: "sales_orders",
      source_id: order.id,
      currency,
      amount: round4(-order.refund_amount),
      effective_at: order.occurred_at,
      idempotency_key: `${organizationId}:sales_orders:${order.id}:sales_refund`,
    });
  }

  return entries;
}
