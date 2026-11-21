import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "../../supabase/service";
import type { HotmartNormalizedEvent } from "./types.ts";
import { hashHotmartToken } from "./validator.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedServiceClient = SupabaseClient<any, any, any>;

export type HotmartConnectionRecord = {
  connectionId: string;
  organizationId: string;
  domain: "owned_sales" | "affiliate";
  status: string;
  externalAccountId?: string | null;
};

export type PersistEventResult = {
  ok: boolean;
  event_id: string;
  domain: string;
  target_id: string;
  status: string;
};

function getAdminClient(): UntypedServiceClient {
  const client = createServiceClient();
  if (!client) throw new Error("SMKON service database is not configured.");
  return client as unknown as UntypedServiceClient;
}

/**
 * Busca uma conexão Hotmart pelo hash do Hottok.
 */
export async function findHotmartConnectionByTokenHash(
  tokenHash: string,
): Promise<HotmartConnectionRecord | null> {
  if (!tokenHash || !/^[a-f0-9]{64}$/.test(tokenHash)) return null;
  const client = getAdminClient();
  const { data, error } = await client.rpc("hotmart_lookup_connection_by_token_hash", {
    p_hottok_hash: tokenHash,
  });
  if (error || !data || !Array.isArray(data) || data.length === 0) return null;
  const row = data[0];
  return {
    connectionId: row.connection_id,
    organizationId: row.organization_id,
    domain: row.domain,
    status: row.status,
    externalAccountId: row.external_account_id,
  };
}

/**
 * Busca conexão Hotmart por ID de conexão e opcionalmente ID da organização.
 */
export async function findHotmartConnectionById(
  connectionId: string,
  organizationId?: string,
): Promise<HotmartConnectionRecord | null> {
  if (!connectionId || !/^[0-9a-f-]{36}$/i.test(connectionId)) return null;
  const client = getAdminClient();
  let query = client
    .from("source_connections")
    .select("id, organization_id, domain, status, external_account_id")
    .eq("id", connectionId)
    .eq("provider", "hotmart");

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;

  return {
    connectionId: data.id,
    organizationId: data.organization_id,
    domain: data.domain,
    status: data.status,
    externalAccountId: data.external_account_id,
  };
}

/**
 * Busca primeira conexão Hotmart ativa da organização com o domínio especificado.
 */
export async function findHotmartConnectionByOrgAndDomain(
  organizationId: string,
  domain: "owned_sales" | "affiliate",
): Promise<HotmartConnectionRecord | null> {
  if (!organizationId || !/^[0-9a-f-]{36}$/i.test(organizationId)) return null;
  const client = getAdminClient();
  const { data, error } = await client
    .from("source_connections")
    .select("id, organization_id, domain, status, external_account_id")
    .eq("organization_id", organizationId)
    .eq("provider", "hotmart")
    .eq("domain", domain)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    connectionId: data.id,
    organizationId: data.organization_id,
    domain: data.domain,
    status: data.status,
    externalAccountId: data.external_account_id,
  };
}

/**
 * Registra ou atualiza o hash do segredo Hottok da conexão no banco.
 */
export async function setHotmartConnectionCredentials(input: {
  connectionId: string;
  organizationId: string;
  domain: "owned_sales" | "affiliate";
  hottok: string;
  encryptedHottok?: Record<string, unknown>;
}): Promise<void> {
  const client = getAdminClient();
  const tokenHash = hashHotmartToken(input.hottok);
  const { error } = await client.rpc("hotmart_set_connection_credentials", {
    p_connection_id: input.connectionId,
    p_organization_id: input.organizationId,
    p_domain: input.domain,
    p_hottok_hash: tokenHash,
    p_encrypted_hottok: input.encryptedHottok ?? {},
  });
  if (error) {
    throw new Error(`Could not set Hotmart credentials: ${error.message}`);
  }
}

/**
 * Persiste evento normalizado do webhook Hotmart atomicamente.
 */
export async function persistHotmartWebhookEvent(input: {
  connectionId: string;
  organizationId: string;
  event: HotmartNormalizedEvent;
  receivedAt?: string;
}): Promise<PersistEventResult> {
  const client = getAdminClient();
  const { data, error } = await client.rpc("hotmart_persist_webhook_event", {
    p_connection_id: input.connectionId,
    p_organization_id: input.organizationId,
    p_event: input.event,
    p_received_at: input.receivedAt ?? new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to persist Hotmart event: ${error.message}`);
  }

  const result = data as PersistEventResult;
  return result;
}
