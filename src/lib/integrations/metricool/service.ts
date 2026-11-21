import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "../../supabase/service.ts";
import { resolveCapabilities, type SocialAccountType, type SocialNetwork } from "../registry.ts";
import { createMetricoolClient, type MetricoolClient } from "./client.ts";
import type { MetricoolSyncAccountItem } from "./types.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedServiceClient = SupabaseClient<any, any, any>;

function getAdminClient(): UntypedServiceClient {
  const client = createServiceClient();
  if (!client) throw new Error("SMKON service database is not configured.");
  return client as unknown as UntypedServiceClient;
}

/**
 * Normaliza o tipo de conta retornado pelo Metricool para respeitar as restrições do S17:
 * - Instagram e Threads: 'business' ou 'creator'
 * - Facebook: 'page'
 * - YouTube: 'channel'
 * - Pinterest, TikTok, LinkedIn: mapeados adequadamente
 */
function normalizeMetricoolAccountType(network: SocialNetwork, rawType?: string): SocialAccountType | null {
  const type = (rawType || "").toLowerCase().trim();
  switch (network) {
    case "instagram":
    case "threads":
      if (type === "creator") return "creator";
      return "business"; // padrão seguro para contas profissionais
    case "facebook":
      return "page";
    case "youtube":
      return "channel";
    case "tiktok":
    case "pinterest":
      return type === "creator" ? "creator" : "business";
    case "linkedin":
      return type === "personal" ? "personal" : "page";
    case "x":
      return null; // X nunca via Metricool
    default:
      return null;
  }
}

/**
 * Sincroniza contas sociais do Metricool para a tabela social_accounts da organização.
 */
export async function syncMetricoolAccountsForOrg(
  organizationId: string,
  options?: {
    client?: MetricoolClient;
    blogId?: string;
  },
): Promise<{ syncedCount: number }> {
  if (!organizationId) throw new Error("Invalid organizationId.");
  const db = getAdminClient();

  // 1. Busca credenciais da organização
  let blogId = options?.blogId;
  let client = options?.client;

  if (!client) {
    const { data: creds, error: credError } = await db
      .from("metricool_credentials")
      .select("blog_id, encrypted_token")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (credError || !creds) {
      throw new Error("Metricool credentials not configured for this organization.");
    }

    blogId = creds.blog_id;
    const token = (creds.encrypted_token as Record<string, string>)?.token || process.env.METRICOOL_USER_TOKEN;
    if (!token) throw new Error("Metricool token is missing.");
    client = createMetricoolClient({ userToken: token });
  }

  if (!blogId) throw new Error("Metricool blogId is missing.");

  // 2. Consulta provedores conectados no Metricool
  const rawAccounts = await client.listConnectedAccounts(blogId);

  // 3. Normaliza e filtra contas segundo o catálogo do S17
  const validItems: MetricoolSyncAccountItem[] = [];

  for (const raw of rawAccounts) {
    const net = raw.network as SocialNetwork;
    if (!["instagram", "facebook", "tiktok", "youtube", "pinterest", "linkedin", "threads"].includes(net)) {
      continue;
    }

    const accountType = normalizeMetricoolAccountType(net, raw.accountType);
    if (!accountType) continue;

    const capabilities = resolveCapabilities(net, accountType, "metricool");
    if (!capabilities || capabilities.length === 0) continue;

    validItems.push({
      network: net,
      account_type: accountType,
      external_account_id: raw.id || `mc_${net}_${raw.username || "acc"}`,
      handle: raw.username || null,
      display_name: raw.name || raw.username || null,
      capabilities,
    });
  }

  // 4. Executa RPC de sincronização em lote no banco
  const { data: syncedCount, error: syncError } = await db.rpc("metricool_sync_social_accounts", {
    p_organization_id: organizationId,
    p_accounts: validItems,
  });

  if (syncError) {
    throw new Error(`Failed to sync Metricool accounts: ${syncError.message}`);
  }

  return { syncedCount: Number(syncedCount ?? 0) };
}

export type ActionExecutionResult =
  | { ok: true; externalRef: string }
  | { ok: false; errorCode: string; message: string };

/**
 * Reivindica e executa um pedido de ação externa aprovado (service_role).
 */
export async function executeExternalActionRequest(
  requestId: string,
  options?: { client?: MetricoolClient; blogId?: string },
): Promise<ActionExecutionResult> {
  const db = getAdminClient();

  // 1. Reivindica o pedido aprovado via RPC atômica (re-confere hash aprovado)
  const { data: request, error: claimError } = await db.rpc("claim_external_action", {
    p_request_id: requestId,
  });

  if (claimError || !request) {
    return { ok: false, errorCode: "action_request_not_claimable", message: claimError?.message || "Não pôde reivindicar pedido" };
  }

  try {
    // 2. Busca a conta social de destino
    const { data: account, error: accError } = await db
      .from("social_accounts")
      .select("network, account_type, via, external_account_id")
      .eq("id", request.social_account_id)
      .single();

    if (accError || !account) {
      await db.rpc("finish_external_action", {
        p_request_id: requestId,
        p_ok: false,
        p_error_code: "account_not_found",
      });
      return { ok: false, errorCode: "account_not_found", message: "Conta social associada não encontrada" };
    }

    if (account.via !== "metricool") {
      await db.rpc("finish_external_action", {
        p_request_id: requestId,
        p_ok: false,
        p_error_code: "native_api_not_implemented",
      });
      return { ok: false, errorCode: "native_api_not_implemented", message: "API nativa ainda não configurada" };
    }

    // 3. Execução via Metricool
    let client = options?.client;
    let blogId = options?.blogId;

    if (!client) {
      const { data: creds } = await db
        .from("metricool_credentials")
        .select("blog_id, encrypted_token")
        .eq("organization_id", request.organization_id)
        .maybeSingle();

      blogId = creds?.blog_id;
      const token = (creds?.encrypted_token as Record<string, string>)?.token || process.env.METRICOOL_USER_TOKEN;
      if (!token || !blogId) {
        throw new Error("Credenciais do Metricool não configuradas para o workspace.");
      }
      client = createMetricoolClient({ userToken: token });
    }

    if (!blogId) throw new Error("Metricool blogId ausente.");

    const payload = request.payload as Record<string, unknown>;
    const text = typeof payload.caption === "string" ? payload.caption : "";
    const mediaUrls = Array.isArray(payload.mediaUrls) ? (payload.mediaUrls as string[]) : [];

    const result = await client.publishPost(blogId, {
      network: account.network as SocialNetwork,
      text,
      mediaUrls,
    });

    // 4. Conclui com sucesso via RPC
    await db.rpc("finish_external_action", {
      p_request_id: requestId,
      p_ok: true,
      p_external_ref: result.id,
    });

    return { ok: true, externalRef: result.id };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "execution_failed";
    await db.rpc("finish_external_action", {
      p_request_id: requestId,
      p_ok: false,
      p_error_code: "execution_error",
    });
    return { ok: false, errorCode: "execution_error", message: errorMsg };
  }
}
