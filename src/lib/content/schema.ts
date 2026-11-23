/**
 * Conteúdo (Studio) · schema: tipos de entrada e validação (S4).
 * Usa as primitivas centralizadas de src/lib/validation/fields.ts.
 * Imports relativos com `.ts` para rodar em `node --test`.
 */
import { ValidationError } from "../http/errors.ts";
import { isOptionalHttpsUrl, isPlainObject, isUuid } from "../validation/fields.ts";
import { parseSceneDocument } from "../scene/schema.ts";
import type { SceneDocument } from "../scene/types.ts";
import { CHANNELS, type ContentPayload, type ContentStatusApi, type WritableContentStatus } from "./types.ts";

export const CONTENT_HASH_PATTERN = /^[a-f0-9]{64}$/;

export const CONTENT_STATUSES: readonly ContentStatusApi[] = ["draft", "approved", "archived"];

/** "approved" só é alcançado pelo fluxo de aprovação (approve_content), nunca pela escrita direta. */
const WRITABLE_STATUSES = new Set<WritableContentStatus>(["draft", "archived"]);
const allowedChannels = new Set<string>(CHANNELS);

/** Colunas que a aplicação escreve; version, content_hash e approved_* são calculados pelo banco. */
export type ContentWrite = {
  title: string;
  product: string;
  source_url: string;
  asset_url: string;
  script: string;
  caption: string;
  cta: string;
  hashtags: string;
  channels: string[];
  rights_confirmed: boolean;
  media_asset_id: string | null;
  status: WritableContentStatus;
};

export type ApproveInput = { id: string; contentHash: string; note: string | undefined };

/** Filtro de status da lista (?status=); ausente ou "all" lista todos. Valor desconhecido é recusado. */
export function parseContentStatusFilter(raw: string | null): ContentStatusApi | null | "invalid" {
  if (raw === null || raw === "" || raw === "all") return null;
  return (CONTENT_STATUSES as readonly string[]).includes(raw) ? (raw as ContentStatusApi) : "invalid";
}

/** Corpo JSON das rotas de escrita: precisa ser um objeto. */
export async function readContentJson(request: Request): Promise<ContentPayload> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Corpo da requisição inválido.");
  }
  if (!isPlainObject(body)) throw new ValidationError("Corpo da requisição inválido.");
  return body as ContentPayload;
}

/** Identificador da peça (PATCH/DELETE): UUID estrito. */
export function parseContentId(value: unknown): string {
  if (!isUuid(value)) throw new ValidationError("Identificador inválido.");
  return value;
}

/** Valida o corpo do Studio e monta as colunas graváveis, com os limites de tamanho do banco. */
export function parseContentPayload(payload: ContentPayload): ContentWrite {
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const channels: string[] = Array.isArray(payload.channels) ? payload.channels : [];
  if (!title || title.length > 180) throw new ValidationError("Informe um título de até 180 caracteres.");
  if (channels.length === 0 || channels.some((channel) => !allowedChannels.has(channel))) {
    throw new ValidationError("Selecione ao menos um canal válido.");
  }

  const sourceUrl = typeof payload.sourceUrl === "string" ? payload.sourceUrl.trim() : "";
  const assetUrl = typeof payload.assetUrl === "string" ? payload.assetUrl.trim() : "";
  if (!isOptionalHttpsUrl(sourceUrl)) throw new ValidationError("O vídeo de referência deve usar HTTPS.");
  if (!isOptionalHttpsUrl(assetUrl)) throw new ValidationError("O link do produto deve usar HTTPS.");
  if (sourceUrl && payload.rightsConfirmed !== true) {
    throw new ValidationError("Confirme os direitos de uso do vídeo de referência.");
  }

  const mediaAssetId = payload.mediaAssetId ? String(payload.mediaAssetId) : null;
  if (mediaAssetId && !isUuid(mediaAssetId)) throw new ValidationError("Mídia inválida.");

  const status = payload.status ?? "draft";
  if (!WRITABLE_STATUSES.has(status)) {
    throw new ValidationError("Status inválido. Para aprovar, use o fluxo de aprovação.");
  }

  return {
    title,
    product: String(payload.product ?? "").slice(0, 180),
    source_url: sourceUrl.slice(0, 2048),
    asset_url: assetUrl.slice(0, 2048),
    script: String(payload.script ?? "").slice(0, 20000),
    caption: String(payload.caption ?? "").slice(0, 10000),
    cta: String(payload.cta ?? "").slice(0, 1000),
    hashtags: String(payload.hashtags ?? "").slice(0, 2000),
    channels: [...new Set(channels)],
    rights_confirmed: payload.rightsConfirmed === true,
    // O banco confere se a mídia é do mesmo workspace e não está arquivada (invalid_media).
    media_asset_id: mediaAssetId,
    status,
  };
}

/**
 * Aprovação da versão exata: id, hash SHA-256 da versão que o revisor viu e nota opcional.
 * Aceita qualquer corpo JSON decodificado (inclusive null/array, recusados pelo id).
 */
export function parseApproveInput(body: unknown): ApproveInput {
  const value = (body !== null && typeof body === "object" ? body : {}) as { id?: unknown; contentHash?: unknown; note?: unknown };
  if (!isUuid(value.id)) throw new ValidationError("Identificador inválido.");
  const contentHash = value.contentHash;
  if (typeof contentHash !== "string" || !CONTENT_HASH_PATTERN.test(contentHash)) {
    throw new ValidationError("Hash da versão inválido.");
  }
  const note = typeof value.note === "string" ? value.note.slice(0, 1000) : undefined;
  return { id: value.id as string, contentHash, note };
}

/** Gravação do design da peça (PUT /api/content/scene). */
export type SceneWriteInput = {
  id: string;
  /** null remove o design da peça (também é uma edição versionada). */
  scene: SceneDocument | null;
  /** Hash da versão que o editor abriu: protege contra sobrescrever uma edição mais nova. */
  expectedHash: string | null;
};

export function parseSceneWrite(body: unknown): SceneWriteInput {
  if (!isPlainObject(body)) throw new ValidationError("Corpo da requisição inválido.");
  const value = body as { id?: unknown; scene?: unknown; expectedHash?: unknown };
  if (!isUuid(value.id)) throw new ValidationError("Identificador inválido.");
  if (!("scene" in value)) throw new ValidationError("Informe o documento de cena (ou null para remover).");
  const expectedHash = value.expectedHash ?? null;
  if (expectedHash !== null && (typeof expectedHash !== "string" || !CONTENT_HASH_PATTERN.test(expectedHash))) {
    throw new ValidationError("Hash da versão inválido.");
  }
  return {
    id: value.id as string,
    scene: value.scene === null ? null : parseSceneDocument(value.scene),
    expectedHash: expectedHash as string | null,
  };
}
