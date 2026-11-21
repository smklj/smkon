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

/**
 * Lê o token apenas de cabeçalhos. Query string e corpo ficam de fora: vão parar em logs
 * de proxy/CDN e no próprio payload armazenado.
 */
export function extractKiwifyToken(
  headers: Headers | Record<string, string | string[] | undefined>,
): string | null {
  const read = (name: string): string | null => {
    if (headers instanceof Headers) return headers.get(name);
    for (const [key, val] of Object.entries(headers ?? {})) {
      if (key.toLowerCase() === name) return Array.isArray(val) ? val[0] ?? null : val ?? null;
    }
    return null;
  };
  for (const name of ["x-kiwify-token", "x-kiwify-signature"]) {
    const value = read(name)?.trim();
    if (value) return value;
  }
  const auth = read("authorization")?.trim();
  if (auth && /^Bearer\s+\S+$/i.test(auth)) return auth.replace(/^Bearer\s+/i, "");
  return null;
}
