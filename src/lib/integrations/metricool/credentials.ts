import {
  decryptToken,
  encryptToken,
  loadTokenKeyring,
  type TokenEnvelope,
  type TokenEnvelopeContext,
  type TokenKeyring,
} from "../shared/token-envelope.ts";

/**
 * Token do Metricool sempre cifrado em envelope AES-256-GCM, amarrado ao workspace e ao blog.
 * Não há token global de plataforma: cada workspace usa a própria conta do Metricool.
 */

export const METRICOOL_KEY_ENV = "INTEGRATION_TOKEN_ENCRYPTION_KEY";
export const METRICOOL_KEY_ID_ENV = "INTEGRATION_TOKEN_ENCRYPTION_KEY_ID";

function context(organizationId: string, blogId: string): TokenEnvelopeContext {
  return { scope: "metricool", provider: "metricool", organizationId, externalAccountId: blogId };
}

export function loadMetricoolKeyring(env: Record<string, string | undefined> = process.env): TokenKeyring {
  return loadTokenKeyring(METRICOOL_KEY_ENV, METRICOOL_KEY_ID_ENV, env);
}

export function sealMetricoolToken(
  userToken: string,
  organizationId: string,
  blogId: string,
  keyring: TokenKeyring,
): TokenEnvelope {
  return encryptToken(userToken.trim(), context(organizationId, blogId), keyring);
}

export function openMetricoolToken(
  envelope: unknown,
  organizationId: string,
  blogId: string,
  keyring: TokenKeyring,
): string {
  return decryptToken(envelope, context(organizationId, blogId), keyring);
}
