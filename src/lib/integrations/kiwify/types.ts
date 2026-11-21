/**
 * Tipos e Interfaces do Conector de Webhooks Kiwify (Frente E · S24)
 */

export type KiwifyEventType =
  | "order_approved"
  | "pix_generated"
  | "order_refunded"
  | "chargeback"
  | "order_rejected";

export type KiwifyRawPayload = {
  order_id?: string;
  order_ref?: string;
  order_status?: string;
  product_id?: string;
  product_name?: string;
  payment_method?: string; // "pix" | "credit_card" | "boleto"
  created_at?: string;
  approved_date?: string;
  refunded_at?: string;
  Commissions?: {
    charge_amount_cents?: number;
    product_base_price_cents?: number;
    kiwify_fee_cents?: number;
    my_commission_cents?: number;
    currency?: string;
  };
  Customer?: {
    full_name?: string;
    email?: string;
    mobile?: string;
    CPF?: string;
  };
  signature?: string;
  [key: string]: unknown;
};

export type KiwifyNormalizedEvent = {
  platform: "kiwify";
  externalId: string;
  eventType: KiwifyEventType;
  currency: string;
  grossAmountBrl: number;
  platformFeeBrl: number;
  netCommissionBrl: number;
  occurredAt: string;
  paymentMethod: string;
  productId: string;
  productName: string;
  status: "approved" | "pending" | "refunded" | "chargeback" | "rejected";
  payloadHash: string;
};
