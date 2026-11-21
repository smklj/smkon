import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "../../supabase/service.ts";
import { resolveCapabilities, type SocialAccountType, type SocialNetwork } from "../registry.ts";
import type { MetricoolClient } from "./client.ts";
import type { MetricoolSyncAccountItem } from "./types.ts";
import { executeApprovedAction, loadOrgCredentials } from "./executor.ts";


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
    const loaded = await loadOrgCredentials(db, organizationId);
    blogId = loaded.blogId;
    client = loaded.client;
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

export type { ActionExecutionResult } from "./executor.ts";

/** Executa um pedido aprovado do workspace de quem chamou, com a chave de serviço. */
export async function executeExternalActionRequest(
  requestId: string,
  organizationId: string,
  options?: { client?: MetricoolClient; blogId?: string },
) {
  return executeApprovedAction(getAdminClient(), requestId, organizationId, options);
}
