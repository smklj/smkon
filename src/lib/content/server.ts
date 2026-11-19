/** Utilidades server-side compartilhadas pelas rotas de conteúdo. */
import type { KeysetSpec } from "../pagination/keyset.ts";
import type { ContentStatusApi } from "./types.ts";

export const CONTENT_SELECT_COLUMNS =
  "id,title,product,source_url,asset_url,script,caption,cta,hashtags,channels,rights_confirmed,media_asset_id,status,version,content_hash,approved_version,approved_at,created_at,updated_at";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export const CONTENT_HASH_PATTERN = /^[a-f0-9]{64}$/;

/** Biblioteca do Studio: editado por último primeiro, id como desempate. Índice content_items_org_updated_id_idx (S16). */
export const CONTENT_KEYSET: KeysetSpec = {
  id: "content:v1",
  direction: "desc",
  keys: [
    { column: "updated_at", type: "timestamp" },
    { column: "id", type: "uuid" },
  ],
};

export const CONTENT_STATUSES: readonly ContentStatusApi[] = ["draft", "approved", "archived"];

/** Filtro de status da lista (?status=); ausente ou "all" lista todos. Valor desconhecido é recusado. */
export function parseContentStatusFilter(raw: string | null): ContentStatusApi | null | "invalid" {
  if (raw === null || raw === "" || raw === "all") return null;
  return (CONTENT_STATUSES as readonly string[]).includes(raw) ? (raw as ContentStatusApi) : "invalid";
}
