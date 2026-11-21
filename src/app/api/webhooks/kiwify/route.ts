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

export async function POST(request: Request) {
  const url = new URL(request.url);

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
  const presentedToken = extractKiwifyToken(
    request.headers,
    url.searchParams,
    raw as Record<string, unknown>
  );

  const expectedSecret = process.env.KIWIFY_WEBHOOK_SECRET || process.env.HOTMART_WEBHOOK_SECRET || "smkon_kiwify_dev_secret";

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
      externalId: normalized.externalId,
      eventType: normalized.eventType,
      status: normalized.status,
      grossAmountBrl: normalized.grossAmountBrl,
      netCommissionBrl: normalized.netCommissionBrl,
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
    const message = err instanceof Error ? err.message : "Erro ao processar webhook Kiwify.";
    log("error", "kiwify_webhook_error", { message });
    return NextResponse.json(
      { error: message, code: "normalization_failed" },
      { status: 422 }
    );
  }
}
