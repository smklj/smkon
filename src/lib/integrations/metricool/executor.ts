import type { SupabaseClient } from "@supabase/supabase-js";
import type { SocialNetwork } from "../registry.ts";
import { createMetricoolClient, type MetricoolClient } from "./client.ts";
import { loadMetricoolKeyring, openMetricoolToken } from "./credentials.ts";
import { MEDIA_BUCKET } from "../../media/types.ts";

/**
 * Execução de ações externas aprovadas via Metricool. Sem "server-only" para ser testável;
 * quem chama em produção é service.ts, que injeta o cliente de serviço.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ServiceDb = SupabaseClient<any, any, any>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Lê e decifra a credencial do workspace. Sem fallback para token global. */
export async function loadOrgCredentials(
  db: ServiceDb,
  organizationId: string,
): Promise<{ blogId: string; client: MetricoolClient }> {
  const { data: creds, error } = await db
    .from("metricool_credentials")
    .select("blog_id, encrypted_token")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !creds?.blog_id) throw new Error("Metricool credentials not configured for this organization.");
  const token = openMetricoolToken(creds.encrypted_token, organizationId, creds.blog_id, loadMetricoolKeyring());
  return { blogId: creds.blog_id, client: createMetricoolClient({ userToken: token }) };
}

export type ActionExecutionResult =
  | { ok: true; externalRef: string }
  | { ok: false; errorCode: string; message: string };

async function resolveMediaUrls(
  db: ServiceDb,
  organizationId: string,
  mediaIds: unknown,
): Promise<string[]> {
  if (!Array.isArray(mediaIds) || mediaIds.length === 0) return [];
  if (mediaIds.length > 10 || !mediaIds.every((id) => typeof id === "string" && UUID_PATTERN.test(id))) {
    throw new ExecutionError("invalid_media");
  }
  const { data, error } = await db
    .from("media_assets")
    .select("id, storage_path")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .in("id", mediaIds);
  if (error || !data || data.length !== mediaIds.length) throw new ExecutionError("media_not_found");
  const byId = new Map(data.map((row: { id: string; storage_path: string }) => [row.id, row.storage_path]));
  const paths = (mediaIds as string[]).map((id) => byId.get(id) as string);
  const signed = await db.storage.from(MEDIA_BUCKET).createSignedUrls(paths, 3600);
  if (signed.error || !signed.data || signed.data.some((item) => !item.signedUrl)) throw new ExecutionError("media_url_failed");
  return signed.data.map((item) => item.signedUrl as string);
}

class ExecutionError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

/**
 * Reivindica e executa um pedido de ação externa aprovado (service_role).
 * `organizationId` é o workspace de quem chamou: pedidos de outro workspace são recusados
 * antes de qualquer mudança de estado.
 */
export async function executeApprovedAction(
  db: ServiceDb,
  requestId: string,
  organizationId: string,
  options?: { client?: MetricoolClient; blogId?: string },
): Promise<ActionExecutionResult> {
  if (!UUID_PATTERN.test(requestId) || !UUID_PATTERN.test(organizationId)) {
    return { ok: false, errorCode: "invalid_input", message: "Pedido inválido." };
  }

  // 0. O pedido precisa pertencer ao workspace de quem chamou (antes de reivindicar).
  const { data: owner, error: ownerError } = await db
    .from("external_action_requests")
    .select("organization_id")
    .eq("id", requestId)
    .maybeSingle();
  if (ownerError || !owner || owner.organization_id !== organizationId) {
    return { ok: false, errorCode: "action_request_not_found", message: "Pedido não encontrado." };
  }

  // 1. Reivindica o pedido aprovado via RPC atômica (re-confere hash aprovado)
  const { data: request, error: claimError } = await db.rpc("claim_external_action", {
    p_request_id: requestId,
  });

  if (claimError || !request) {
    return { ok: false, errorCode: "action_request_not_claimable", message: "O pedido não está aprovado para execução." };
  }

  const fail = async (errorCode: string, message: string): Promise<ActionExecutionResult> => {
    await db.rpc("finish_external_action", { p_request_id: requestId, p_ok: false, p_error_code: errorCode });
    return { ok: false, errorCode, message };
  };

  try {
    const { data: account, error: accError } = await db
      .from("social_accounts")
      .select("network, account_type, via, external_account_id")
      .eq("id", request.social_account_id)
      .eq("organization_id", organizationId)
      .single();

    if (accError || !account) return fail("account_not_found", "Conta social associada não encontrada.");
    if (account.via !== "metricool") return fail("native_api_not_implemented", "API nativa ainda não configurada.");
    if (request.action !== "publish_post") return fail("action_not_supported", "Ação não suportada pelo Metricool.");

    let client = options?.client;
    let blogId = options?.blogId;
    if (!client) {
      const loaded = await loadOrgCredentials(db, organizationId);
      client = loaded.client;
      blogId = loaded.blogId;
    }
    if (!blogId) return fail("credentials_missing", "Metricool blogId ausente.");

    const payload = request.payload as Record<string, unknown>;
    const text = typeof payload.caption === "string" ? payload.caption : "";
    const mediaUrls = await resolveMediaUrls(db, organizationId, payload.mediaIds);

    const result = await client.publishPost(blogId, {
      network: account.network as SocialNetwork,
      text,
      mediaUrls,
    });

    await db.rpc("finish_external_action", {
      p_request_id: requestId,
      p_ok: true,
      p_external_ref: result.id,
    });

    return { ok: true, externalRef: result.id };
  } catch (err) {
    const code = err instanceof ExecutionError ? err.code : "execution_error";
    return fail(code, "Não foi possível executar a ação externa.");
  }
}
