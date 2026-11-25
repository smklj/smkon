import { createHmac, timingSafeEqual } from "node:crypto";
import { log } from "../../observability/log.ts";

export type VerifyMpWebhookParams = {
  xSignatureHeader: string | null;
  xRequestIdHeader: string | null;
  dataId: string | null;
  webhookSecret: string;
};

/**
 * Validação criptográfica de webhook do Mercado Pago.
 * Especificação oficial:
 * 1. Extrai ts e v1 do cabeçalho x-signature (ex: "ts=1700000000,v1=abc123def...")
 * 2. Monta o template: "id:[data.id];request-id:[x-request-id];ts:[ts];"
 * 3. Calcula HMAC-SHA256 com o segredo do webhook configurado
 * 4. Compara com v1 usando timingSafeEqual (tempo constante)
 */
export function verifyMercadoPagoWebhook({
  xSignatureHeader,
  xRequestIdHeader,
  dataId,
  webhookSecret,
}: VerifyMpWebhookParams): boolean {
  if (!webhookSecret) {
    log("warn", "mp.webhook.skip_validation", { reason: "no_secret_configured" });
    return true; // Se o lojista ainda não configurou secret no ambiente de teste
  }

  if (!xSignatureHeader) {
    log("warn", "mp.webhook.missing_signature", {});
    return false;
  }

  const parts = xSignatureHeader.split(",");
  let ts: string | undefined;
  let v1: string | undefined;

  for (const part of parts) {
    const [key, value] = part.trim().split("=");
    if (key === "ts") ts = value;
    if (key === "v1") v1 = value;
  }

  if (!ts || !v1) {
    log("warn", "mp.webhook.malformed_signature_header", { xSignatureHeader });
    return false;
  }

  // Verifica timestamp para prevenir replay attacks (máximo 15 minutos)
  const tsNum = Number(ts);
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsNum) > 900) {
    log("warn", "mp.webhook.expired_signature", { ts, nowSec });
    return false;
  }

  const manifest = `id:${dataId ?? ""};request-id:${xRequestIdHeader ?? ""};ts:${ts};`;
  const computedHash = createHmac("sha256", webhookSecret).update(manifest).digest("hex");

  try {
    const v1Buf = Buffer.from(v1, "hex");
    const computedBuf = Buffer.from(computedHash, "hex");
    if (v1Buf.length !== computedBuf.length) return false;
    return timingSafeEqual(v1Buf, computedBuf);
  } catch (err) {
    log("error", "mp.webhook.comparison_failed", { error: String(err) });
    return false;
  }
}
