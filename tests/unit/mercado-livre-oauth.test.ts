import assert from "node:assert/strict";
import test from "node:test";
import {
  createCodeChallenge,
  createOAuthAttempt,
  isOAuthAttemptValid,
  safeEqualState,
} from "../../src/lib/integrations/mercado-livre/oauth-state.ts";
import { buildAuthorizationUrl } from "../../src/lib/integrations/mercado-livre/oauth-url.ts";

test("OAuth attempt creates high-entropy state and PKCE verifier", () => {
  const attempt = createOAuthAttempt(1_000);
  assert.ok(attempt.state.length >= 40);
  assert.ok(attempt.codeVerifier.length >= 40);
  assert.equal(isOAuthAttemptValid(attempt, attempt.state, 2_000), true);
});

test("OAuth state rejects mismatch, expiry and future timestamps", () => {
  const attempt = createOAuthAttempt(1_000);
  assert.equal(isOAuthAttemptValid(attempt, "wrong", 2_000), false);
  assert.equal(isOAuthAttemptValid(attempt, attempt.state, 601_001), false);
  assert.equal(isOAuthAttemptValid(attempt, attempt.state, 999), false);
  assert.equal(safeEqualState("abc", "abcd"), false);
});

test("PKCE challenge follows S256 and rejects malformed verifier", () => {
  const challenge = createCodeChallenge("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_");
  assert.match(challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.throws(() => createCodeChallenge("short"));
});

test("authorization URL uses exact redirect URI and S256 PKCE", () => {
  const url = new URL(buildAuthorizationUrl({
    clientId: "test-app",
    redirectUri: "https://example.test/api/integrations/mercado-livre/callback",
  }, "state-value", "challenge-value"));
  assert.equal(url.origin, "https://auth.mercadolivre.com.br");
  assert.equal(url.searchParams.get("client_id"), "test-app");
  assert.equal(url.searchParams.get("redirect_uri"), "https://example.test/api/integrations/mercado-livre/callback");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
});
