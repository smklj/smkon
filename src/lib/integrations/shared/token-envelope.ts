import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Envelope AES-256-GCM para tokens de terceiros (Mercado Livre, Metricool e próximos).
 * O AAD amarra o ciphertext ao workspace, ao provedor e à conta externa: um envelope
 * copiado para outra linha ou outro workspace não decifra.
 */

const VERSION = 1 as const;
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const MAX_TOKEN_BYTES = 32 * 1024;
const KEY_ID_PATTERN = /^[a-zA-Z0-9._-]{1,64}$/;

export type TokenEnvelope = {
  v: typeof VERSION;
  alg: typeof ALGORITHM;
  kid: string;
  iv: string;
  tag: string;
  ciphertext: string;
};

export type TokenKeyring = {
  activeKeyId: string;
  keys: Readonly<Record<string, Buffer>>;
};

export type TokenEnvelopeContext = {
  /** Rótulo estável do formato no AAD (ex.: "mercado-livre", "metricool"). Nunca mude depois de gravar dados. */
  scope: string;
  provider: string;
  organizationId: string;
  externalAccountId: string;
};

function aad(context: TokenEnvelopeContext): Buffer {
  for (const value of [context.scope, context.provider, context.organizationId, context.externalAccountId]) {
    if (!value || value.length > 256 || value.includes(":")) throw new Error("Invalid token encryption context.");
  }
  return Buffer.from(
    `smkon:${context.scope}:v1:${context.organizationId}:${context.provider}:${context.externalAccountId}`,
    "utf8",
  );
}

function activeKey(keyring: TokenKeyring): Buffer {
  const key = keyring.keys[keyring.activeKeyId];
  if (!KEY_ID_PATTERN.test(keyring.activeKeyId) || !key || key.length !== 32) {
    throw new Error("Token encryption keyring is not configured correctly.");
  }
  return key;
}

function decodeBase64(value: unknown, expectedLength?: number): Buffer {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error("Invalid encrypted token envelope.");
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.toString("base64") !== value || (expectedLength !== undefined && decoded.length !== expectedLength)) {
    throw new Error("Invalid encrypted token envelope.");
  }
  return decoded;
}

export function isTokenEnvelope(value: unknown): value is TokenEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort().join(",");
  return keys === "alg,ciphertext,iv,kid,tag,v";
}

export function encryptToken(plaintext: string, context: TokenEnvelopeContext, keyring: TokenKeyring): TokenEnvelope {
  if (!plaintext || Buffer.byteLength(plaintext, "utf8") > MAX_TOKEN_BYTES) {
    throw new Error("Invalid token payload.");
  }
  const key = activeKey(keyring);
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

export function decryptToken(envelope: unknown, context: TokenEnvelopeContext, keyring: TokenKeyring): string {
  const additionalData = aad(context);
  if (!isTokenEnvelope(envelope) || envelope.v !== VERSION || envelope.alg !== ALGORITHM || !KEY_ID_PATTERN.test(envelope.kid)) {
    throw new Error("Unsupported encrypted token envelope.");
  }
  const key = keyring.keys[envelope.kid];
  if (!key || key.length !== 32) throw new Error("Token decryption key is unavailable.");
  const iv = decodeBase64(envelope.iv, IV_BYTES);
  const tag = decodeBase64(envelope.tag, TAG_BYTES);
  const ciphertext = decodeBase64(envelope.ciphertext);
  if (ciphertext.length > MAX_TOKEN_BYTES) throw new Error("Encrypted token payload is too large.");
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAAD(additionalData);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Token authentication failed.");
  }
}

/** Lê uma chave base64 de 32 bytes das variáveis indicadas, sem expor o valor em erros. */
export function loadTokenKeyring(
  keyVar: string,
  keyIdVar: string,
  env: Record<string, string | undefined> = process.env,
): TokenKeyring {
  const keyId = env[keyIdVar] ?? "primary";
  const encoded = env[keyVar];
  if (!encoded) throw new Error(`${keyVar} is not configured.`);
  if (!KEY_ID_PATTERN.test(keyId)) throw new Error(`${keyIdVar} is invalid.`);
  return { activeKeyId: keyId, keys: { [keyId]: decodeBase64(encoded, 32) } };
}
