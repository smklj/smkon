/**
 * S18: Tipos de integração do Webhook da Hotmart (Frente C).
 * Suporta Webhook Hotmart 2.0.0 e payloads 1.0/legados.
 */

export type HotmartWebhookEvent =
  | "PURCHASE_APPROVED"
  | "PURCHASE_COMPLETE"
  | "PURCHASE_REFUNDED"
  | "PURCHASE_CHARGEBACK"
  | "PURCHASE_CANCELLED"
  | "PURCHASE_CANCELED"
  | "PURCHASE_EXPIRED"
  | "PURCHASE_BILLET_PRINTED"
  | "PURCHASE_WAITING_PAYMENT"
  | "PURCHASE_DELAYED"
  | "PURCHASE_PROTEST"
  | "SWITCH_PLAN"
  | "SUBSCRIPTION_CANCELLATION";

export type HotmartCommissionSource = "PRODUCER" | "AFFILIATE" | "COPRODUCER" | "MARKETPLACE" | string;

export type HotmartCommission = {
  currency_value?: string;
  source?: HotmartCommissionSource;
  value?: number | string;
};

export type HotmartRawPayload = {
  id?: string;
  creation_date?: number | string;
  event?: string;
  version?: string;
  hottok?: string;
  data?: {
    product?: {
      id?: number | string;
      ucode?: string;
      name?: string;
      has_co_production?: boolean;
    };
    affiliates?: Array<{
      affiliate_code?: string;
      name?: string;
      user_code?: string;
    }>;
    buyer?: {
      email?: string;
      name?: string;
      checkout_phone?: string;
      document?: string;
    };
    producer?: {
      name?: string;
      ucode?: string;
    };
    commissions?: HotmartCommission[];
    purchase?: {
      approved_date?: number | string;
      order_date?: number | string;
      status?: string;
      transaction?: string;
      price?: {
        value?: number | string;
        currency_value?: string;
      };
      full_price?: {
        value?: number | string;
        currency_value?: string;
      };
      original_offer_price?: {
        value?: number | string;
        currency_value?: string;
      };
      payment?: {
        installments_number?: number;
        type?: string;
      };
      recurrency_number?: number;
    };
    subscription?: {
      status?: string;
      subscriber?: { code?: string };
      plan?: { id?: number | string; name?: string };
    };
    hottok?: string;
  };
  // Compatibilidade legada
  transaction?: string;
  status?: string;
  prod_name?: string;
  prod?: number | string;
  price?: number | string;
  cms_vendor?: number | string;
  cms_aff?: number | string;
  currency_code_from?: string;
};

export type HotmartNormalizedEvent = {
  external_id: string;
  event_type: string;
  domain: "owned_sales" | "affiliate";
  currency: string;
  gross_amount: number;
  commission_amount: number;
  fee_amount: number;
  refund_amount: number;
  occurred_at: string;
  payload_hash: string;
  normalization_version: 1;
  order_status?: "pending" | "paid" | "fulfilled" | "cancelled" | "refunded" | "partially_refunded";
  commission_status?: "pending" | "approved" | "settled" | "paid" | "cancelled" | "reversed";
  product_id?: string;
  product_name?: string;
};
