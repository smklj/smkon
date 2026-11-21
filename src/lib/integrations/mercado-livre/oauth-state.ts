import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export type OAuthAttempt = {
  state: string;
  codeVerifier: string;
  createdAt: number;
};

export function createOAuthAttempt(now = Date.now()): OAuthAttempt {
  return { state: randomBytes(32).toString("base64url"), codeVerifier: randomBytes(32).toString("base64url"), createdAt: now };
}

export function createCodeChallenge(verifier: string): string {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) throw new Error("Invalid PKCE verifier.");
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

export function safeEqualState(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isOAuthAttemptValid(
  attempt: OAuthAttempt | null,
  receivedState: string,
  now = Date.now(),
  maxAgeMs = 10 * 60 * 1000,
): boolean {
  if (!attempt || !receivedState || !Number.isFinite(attempt.createdAt)) return false;
  const age = now - attempt.createdAt;
  return age >= 0 && age <= maxAgeMs && safeEqualState(attempt.state, receivedState);
}
