import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createUserClient } from "../../supabase/server";
import { createServiceClient } from "../../supabase/service";
import type { Database } from "../../supabase/database.types";
import type { MercadoLivreTokenEnvelope } from "./token-crypto";
import type { MercadoLivreTokenSet } from "./types";

type UntypedServiceClient = SupabaseClient;
type CredentialRow = {
  connection_id: string;
  organization_id: string;
  encrypted_tokens: MercadoLivreTokenEnvelope;
  token_expires_at: string;
  token_version: number;
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
    .select("id")
    .eq("id", input.connectionId)
    .eq("organization_id", input.organizationId)
    .eq("provider", "mercado_livre")
    .eq("domain", "owned_sales")
    .maybeSingle();
  if (connectionError || !connection) throw new Error("Mercado Livre connection not found.");
  const client = getAdminClient();
  const { error } = await client.from("mercado_livre_credentials").upsert({
    connection_id: input.connectionId,
    organization_id: input.organizationId,
    encrypted_tokens: input.encryptedTokens,
    token_expires_at: input.tokenSet.expiresAt,
    token_version: 1,
    refresh_lease_until: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "connection_id" });
  if (error) throw new Error("Could not persist Mercado Livre credentials.");
}

export async function claimMercadoLivreRefresh(connectionId: string): Promise<CredentialRow | null> {
  const client = getAdminClient();
  const { data, error } = await client.rpc("mercado_livre_claim_refresh", {
    p_connection_id: connectionId,
    p_lease_seconds: 90,
  });
  if (error) throw new Error("Could not claim Mercado Livre token refresh.");
  const row = data?.[0];
  if (!row) return null;
  return {
    connection_id: connectionId,
    organization_id: row.organization_id,
    encrypted_tokens: row.encrypted_tokens as MercadoLivreTokenEnvelope,
    token_expires_at: "",
    token_version: row.token_version,
  };
}

export async function saveMercadoLivreRefreshedCredentials(input: {
  connectionId: string;
  expectedVersion: number;
  encryptedTokens: MercadoLivreTokenEnvelope;
  expiresAt: string;
}): Promise<boolean> {
  const client = getAdminClient();
  const { data, error } = await client.rpc("mercado_livre_save_refreshed_tokens", {
    p_connection_id: input.connectionId,
    p_expected_version: input.expectedVersion,
    p_encrypted_tokens: input.encryptedTokens,
    p_token_expires_at: input.expiresAt,
  });
  if (error) throw new Error("Could not save refreshed Mercado Livre credentials.");
  return data === true;
}

export async function releaseMercadoLivreRefresh(connectionId: string): Promise<void> {
  const client = getAdminClient();
  const { error } = await client.rpc("mercado_livre_release_refresh", {
    p_connection_id: connectionId,
  });
  if (error) throw new Error("Could not release Mercado Livre refresh lease.");
}
