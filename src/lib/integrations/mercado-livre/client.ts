import "server-only";

import { MercadoLivreApiError } from "./types";

const API_ORIGIN = "https://api.mercadolibre.com";
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

/** Cliente estritamente GET: o primeiro incremento do S11 não pode mutar dados no marketplace. */
export async function mercadoLivreGet<T>(
  accessToken: string,
  path: string,
  query: Record<string, string | number | boolean | undefined> = {},
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  if (!accessToken) throw new Error("Missing Mercado Livre access token.");
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("..")) throw new Error("Invalid Mercado Livre API path.");

  const url = new URL(path, API_ORIGIN);
  if (url.origin !== API_ORIGIN) throw new Error("Invalid Mercado Livre API origin.");
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { accept: "application/json", authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new MercadoLivreApiError("timeout");
  }

  if (response.status === 401) throw new MercadoLivreApiError("unauthorized", 401);
  if (response.status === 403) throw new MercadoLivreApiError("forbidden", 403);
  if (response.status === 429) throw new MercadoLivreApiError("rate_limited", 429);
  if (!response.ok) throw new MercadoLivreApiError("upstream", response.status);

  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) throw new MercadoLivreApiError("invalid_response");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new MercadoLivreApiError("invalid_response");
  }
}
