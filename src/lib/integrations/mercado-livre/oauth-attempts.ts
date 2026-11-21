import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "../../supabase/service";
import type { MercadoLivreTokenEnvelope } from "./token-crypto";

function admin(): SupabaseClient {
  const client = createServiceClient();
  if (!client) throw new Error("SMKON service database is not configured.");
  return client as unknown as SupabaseClient;
}

export function hashMercadoLivreOAuthState(state: string): string {
  return createHash("sha256").update(state, "utf8").digest("hex");
}

export async function saveMercadoLivreOAuthAttempt(input: {
  state: string;
  organizationId: string;
  connectionId: string;
  userId: string;
  encryptedVerifier: MercadoLivreTokenEnvelope;
}): Promise<void> {
  const { error } = await admin().from("mercado_livre_oauth_attempts").insert({
    state_hash: hashMercadoLivreOAuthState(input.state),
    organization_id: input.organizationId,
    connection_id: input.connectionId,
    created_by: input.userId,
    encrypted_verifier: input.encryptedVerifier,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (error) throw new Error("Could not create Mercado Livre OAuth attempt.");
}

export async function consumeMercadoLivreOAuthAttempt(state: string, userId: string): Promise<{
  organizationId: string;
  connectionId: string;
  encryptedVerifier: MercadoLivreTokenEnvelope;
} | null> {
  const { data, error } = await admin().rpc("mercado_livre_consume_oauth_attempt", {
    p_state_hash: hashMercadoLivreOAuthState(state),
    p_user_id: userId,
  });
  if (error) throw new Error("Could not validate Mercado Livre OAuth attempt.");
  const row = data?.[0];
  if (!row) return null;
  return {
    organizationId: row.organization_id,
    connectionId: row.connection_id,
    encryptedVerifier: row.encrypted_verifier as MercadoLivreTokenEnvelope,
  };
}
