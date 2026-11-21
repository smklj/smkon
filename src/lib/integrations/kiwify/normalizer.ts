/**
 * Normalizador de Webhooks Kiwify (Frente E · S24)
 * Conversão para o formato contábil canônico com descarte estrito de PII.
 */

import { createHash } from "node:crypto";
import type { KiwifyNormalizedEvent, KiwifyRawPayload, KiwifyEventType } from "./types.ts";

function roundAmount(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseOccurredAt(dateVal: unknown): string {
  if (typeof dateVal === "string" && dateVal.trim().length > 0) {
    const d = new Date(dateVal);
    if (Number.isFinite(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

export function normalizeKiwifyWebhook(raw: KiwifyRawPayload): KiwifyNormalizedEvent {
  if (!raw || typeof raw !== "object") {
    throw new Error("Payload do webhook Kiwify inválido: esperado objeto JSON.");
  }

  // 1. Transaction ID
  const orderId = raw.order_id || raw.order_ref || "";
  const externalId = String(orderId).trim();
  if (!externalId || externalId.length > 100) {
    throw new Error("Identificador de transação Kiwify inválido ou ausente.");
  }

  // 2. Classificação de Status & Evento
  const rawStatus = String(raw.order_status || "").toLowerCase().trim();
  let eventType: KiwifyEventType = "order_approved";
  let status: KiwifyNormalizedEvent["status"] = "approved";

  if (rawStatus.includes("refunded") || rawStatus.includes("estornado")) {
    eventType = "order_refunded";
    status = "refunded";
  } else if (rawStatus.includes("chargeback")) {
    eventType = "chargeback";
    status = "chargeback";
  } else if (rawStatus.includes("waiting_payment") || rawStatus.includes("pending")) {
    eventType = "pix_generated";
    status = "pending";
  } else if (rawStatus.includes("rejected") || rawStatus.includes("recusado")) {
    eventType = "order_rejected";
    status = "rejected";
  } else {
    eventType = "order_approved";
    status = "approved";
  }

  // 3. Valores Financeiros (centavos -> BRL)
  const comms = raw.Commissions || {};
  const grossCents = comms.charge_amount_cents ?? comms.product_base_price_cents ?? 0;
  const feeCents = comms.kiwify_fee_cents ?? 0;
  const netCents = comms.my_commission_cents ?? Math.max(0, grossCents - feeCents);

  const grossAmountBrl = roundAmount(grossCents / 100);
  const platformFeeBrl = roundAmount(feeCents / 100);
  const netCommissionBrl = roundAmount(netCents / 100);

  // 4. Data do Evento
  const occurredAt = parseOccurredAt(raw.approved_date || raw.refunded_at || raw.created_at);

  // 5. Payload Hash PII-free para idempotência
  const piiFreeSummary = JSON.stringify({
    order_id: externalId,
    status: rawStatus,
    grossCents,
    feeCents,
    netCents,
    productId: raw.product_id || "",
    paymentMethod: raw.payment_method || "",
    occurredAt,
  });
  const payloadHash = createHash("sha256").update(piiFreeSummary, "utf8").digest("hex");

  return {
    platform: "kiwify",
    externalId,
    eventType,
    currency: (comms.currency || "BRL").toUpperCase(),
    grossAmountBrl,
    platformFeeBrl,
    netCommissionBrl,
    occurredAt,
    paymentMethod: String(raw.payment_method || "pix").toLowerCase(),
    productId: String(raw.product_id || ""),
    productName: String(raw.product_name || "Infoproduto Digital"),
    status,
    payloadHash,
  };
}
