import "server-only";

import {
  decryptMercadoLivreTokens,
  encryptMercadoLivreTokens,
  loadMercadoLivreTokenKeyring,
} from "./token-crypto.server";
import {
  claimMercadoLivreRefresh,
  releaseMercadoLivreRefresh,
  saveMercadoLivreRefreshedCredentials,
} from "./repository";
import { refreshAccessToken } from "./oauth";
import type { MercadoLivreOAuthConfig, MercadoLivreTokenSet } from "./types";

function getOAuthConfig(env: Record<string, string | undefined> = process.env): Pick<MercadoLivreOAuthConfig, "clientId" | "clientSecret"> {
  const clientId = env.MERCADO_LIVRE_CLIENT_ID;
  const clientSecret = env.MERCADO_LIVRE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Mercado Livre OAuth is not configured.");
  return { clientId, clientSecret };
}

function parseTokenSet(value: string): MercadoLivreTokenSet {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error("Stored Mercado Livre token payload is invalid."); }
  if (!parsed || typeof parsed !== "object") throw new Error("Stored Mercado Livre token payload is invalid.");
  const token = parsed as Partial<MercadoLivreTokenSet>;
  if (
    typeof token.accessToken !== "string" || !token.accessToken ||
    typeof token.refreshToken !== "string" || !token.refreshToken ||
    token.tokenType !== "bearer" ||
    typeof token.expiresAt !== "string" ||
    typeof token.userId !== "string" ||
    !Array.isArray(token.scopes) || !token.scopes.every((scope) => typeof scope === "string")
  ) throw new Error("Stored Mercado Livre token payload is invalid.");
  return token as MercadoLivreTokenSet;
}

/**
 * Refreshes a single connection under a database lease. The provider rotates refresh
 * tokens, so the new encrypted pair is persisted before this function returns.
 */
export async function refreshMercadoLivreConnection(connectionId: string): Promise<boolean> {
  const claim = await claimMercadoLivreRefresh(connectionId);
  if (!claim) return false;

  let persisted = false;
  try {
    const context = {
      organizationId: claim.organizationId,
      provider: "mercado_livre" as const,
      externalUserId: claim.externalAccountId,
    };
    const keyring = loadMercadoLivreTokenKeyring();
    const current = parseTokenSet(decryptMercadoLivreTokens(claim.encryptedTokens, context, keyring));
    if (current.userId !== claim.externalAccountId) {
      throw new Error("Mercado Livre credential account binding failed.");
    }

    const refreshed = await refreshAccessToken(getOAuthConfig(), current.refreshToken);
    if (refreshed.userId !== claim.externalAccountId) {
      throw new Error("Mercado Livre returned a different account during token refresh.");
    }

    const encryptedTokens = encryptMercadoLivreTokens(JSON.stringify(refreshed), context, keyring);
    const saved = await saveMercadoLivreRefreshedCredentials({
      connectionId,
      expectedVersion: claim.tokenVersion,
      leaseId: claim.leaseId,
      encryptedTokens,
      expiresAt: refreshed.expiresAt,
    });
    if (!saved) throw new Error("Mercado Livre refresh lease expired before credentials were saved.");
    persisted = true;
    return true;
  } finally {
    // A successful CAS already clears the lease. On failure, release only this
    // worker's lease; do not let cleanup failure mask the original refresh error.
    if (!persisted) {
      try {
        await releaseMercadoLivreRefresh(connectionId, claim.leaseId);
      } catch {
        // The lease expires automatically; never replace the primary failure.
      }
    }
  }
}
