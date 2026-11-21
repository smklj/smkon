import assert from "node:assert/strict";
import test from "node:test";
import {
  decryptMercadoLivreTokens,
  encryptMercadoLivreTokens,
  loadMercadoLivreTokenKeyring,
} from "../../src/lib/integrations/mercado-livre/token-crypto.ts";

const context = {
  organizationId: "org-a",
  provider: "mercado_livre" as const,
  externalUserId: "123456",
};
const key = Buffer.alloc(32, 7);
const keyring = { activeKeyId: "test-v1", keys: { "test-v1": key } };

test("encrypts and decrypts tokens with authenticated tenant context", () => {
  const payload = JSON.stringify({ accessToken: "access-secret", refreshToken: "refresh-secret" });
  const encrypted = encryptMercadoLivreTokens(payload, context, keyring);
  assert.notEqual(encrypted.ciphertext, Buffer.from(payload).toString("base64"));
  assert.equal(decryptMercadoLivreTokens(encrypted, context, keyring), payload);
});

test("rejects ciphertext tampering and cross-tenant decryption", () => {
  const encrypted = encryptMercadoLivreTokens("sensitive", context, keyring);
  assert.throws(() => decryptMercadoLivreTokens({ ...encrypted, ciphertext: Buffer.from("tampered").toString("base64") }, context, keyring));
  assert.throws(() => decryptMercadoLivreTokens(encrypted, { ...context, organizationId: "org-b" }, keyring));
  assert.throws(() => decryptMercadoLivreTokens(encrypted, { ...context, externalUserId: "999" }, keyring));
});

test("supports key rotation by decrypting with retained key id", () => {
  const old = { activeKeyId: "old", keys: { old: key } };
  const encrypted = encryptMercadoLivreTokens("token-pair", context, old);
  const rotated = { activeKeyId: "new", keys: { old: key, new: Buffer.alloc(32, 8) } };
  assert.equal(decryptMercadoLivreTokens(encrypted, context, rotated), "token-pair");
  const next = encryptMercadoLivreTokens("next-pair", context, rotated);
  assert.equal(next.kid, "new");
});

test("rejects malformed keys, envelopes and oversized payloads", () => {
  assert.throws(() => loadMercadoLivreTokenKeyring({ MERCADO_LIVRE_TOKEN_ENCRYPTION_KEY: "not-base64" }));
  assert.throws(() => encryptMercadoLivreTokens("x", context, { activeKeyId: "bad", keys: { bad: Buffer.alloc(16) } }));
  assert.throws(() => encryptMercadoLivreTokens("", context, keyring));
  const encrypted = encryptMercadoLivreTokens("x", context, keyring);
  assert.throws(() => decryptMercadoLivreTokens({ ...encrypted, v: 2 as 1 }, context, keyring));
});
