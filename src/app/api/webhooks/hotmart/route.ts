import { NextResponse } from "next/server";
import { log } from "@/lib/observability/log";
import { extractHotmartToken, hashHotmartToken, verifyHotmartToken } from "@/lib/integrations/hotmart/validator";
import { normalizeHotmartWebhook } from "@/lib/integrations/hotmart/normalizer";
import {
  findHotmartConnectionById,
  findHotmartConnectionByOrgAndDomain,
  findHotmartConnectionByTokenHash,
  persistHotmartWebhookEvent,
  type HotmartConnectionRecord,
} from "@/lib/integrations/hotmart/repository";
import type { HotmartRawPayload } from "@/lib/integrations/hotmart/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const connectionIdParam = url.searchParams.get("connection_id");
  const orgIdParam = url.searchParams.get("organization_id");
  const domainParam = url.searchParams.get("domain") as "owned_sales" | "affiliate" | null;

  // 1. Parsing do payload JSON
  let raw: HotmartRawPayload;
  try {
    raw = (await request.json()) as HotmartRawPayload;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return NextResponse.json(
        { error: "Payload inválido: esperado objeto JSON.", code: "invalid_payload" },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição não é um JSON válido.", code: "invalid_json" },
      { status: 400 },
    );
  }

  // 2. Extração do token Hottok (header, query string ou payload)
  const presentedToken = extractHotmartToken(request.headers, url.searchParams, raw as Record<string, unknown>);
  if (!presentedToken) {
    log("warn", "hotmart_webhook", { code: "missing_token" });
    return NextResponse.json(
      { error: "Token de autenticação do webhook ausente.", code: "missing_token" },
      { status: 401 },
    );
  }

  // 3. Resolução da conexão e verificação de autenticidade
  let connection: HotmartConnectionRecord | null = null;
  const globalSecret = process.env.HOTMART_WEBHOOK_SECRET;

  try {
    if (connectionIdParam) {
      connection = await findHotmartConnectionById(connectionIdParam, orgIdParam ?? undefined);
      if (connection) {
        // Valida se o hash bate ou se confere com o segredo global
        const tokenHash = hashHotmartToken(presentedToken);
        const connectionByHash = await findHotmartConnectionByTokenHash(tokenHash);
        const hashMatches = connectionByHash?.connectionId === connection.connectionId;
        const globalMatches = verifyHotmartToken(presentedToken, globalSecret);

        if (!hashMatches && !globalMatches) {
          log("warn", "hotmart_webhook", { code: "invalid_token_for_connection", connection_id: connection.connectionId });
          return NextResponse.json(
            { error: "Token não autorizado para esta conexão.", code: "unauthorized" },
            { status: 401 },
          );
        }
      }
    } else if (orgIdParam && domainParam) {
      connection = await findHotmartConnectionByOrgAndDomain(orgIdParam, domainParam);
      if (connection) {
        const tokenHash = hashHotmartToken(presentedToken);
        const connectionByHash = await findHotmartConnectionByTokenHash(tokenHash);
        const hashMatches = connectionByHash?.connectionId === connection.connectionId;
        const globalMatches = verifyHotmartToken(presentedToken, globalSecret);

        if (!hashMatches && !globalMatches) {
          log("warn", "hotmart_webhook", { code: "invalid_token_for_org_domain" });
          return NextResponse.json(
            { error: "Token não autorizado para esta organização.", code: "unauthorized" },
            { status: 401 },
          );
        }
      }
    } else {
      // Lookup automático pelo hash do token
      const tokenHash = hashHotmartToken(presentedToken);
      connection = await findHotmartConnectionByTokenHash(tokenHash);
    }

    // Se nenhuma conexão foi resolvida por hash, testa fallback para segredo global com primeira conexão ativa
    if (!connection && verifyHotmartToken(presentedToken, globalSecret)) {
      if (orgIdParam) {
        connection = await findHotmartConnectionByOrgAndDomain(orgIdParam, domainParam ?? "owned_sales");
      }
    }

    if (!connection) {
      log("warn", "hotmart_webhook", { code: "connection_not_found_or_unauthorized" });
      return NextResponse.json(
        { error: "Conexão Hotmart não encontrada ou não autorizada.", code: "unauthorized" },
        { status: 401 },
      );
    }

    // 4. Normalização PII-free do payload
    const normalized = normalizeHotmartWebhook(raw, connection.domain);

    // 5. Persistência atômica e geração contábil idempotente
    const result = await persistHotmartWebhookEvent({
      connectionId: connection.connectionId,
      organizationId: connection.organizationId,
      event: normalized,
    });

    log("info", "hotmart_webhook", {
      code: "event_persisted",
      domain: connection.domain,
      event_type: normalized.event_type,
      status: result.status,
    });

    return NextResponse.json({
      ok: true,
      event_id: result.event_id,
      domain: result.domain,
      target_id: result.target_id,
      status: result.status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    log("error", "hotmart_webhook", { error: message });

    if (message.includes("hotmart_event_pii_forbidden") || message.includes("Invalid Hotmart")) {
      return NextResponse.json(
        { error: "Payload do evento rejeitado por conter formato inválido.", code: "invalid_event" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Falha interna ao processar o webhook.", code: "internal_error" },
      { status: 500 },
    );
  }
}
