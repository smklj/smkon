import { log } from "../../observability/log.ts";
import type {
  MercadoPagoPayer,
  MercadoPagoPaymentItem,
  MercadoPagoPixResponse,
  MercadoPagoPreferenceResponse,
} from "./types";

const MP_BASE_URL = "https://api.mercadopago.com";

export function getMercadoPagoAccessToken(overrideToken?: string): string | null {
  return overrideToken || process.env.MERCADO_PAGO_ACCESS_TOKEN || null;
}

export type CreatePixPaymentParams = {
  orderCode: string;
  amountCents: number;
  payer: MercadoPagoPayer;
  accessToken?: string;
  webhookUrl?: string;
};

export async function createPixPayment({
  orderCode,
  amountCents,
  payer,
  accessToken,
  webhookUrl,
}: CreatePixPaymentParams): Promise<MercadoPagoPixResponse> {
  const token = getMercadoPagoAccessToken(accessToken);
  const amountReais = Number((amountCents / 100).toFixed(2));

  // Simulação segura caso ainda não haja credenciais configuradas em desenvolvimento
  if (!token) {
    log("warn", "mp.createPix.dry_run", { orderCode, reason: "no_token_configured" });
    const dummyQr = `00020126580014br.gov.bcb.pix0136smkon-${orderCode}520400005303986540${amountReais}5802BR5916SMKON LOJA OFICIAL6009SAO PAULO62070503***6304ABCD`;
    return {
      id: `sim_mp_${orderCode}`,
      status: "pending",
      qr_code: dummyQr,
      qr_code_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      ticket_url: `https://smkon.com.br/loja/pedido/${orderCode}`,
      date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  }

  const payload = {
    transaction_amount: amountReais,
    description: `Pedido SMKON #${orderCode}`,
    payment_method_id: "pix",
    external_reference: orderCode,
    payer: {
      email: payer.email,
      first_name: payer.first_name || payer.email.split("@")[0],
      last_name: payer.last_name || "Cliente",
      identification: payer.identification
        ? {
            type: payer.identification.type,
            number: payer.identification.number.replace(/\D/g, ""),
          }
        : undefined,
    },
    notification_url: webhookUrl || (process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago` : undefined),
  };

  const res = await fetch(`${MP_BASE_URL}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `pix_${orderCode}_${amountCents}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    log("error", "mp.createPix.failed", { status: res.status, errorText, orderCode });
    throw new Error(`Falha ao gerar cobrança PIX: ${res.statusText}`);
  }

  const data = await res.json();
  const poi = data.point_of_interaction?.transaction_data;

  return {
    id: data.id,
    status: data.status,
    status_detail: data.status_detail,
    qr_code: poi?.qr_code || "",
    qr_code_base64: poi?.qr_code_base64 || "",
    ticket_url: poi?.ticket_url || data.transaction_details?.external_resource_url,
    date_of_expiration: data.date_of_expiration,
  };
}

export type CreatePreferenceParams = {
  orderCode: string;
  items: MercadoPagoPaymentItem[];
  payer: MercadoPagoPayer;
  accessToken?: string;
  shippingAmountCents?: number;
  returnBaseUrl?: string;
};

export async function createPreference({
  orderCode,
  items,
  payer,
  accessToken,
  shippingAmountCents = 0,
  returnBaseUrl = "https://smkon.com.br",
}: CreatePreferenceParams): Promise<MercadoPagoPreferenceResponse> {
  const token = getMercadoPagoAccessToken(accessToken);

  if (!token) {
    return {
      id: `pref_sim_${orderCode}`,
      init_point: `${returnBaseUrl}/loja/pedido/${orderCode}`,
      sandbox_init_point: `${returnBaseUrl}/loja/pedido/${orderCode}`,
    };
  }

  const preferenceItems = items.map((i) => ({
    id: i.id,
    title: i.title,
    description: i.description,
    quantity: i.quantity,
    unit_price: i.unit_price,
    currency_id: "BRL",
  }));

  if (shippingAmountCents > 0) {
    preferenceItems.push({
      id: "shipping",
      title: "Frete e Envio",
      description: "Serviço de frete e envio",
      quantity: 1,
      unit_price: Number((shippingAmountCents / 100).toFixed(2)),
      currency_id: "BRL",
    });
  }

  const payload = {
    items: preferenceItems,
    payer: {
      email: payer.email,
      name: `${payer.first_name || ""} ${payer.last_name || ""}`.trim(),
      identification: payer.identification
        ? {
            type: payer.identification.type,
            number: payer.identification.number.replace(/\D/g, ""),
          }
        : undefined,
    },
    back_urls: {
      success: `${returnBaseUrl}/loja/pedido/${orderCode}?status=success`,
      pending: `${returnBaseUrl}/loja/pedido/${orderCode}?status=pending`,
      failure: `${returnBaseUrl}/loja/pedido/${orderCode}?status=failure`,
    },
    auto_return: "approved",
    external_reference: orderCode,
    statement_descriptor: "SMKON LOJA",
  };

  const res = await fetch(`${MP_BASE_URL}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    log("error", "mp.createPreference.failed", { status: res.status, errorText, orderCode });
    throw new Error(`Falha ao iniciar checkout: ${res.statusText}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    init_point: data.init_point,
    sandbox_init_point: data.sandbox_init_point,
  };
}

export async function getMercadoPagoPayment(
  paymentId: string | number,
  accessToken?: string,
): Promise<Record<string, unknown> | null> {
  const token = getMercadoPagoAccessToken(accessToken);
  if (!token) return null;

  const res = await fetch(`${MP_BASE_URL}/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    log("error", "mp.getPayment.failed", { paymentId, status: res.status });
    return null;
  }

  return res.json();
}
