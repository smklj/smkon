import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = 1 as const;
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const MAX_TOKEN_BYTES = 32 * 1024;

export type MercadoLivreTokenEnvelope = {
  v: typeof VERSION;
  alg: typeof ALGORITHM;
  kid: string;
  iv: string;
  tag: string;
  ciphertext: string;
};

export type TokenEncryptionKeyring = {
  activeKeyId: string;
  keys: Readonly<Record<string, Buffer>>;
};

export type TokenEncryptionContext = {
  organizationId: string;
  provider: "mercado_livre";
  externalUserId: string;
};

function assertContext(context: TokenEncryptionContext): void {
  for (const value of [context.organizationId, context.externalUserId]) {
    if (!value || value.length > 256) throw new Error("Invalid token encryption context.");
  }
}

function assertKeyring(keyring: TokenEncryptionKeyring): Buffer {
  const key = keyring.keys[keyring.activeKeyId];
  if (!/^[a-zA-Z0-9._-]{1,64}$/.test(keyring.activeKeyId) || !key || key.length !== 32) {
    throw new Error("Mercado Livre token encryption keyring is not configured correctly.");
  }
  return key;
}

function aad(context: TokenEncryptionContext): Buffer {
  assertContext(context);
  return Buffer.from(`smkon:mercado-livre:v1:${context.organizationId}:${context.provider}:${context.externalUserId}`, "utf8");
}

function decodeBase64(value: string, expectedLength?: number): Buffer {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error("Invalid encrypted token envelope.");
  const decoded = Buffer.from(value, "base64");
  if (decoded.toString("base64") !== value || (expectedLength !== undefined && decoded.length !== expectedLength)) {
    throw new Error("Invalid encrypted token envelope.");
  }
  return decoded;
}

export function encryptMercadoLivreTokens(
  plaintext: string,
  context: TokenEncryptionContext,
  keyring: TokenEncryptionKeyring,
): MercadoLivreTokenEnvelope {
  if (!plaintext || Buffer.byteLength(plaintext, "utf8") > MAX_TOKEN_BYTES) {
    throw new Error("Invalid Mercado Livre token payload.");
  }
  const key = assertKeyring(keyring);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(aad(context));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    v: VERSION,
    alg: ALGORITHM,
    kid: keyring.activeKeyId,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptMercadoLivreTokens(
  envelope: MercadoLivreTokenEnvelope,
  context: TokenEncryptionContext,
  keyring: TokenEncryptionKeyring,
): string {
  assertContext(context);
  if (!envelope || envelope.v !== VERSION || envelope.alg !== ALGORITHM ||
      typeof envelope.kid !== "string" || !/^[a-zA-Z0-9._-]{1,64}$/.test(envelope.kid)) {
    throw new Error("Unsupported encrypted token envelope.");
  }
  const key = keyring.keys[envelope.kid];
  if (!key || key.length !== 32) throw new Error("Mercado Livre token decryption key is unavailable.");
  const iv = decodeBase64(envelope.iv, IV_BYTES);
  const tag = decodeBase64(envelope.tag, TAG_BYTES);
  const ciphertext = decodeBase64(envelope.ciphertext);
  if (ciphertext.length > MAX_TOKEN_BYTES) throw new Error("Encrypted token payload is too large.");
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAAD(aad(context));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Mercado Livre token authentication failed.");
  }
}

/** Reads a base64-encoded 32-byte key without exposing it in logs or error messages. */
export function loadMercadoLivreTokenKeyring(
  env: Record<string, string | undefined> = process.env,
): TokenEncryptionKeyring {
  const keyId = env.MERCADO_LIVRE_TOKEN_ENCRYPTION_KEY_ID ?? "primary";
  const encoded = env.MERCADO_LIVRE_TOKEN_ENCRYPTION_KEY;
  if (!encoded) throw new Error("Mercado Livre token encryption key is not configured.");
  const key = decodeBase64(encoded, 32);
  return { activeKeyId: keyId, keys: { [keyId]: key } };
}
