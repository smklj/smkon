import { NextResponse } from "next/server";
import { log } from "@/lib/observability/log";
import {
  extractKiwifyToken,
  verifyKiwifyToken,
  normalizeKiwifyWebhook,
  type KiwifyRawPayload,
} from "@/lib/integrations/kiwify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Receptor Kiwify — DESLIGADO por padrão.
 * Ainda não grava em external_events nem no ledger e o esquema de assinatura oficial
 * precisa ser confirmado na documentação da Kiwify. Liga só com KIWIFY_WEBHOOK_ENABLED=true
 * e KIWIFY_WEBHOOK_SECRET próprio (nunca reaproveitado de outro provedor).
 */
export async function POST(request: Request) {
  if (process.env.KIWIFY_WEBHOOK_ENABLED !== "true") {
    return NextResponse.json({ error: "Não encontrado.", code: "not_found" }, { status: 404 });
  }
  const expectedSecret = process.env.KIWIFY_WEBHOOK_SECRET;
  if (!expectedSecret || expectedSecret.trim().length < 16) {
    log("error", "kiwify_webhook", { code: "secret_not_configured" });
    return NextResponse.json({ error: "Webhook indisponível.", code: "not_configured" }, { status: 503 });
  }

  // 1. Parsing do corpo da requisição
  let raw: KiwifyRawPayload;
  try {
    raw = (await request.json()) as KiwifyRawPayload;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return NextResponse.json(
        { error: "Payload inválido: esperado objeto JSON.", code: "invalid_payload" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição não é um JSON válido.", code: "invalid_json" },
      { status: 400 }
    );
  }

  // 2. Extração e validação do token do webhook
  const presentedToken = extractKiwifyToken(request.headers);

  if (!presentedToken || !verifyKiwifyToken(presentedToken, expectedSecret)) {
    log("warn", "kiwify_webhook", { code: "invalid_or_missing_token" });
    return NextResponse.json(
      { error: "Token de autenticação do webhook inválido ou ausente.", code: "unauthorized" },
      { status: 401 }
    );
  }

  // 3. Normalização estritamente PII-free
  try {
    const normalized = normalizeKiwifyWebhook(raw);

    log("info", "kiwify_webhook_received", {
      eventType: normalized.eventType,
      status: normalized.status,
    });

    return NextResponse.json({
      ok: true,
      platform: "kiwify",
      externalId: normalized.externalId,
      status: normalized.status,
      netCommissionBrl: normalized.netCommissionBrl,
      occurredAt: normalized.occurredAt,
    });
  } catch (err) {
    log("error", "kiwify_webhook_error", { message: err instanceof Error ? err.message : "unknown" });
    return NextResponse.json(
      { error: "Payload não reconhecido.", code: "normalization_failed" },
      { status: 422 }
    );
  }
}
