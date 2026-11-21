import "server-only";

import type { MercadoLivreOAuthConfig, MercadoLivreTokenResponse, MercadoLivreTokenSet } from "./types";

const TOKEN_ENDPOINT = "https://api.mercadolibre.com/oauth/token";
const DEFAULT_AUTHORIZATION_URL = "https://auth.mercadolivre.com.br/authorization";
const MAX_RESPONSE_BYTES = 64 * 1024;


export function buildAuthorizationUrl(config: Pick<MercadoLivreOAuthConfig, "clientId" | "redirectUri" | "authorizationBaseUrl">, state: string, challenge: string): string {
  const url = new URL(config.authorizationBaseUrl ?? DEFAULT_AUTHORIZATION_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

async function requestToken(body: URLSearchParams, fetchImpl: typeof fetch = fetch): Promise<MercadoLivreTokenResponse> {
  const response = await fetchImpl(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => { throw new Error("Mercado Livre OAuth request failed."); });

  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES || !response.ok) throw new Error("Mercado Livre OAuth exchange was rejected.");
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("Mercado Livre OAuth returned an invalid response."); }
  if (!value || typeof value !== "object") throw new Error("Mercado Livre OAuth returned an invalid response.");
  const token = value as Partial<MercadoLivreTokenResponse>;
  if (
    typeof token.access_token !== "string" || !token.access_token ||
    typeof token.refresh_token !== "string" || !token.refresh_token ||
    typeof token.expires_in !== "number" || !Number.isFinite(token.expires_in) || token.expires_in <= 0 ||
    typeof token.user_id !== "number" || !Number.isSafeInteger(token.user_id)
  ) throw new Error("Mercado Livre OAuth returned incomplete token data.");
  return token as MercadoLivreTokenResponse;
}

function toTokenSet(token: MercadoLivreTokenResponse, now = Date.now()): MercadoLivreTokenSet {
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    tokenType: "bearer",
    expiresAt: new Date(now + token.expires_in * 1000).toISOString(),
    userId: String(token.user_id),
    scopes: typeof token.scope === "string" ? token.scope.split(/\\s+/).filter(Boolean) : [],
  };
}

export async function exchangeAuthorizationCode(
  config: MercadoLivreOAuthConfig,
  code: string,
  codeVerifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MercadoLivreTokenSet> {
  if (!code || code.length > 2048) throw new Error("Invalid Mercado Livre authorization code.");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
  });
  return toTokenSet(await requestToken(body, fetchImpl));
}

/** O refresh token é rotativo e de uso único: persistir atomicamente o novo par antes de novas chamadas. */
export async function refreshAccessToken(
  config: Pick<MercadoLivreOAuthConfig, "clientId" | "clientSecret">,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MercadoLivreTokenSet> {
  if (!refreshToken) throw new Error("Missing Mercado Livre refresh token.");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  });
  return toTokenSet(await requestToken(body, fetchImpl));
}
