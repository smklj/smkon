import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Validação de token secreto em tempo constante (timingSafeEqual).
 * Impede vazamento e ataques de tempo.
 */
export function verifyHotmartToken(
  presentedToken: string | null | undefined,
  expectedSecret: string | null | undefined,
): boolean {
  const presented = typeof presentedToken === "string" ? presentedToken.trim() : "";
  const expected = typeof expectedSecret === "string" ? expectedSecret.trim() : "";

  const presentedDigest = createHash("sha256").update(presented, "utf8").digest();
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();

  const matches = timingSafeEqual(presentedDigest, expectedDigest);
  return matches && presented.length > 0 && expected.length > 0;
}

/**
 * Gera hash SHA-256 do token Hottok para indexação segura no banco
 * sem expor o segredo em claro.
 */
export function hashHotmartToken(token: string): string {
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    throw new Error("Invalid token to hash.");
  }
  return createHash("sha256").update(token.trim(), "utf8").digest("hex");
}

/**
 * Extrai o token Hottok de headers, query params ou payload.
 */
export function extractHotmartToken(
  headers: Headers | Record<string, string | string[] | undefined>,
  searchParams?: URLSearchParams | null,
  body?: Record<string, unknown> | null,
): string | null {
  // 1. Headers: 'x-hotmart-hottok' ou 'hottok'
  if (headers instanceof Headers) {
    const h1 = headers.get("x-hotmart-hottok");
    if (h1 && h1.trim().length > 0) return h1.trim();
    const h2 = headers.get("hottok");
    if (h2 && h2.trim().length > 0) return h2.trim();
  } else if (headers && typeof headers === "object") {
    for (const [key, val] of Object.entries(headers)) {
      const lower = key.toLowerCase();
      if (lower === "x-hotmart-hottok" || lower === "hottok") {
        const v = Array.isArray(val) ? val[0] : val;
        if (typeof v === "string" && v.trim().length > 0) return v.trim();
      }
    }
  }

  // 2. Query param ?hottok=...
  if (searchParams) {
    const q = searchParams.get("hottok");
    if (q && q.trim().length > 0) return q.trim();
  }

  // 3. Body: body.hottok ou body.data.hottok
  if (body && typeof body === "object") {
    if (typeof body.hottok === "string" && body.hottok.trim().length > 0) {
      return body.hottok.trim();
    }
    const data = body.data;
    if (data && typeof data === "object" && typeof (data as Record<string, unknown>).hottok === "string") {
      const dHottok = (data as Record<string, unknown>).hottok as string;
      if (dHottok.trim().length > 0) return dHottok.trim();
    }
  }

  return null;
}
