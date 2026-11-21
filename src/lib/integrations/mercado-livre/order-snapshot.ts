import { createHash } from "node:crypto";

export type MercadoLivreOrderInput = {
  id: number | string;
  status: string;
  currency_id: string;
  total_amount: number;
  date_created: string;
  order_items?: Array<{
    sale_fee?: number | null;
    quantity?: number | null;
  }>;
};

export type MercadoLivreOrderSnapshot = {
  external_order_id: string;
  order_status: "pending" | "paid" | "fulfilled" | "cancelled" | "refunded" | "partially_refunded";
  currency: string;
  gross_amount: number;
  discount_amount: number;
  fee_amount: number;
  shipping_amount: number;
  refund_amount: number;
  occurred_at: string;
  payload_hash: string;
  normalization_version: 1;
};

function amount(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 99_999_999_999_999.9999) {
    throw new Error(`Invalid Mercado Livre ${field}.`);
  }
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}

function mapOrderStatus(status: string): MercadoLivreOrderSnapshot["order_status"] {
  switch (status.trim().toLowerCase()) {
    case "paid":
      return "paid";
    case "partially_refunded":
      return "partially_refunded";
    case "refunded":
      return "refunded";
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "shipped":
    case "delivered":
    case "fulfilled":
      return "fulfilled";
    default:
      return "pending";
  }
}

/**
 * Creates a PII-free, stable snapshot. It intentionally excludes buyer, seller,
 * address, shipping recipient, payment identifiers and the raw provider payload.
 */
export function normalizeMercadoLivreOrder(order: MercadoLivreOrderInput): MercadoLivreOrderSnapshot {
  if (!order || (typeof order.id !== "string" && !Number.isSafeInteger(order.id))) {
    throw new Error("Invalid Mercado Livre order id.");
  }
  const externalOrderId = String(order.id);
  if (!/^[0-9]{1,40}$/.test(externalOrderId)) throw new Error("Invalid Mercado Livre order id.");

  const currency = typeof order.currency_id === "string" ? order.currency_id.toUpperCase() : "";
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Invalid Mercado Livre currency.");

  const occurred = new Date(order.date_created);
  if (!Number.isFinite(occurred.getTime())) throw new Error("Invalid Mercado Livre order date.");

  let fee = 0;
  for (const item of order.order_items ?? []) {
    if (item.sale_fee === undefined || item.sale_fee === null) continue;
    const saleFee = amount(item.sale_fee, "sale fee");
    const quantity = item.quantity ?? 1;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100_000) {
      throw new Error("Invalid Mercado Livre item quantity.");
    }
    fee += saleFee * quantity;
  }

  const normalized = {
    external_order_id: externalOrderId,
    order_status: mapOrderStatus(typeof order.status === "string" ? order.status : ""),
    currency,
    gross_amount: amount(order.total_amount, "total amount"),
    // These remain zero until payment, discount and shipping detail reconciliation is implemented.
    discount_amount: 0,
    fee_amount: amount(fee, "sale fees"),
    shipping_amount: 0,
    refund_amount: 0,
    occurred_at: occurred.toISOString(),
    normalization_version: 1 as const,
  };
  const payloadHash = createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
  return { ...normalized, payload_hash: payloadHash };
}
