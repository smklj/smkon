import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeActionPayload, type ExternalAction } from "../integrations/registry.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, any, any>;

export type PendingExternalActionRow = {
  id: string;
  organization_id: string;
  social_account_id: string;
  action: ExternalAction;
  payload: Record<string, unknown>;
  payload_hash: string;
  status: string;
  requested_by: string;
  requested_at: string;
  account: {
    network: string;
    handle: string | null;
    display_name: string | null;
    account_type: string;
    via: string;
  } | null;
};

/**
 * Lista pedidos de ação externa pendentes de aprovação no workspace.
 */
export async function listPendingExternalActions(
  client: Client,
  organizationId: string,
): Promise<PendingExternalActionRow[]> {
  const { data, error } = await client
    .from("external_action_requests")
    .select(`
      id,
      organization_id,
      social_account_id,
      action,
      payload,
      payload_hash,
      status,
      requested_by,
      requested_at,
      account:social_accounts(network, handle, display_name, account_type, via)
    `)
    .eq("organization_id", organizationId)
    .in("status", ["pending_approval", "approved"])
    .order("requested_at", { ascending: false });

  if (error) {
    throw new Error(`Falha ao listar ações pendentes: ${error.message}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    ...row,
    account: Array.isArray(row.account) ? row.account[0] : row.account,
  }));
}

/**
 * Decide (aprova ou recusa) um pedido de ação externa conferindo o hash exato.
 * Apenas Owner ou Admin da organização.
 */
export async function decideExternalAction(
  client: Client,
  input: {
    requestId: string;
    decision: "approved" | "rejected";
    expectedHash: string;
    note?: string;
  },
): Promise<string> {
  const { requestId, decision, expectedHash, note } = input;
  if (!requestId || !expectedHash || !/^[a-f0-9]{64}$/.test(expectedHash)) {
    throw new Error("Parâmetros de aprovação inválidos: requestId e expectedHash obrigatórios.");
  }

  const { data, error } = await client.rpc("decide_external_action", {
    p_request_id: requestId,
    p_decision: decision,
    p_expected_hash: expectedHash,
    p_note: note ?? null,
  });

  if (error) {
    if (error.message.includes("hash_mismatch")) {
      throw new Error("O hash do pedido foi alterado. Recarregue a página antes de aprovar.");
    }
    if (error.message.includes("forbidden")) {
      throw new Error("Permissão negada: apenas Owner ou Admin podem aprovar ações externas.");
    }
    throw new Error(`Erro ao decidir ação externa: ${error.message}`);
  }

  return data as string;
}

/**
 * Cancela um pedido de ação antes da sua execução.
 */
export async function cancelExternalAction(
  client: Client,
  requestId: string,
): Promise<void> {
  if (!requestId) throw new Error("requestId é obrigatório.");

  const { error } = await client.rpc("cancel_external_action", {
    p_request_id: requestId,
  });

  if (error) {
    throw new Error(`Erro ao cancelar ação externa: ${error.message}`);
  }
}

/**
 * Cria um novo pedido de ação externa com normalização de payload e cálculo de hash no servidor.
 */
export async function createExternalActionRequest(
  client: Client,
  input: {
    socialAccountId: string;
    action: ExternalAction;
    payload: unknown;
  },
): Promise<{ requestId: string; payloadHash: string }> {
  const norm = normalizeActionPayload(input.action, input.payload);
  if (!norm.ok) {
    throw new Error(`Payload inválido para a ação ${input.action}: ${norm.error}`);
  }

  const { data, error } = await client.rpc("request_external_action", {
    p_social_account_id: input.socialAccountId,
    p_action: input.action,
    p_payload: norm.payload,
  });

  if (error) {
    throw new Error(`Erro ao criar pedido de ação externa: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    requestId: row.request_id,
    payloadHash: row.payload_hash,
  };
}
