import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createUserClient } from "../../supabase/server";
import { createServiceClient } from "../../supabase/service";
import type { MercadoLivreTokenEnvelope } from "./token-crypto";
import type { MercadoLivreTokenSet } from "./types";

type UntypedServiceClient = SupabaseClient;
export type MercadoLivreRefreshClaim = {
  connectionId: string;
  organizationId: string;
  externalAccountId: string;
  encryptedTokens: MercadoLivreTokenEnvelope;
  expiresAt: string;
  tokenVersion: number;
  leaseId: string;
};

function getAdminClient(): UntypedServiceClient {
  const client = createServiceClient();
  if (!client) throw new Error("SMKON service database is not configured.");
  return client as unknown as UntypedServiceClient;
}

/** Derives the user from the session and validates owner/admin membership before service-role access. */
export async function assertMercadoLivreManager(organizationId: string): Promise<void> {
  if (!organizationId || organizationId.length > 64) throw new Error("Invalid organization.");
  const userClient = await createUserClient();
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) throw new Error("Authentication required.");

  const { data, error } = await userClient
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data || (data.role !== "owner" && data.role !== "admin")) {
    throw new Error("Organization permission denied.");
  }
}

export async function storeMercadoLivreCredentials(input: {
  organizationId: string;
  connectionId: string;
  tokenSet: MercadoLivreTokenSet;
  encryptedTokens: MercadoLivreTokenEnvelope;
}): Promise<void> {
  await assertMercadoLivreManager(input.organizationId);
  const userClient = await createUserClient();
  const { data: connection, error: connectionError } = await userClient
    .from("source_connections")
    .select("id, external_account_id")
    .eq("id", input.connectionId)
    .eq("organization_id", input.organizationId)
    .eq("provider", "mercado_livre")
    .eq("domain", "owned_sales")
    .maybeSingle();

  if (
    connectionError ||
    !connection ||
    String(connection.external_account_id) !== input.tokenSet.userId
  ) {
    throw new Error("Mercado Livre connection does not match the authorized account.");
  }

  // Insert-only: never overwrite an existing credential or reset its CAS version.
  const client = getAdminClient();
  const { error } = await client.from("mercado_livre_credentials").insert({
    connection_id: input.connectionId,
    organization_id: input.organizationId,
    domain: "owned_sales",
    encrypted_tokens: input.encryptedTokens,
    token_expires_at: input.tokenSet.expiresAt,
    token_version: 1,
    refresh_lease_until: null,
    refresh_lease_id: null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error("Could not persist Mercado Livre credentials.");
}

export async function claimMercadoLivreRefresh(
  connectionId: string,
): Promise<MercadoLivreRefreshClaim | null> {
  const client = getAdminClient();
  const { data, error } = await client.rpc("mercado_livre_claim_refresh", {
    p_connection_id: connectionId,
    p_lease_seconds: 90,
  });
  if (error) throw new Error("Could not claim Mercado Livre token refresh.");
  const row = data?.[0];
  if (!row) return null;

  return {
    connectionId,
    organizationId: row.organization_id,
    externalAccountId: row.external_account_id,
    encryptedTokens: row.encrypted_tokens as MercadoLivreTokenEnvelope,
    expiresAt: row.token_expires_at,
    tokenVersion: row.token_version,
    leaseId: row.lease_id,
  };
}

export async function saveMercadoLivreRefreshedCredentials(input: {
  connectionId: string;
  expectedVersion: number;
  leaseId: string;
  encryptedTokens: MercadoLivreTokenEnvelope;
  expiresAt: string;
}): Promise<boolean> {
  const client = getAdminClient();
  const { data, error } = await client.rpc("mercado_livre_save_refreshed_tokens", {
    p_connection_id: input.connectionId,
    p_expected_version: input.expectedVersion,
    p_lease_id: input.leaseId,
    p_encrypted_tokens: input.encryptedTokens,
    p_token_expires_at: input.expiresAt,
  });
  if (error) throw new Error("Could not save refreshed Mercado Livre credentials.");
  return data === true;
}

export async function releaseMercadoLivreRefresh(
  connectionId: string,
  leaseId: string,
): Promise<void> {
  const client = getAdminClient();
  const { error } = await client.rpc("mercado_livre_release_refresh", {
    p_connection_id: connectionId,
    p_lease_id: leaseId,
  });
  if (error) throw new Error("Could not release Mercado Livre refresh lease.");
}
