import { createHash } from "node:crypto";
import type { HotmartNormalizedEvent, HotmartRawPayload } from "./types.ts";

function roundAmount(value: unknown): number {
  const num = typeof value === "number" ? value : parseFloat(String(value ?? 0));
  if (!Number.isFinite(num) || num < 0 || num > 99_999_999_999_999.9999) {
    return 0;
  }
  return Math.round((num + Number.EPSILON) * 10_000) / 10_000;
}

function parseOccurredAt(dateVal: unknown): string {
  if (typeof dateVal === "number" && dateVal > 0) {
    const d = new Date(dateVal);
    if (Number.isFinite(d.getTime())) return d.toISOString();
  }
  if (typeof dateVal === "string" && dateVal.trim().length > 0) {
    const d = new Date(dateVal);
    if (Number.isFinite(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

/**
 * Normaliza o payload do Webhook da Hotmart de forma estritamente PII-free.
 * Dados de compradores (nome, email, telefone, documentos) são completamente descartados.
 */
export function normalizeHotmartWebhook(
  raw: HotmartRawPayload,
  domain: "owned_sales" | "affiliate",
): HotmartNormalizedEvent {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid Hotmart webhook payload: expected object.");
  }

  // 1. Transaction ID
  const transaction =
    raw.data?.purchase?.transaction ||
    raw.transaction ||
    raw.id ||
    "";
  const externalId = String(transaction).trim();
  if (!externalId || externalId.length > 100 || !/^[A-Za-z0-9_-]+$/.test(externalId)) {
    throw new Error("Invalid or missing Hotmart transaction identifier.");
  }

  // 2. Event Type
  const rawEvent = (raw.event || raw.data?.purchase?.status || raw.status || "PURCHASE_APPROVED")
    .toUpperCase()
    .trim();

  // 3. Currency
  const rawCurrency =
    raw.data?.purchase?.price?.currency_value ||
    raw.data?.commissions?.[0]?.currency_value ||
    raw.currency_code_from ||
    "BRL";
  const currency = String(rawCurrency).toUpperCase().trim();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error(`Invalid Hotmart currency code: ${currency}`);
  }

  // 4. Amounts & Commissions
  const grossAmount = roundAmount(
    raw.data?.purchase?.full_price?.value ??
    raw.data?.purchase?.price?.value ??
    raw.price ??
    0
  );

  let producerCommission = 0;
  let affiliateCommission = 0;
  let feeAmount = 0;

  if (Array.isArray(raw.data?.commissions)) {
    for (const comm of raw.data.commissions) {
      const src = (comm.source || "").toUpperCase();
      const val = roundAmount(comm.value);
      if (src === "PRODUCER") {
        producerCommission += val;
      } else if (src === "AFFILIATE") {
        affiliateCommission += val;
      } else if (src === "MARKETPLACE" || src === "HOTMART") {
        feeAmount += val;
      }
    }
  } else {
    // Compatibilidade com payload 1.0
    if (raw.cms_vendor !== undefined) producerCommission = roundAmount(raw.cms_vendor);
    if (raw.cms_aff !== undefined) affiliateCommission = roundAmount(raw.cms_aff);
  }

  // Se a comissão do produtor não veio explicitada, aproxima: gross - affiliate - fee
  if (domain === "owned_sales" && producerCommission === 0 && grossAmount > 0) {
    producerCommission = Math.max(0, grossAmount - affiliateCommission - feeAmount);
  }

  // Se o afiliado foi indicado mas a comissão do afiliado é zero, use producerCommission para owned_sales
  const commissionAmount = domain === "affiliate" ? affiliateCommission : producerCommission;

  // 5. Date
  const occurredAt = parseOccurredAt(
    raw.data?.purchase?.approved_date ??
    raw.data?.purchase?.order_date ??
    raw.creation_date
  );

  // 6. Status Mapping
  let orderStatus: HotmartNormalizedEvent["order_status"];
  let commissionStatus: HotmartNormalizedEvent["commission_status"];
  let refundAmount = 0;

  if (rawEvent.includes("REFUND")) {
    orderStatus = "refunded";
    commissionStatus = "reversed";
    refundAmount = grossAmount;
  } else if (rawEvent.includes("CHARGEBACK") || rawEvent.includes("PROTEST")) {
    orderStatus = "refunded";
    commissionStatus = "reversed";
    refundAmount = grossAmount;
  } else if (rawEvent.includes("CANCEL") || rawEvent.includes("EXPIRED")) {
    orderStatus = "cancelled";
    commissionStatus = "cancelled";
  } else if (rawEvent === "PURCHASE_COMPLETE") {
    orderStatus = "paid";
    commissionStatus = "settled"; // Liberado para saque após período de garantia S8
  } else if (rawEvent.includes("BILLET") || rawEvent.includes("WAITING") || rawEvent.includes("DELAYED")) {
    orderStatus = "pending";
    commissionStatus = "pending";
  } else {
    // Padrão: PURCHASE_APPROVED
    orderStatus = "paid";
    commissionStatus = "approved";
  }

  // 7. Informações opcionais do produto (PII-free)
  const productId = raw.data?.product?.id ? String(raw.data.product.id) : raw.prod ? String(raw.prod) : undefined;
  const productName = raw.data?.product?.name || raw.prod_name || undefined;

  // 8. Objeto canônico normalizado (sem PII)
  const normalized: Omit<HotmartNormalizedEvent, "payload_hash"> = {
    external_id: externalId,
    event_type: rawEvent,
    domain,
    currency,
    gross_amount: grossAmount,
    commission_amount: commissionAmount,
    fee_amount: feeAmount,
    refund_amount: refundAmount,
    occurred_at: occurredAt,
    normalization_version: 1,
    ...(domain === "owned_sales" ? { order_status: orderStatus } : { commission_status: commissionStatus }),
    ...(productId ? { product_id: productId } : {}),
    ...(productName ? { product_name: productName.slice(0, 200) } : {}),
  };

  // 9. Cálculo determinístico do hash SHA-256
  const payloadHash = createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");

  return {
    ...normalized,
    payload_hash: payloadHash,
  };
}
