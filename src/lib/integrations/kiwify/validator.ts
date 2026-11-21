/**
 * Validador de Assinatura e Tokens Kiwify (Frente E · S24)
 * Validação em tempo constante para proteção contra timing attacks.
 */

import { createHash, timingSafeEqual } from "node:crypto";

export function verifyKiwifyToken(
  presentedToken: string | null | undefined,
  expectedSecret: string | null | undefined
): boolean {
  const presented = typeof presentedToken === "string" ? presentedToken.trim() : "";
  const expected = typeof expectedSecret === "string" ? expectedSecret.trim() : "";

  if (presented.length === 0 || expected.length === 0) {
    return false;
  }

  const presentedDigest = createHash("sha256").update(presented, "utf8").digest();
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();

  return timingSafeEqual(presentedDigest, expectedDigest);
}

export function hashKiwifyToken(token: string): string {
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    throw new Error("Token Kiwify inválido para hashing.");
  }
  return createHash("sha256").update(token.trim(), "utf8").digest("hex");
}

export function extractKiwifyToken(
  headers: Headers | Record<string, string | string[] | undefined>,
  searchParams?: URLSearchParams | null,
  body?: Record<string, unknown> | null
): string | null {
  // 1. Headers: 'x-kiwify-signature', 'x-kiwify-token' ou 'authorization'
  if (headers instanceof Headers) {
    const s1 = headers.get("x-kiwify-signature");
    if (s1 && s1.trim().length > 0) return s1.trim();
    const s2 = headers.get("x-kiwify-token");
    if (s2 && s2.trim().length > 0) return s2.trim();
    const auth = headers.get("authorization");
    if (auth && auth.trim().length > 0) {
      return auth.replace(/^Bearer\s+/i, "").trim();
    }
  } else if (headers && typeof headers === "object") {
    for (const [key, val] of Object.entries(headers)) {
      const lower = key.toLowerCase();
      if (lower === "x-kiwify-signature" || lower === "x-kiwify-token" || lower === "authorization") {
        const v = Array.isArray(val) ? val[0] : val;
        if (typeof v === "string" && v.trim().length > 0) {
          return v.replace(/^Bearer\s+/i, "").trim();
        }
      }
    }
  }

  // 2. Query param ?token=...
  if (searchParams) {
    const q = searchParams.get("token") || searchParams.get("signature");
    if (q && q.trim().length > 0) return q.trim();
  }

  // 3. Body: signature
  if (body && typeof body === "object") {
    const bSig = body.signature;
    if (typeof bSig === "string" && bSig.trim().length > 0) {
      return bSig.trim();
    }
  }

  return null;
}
