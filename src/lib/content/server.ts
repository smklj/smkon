/** Utilidades server-side compartilhadas pelas rotas de conteúdo. */

export const CONTENT_SELECT_COLUMNS =
  "id,title,product,source_url,asset_url,script,caption,cta,hashtags,channels,rights_confirmed,status,version,content_hash,approved_version,approved_at,created_at,updated_at";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export const CONTENT_HASH_PATTERN = /^[a-f0-9]{64}$/;
