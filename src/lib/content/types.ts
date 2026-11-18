/** Shared Content Studio types and mappers (API ↔ UI). */

export type ContentChannel = "YouTube" | "Instagram" | "TikTok";

export type ContentStatusApi = "draft" | "approved" | "archived";
export type ContentStatusLabel = "Rascunho" | "Aprovado" | "Arquivado";

/** Row shape returned by /api/content (snake_case from DB). */
export type ContentItemRow = {
  id: string;
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
  status: ContentStatusApi;
  created_at: string;
  updated_at: string;
};

/** UI / client shape (camelCase + PT labels). */
export type ContentItem = {
  id: string;
  title: string;
  product: string;
  sourceUrl: string;
  assetUrl: string;
  script: string;
  caption: string;
  cta: string;
  hashtags: string;
  channels: ContentChannel[];
  rightsConfirmed: boolean;
  status: ContentStatusLabel;
  updatedAt: string;
  createdAt?: string;
};

/** Payload accepted by POST/PATCH. */
export type ContentPayload = {
  id?: string;
  title?: string;
  product?: string;
  sourceUrl?: string;
  assetUrl?: string;
  script?: string;
  caption?: string;
  cta?: string;
  hashtags?: string;
  channels?: string[];
  rightsConfirmed?: boolean;
  status?: ContentStatusApi;
};

export const CHANNELS: ContentChannel[] = ["YouTube", "Instagram", "TikTok"];

export const STATUS_TO_LABEL: Record<ContentStatusApi, ContentStatusLabel> = {
  draft: "Rascunho",
  approved: "Aprovado",
  archived: "Arquivado",
};

export const LABEL_TO_STATUS: Record<ContentStatusLabel, ContentStatusApi> = {
  Rascunho: "draft",
  Aprovado: "approved",
  Arquivado: "archived",
};

/** Legacy localStorage draft shape (pre-API). */
export type LegacyDraft = {
  id: string;
  title: string;
  product: string;
  sourceUrl: string;
  assetUrl: string;
  script: string;
  caption: string;
  cta: string;
  hashtags: string;
  channels: ContentChannel[];
  rightsConfirmed: boolean;
  status: "Rascunho" | "Aprovado";
  updatedAt: string;
};

export const LEGACY_STORAGE_KEY = "smkon-content-studio-v1";

export function rowToItem(row: ContentItemRow): ContentItem {
  const channels = (row.channels ?? []).filter((c): c is ContentChannel =>
    CHANNELS.includes(c as ContentChannel),
  );
  return {
    id: row.id,
    title: row.title ?? "",
    product: row.product ?? "",
    sourceUrl: row.source_url ?? "",
    assetUrl: row.asset_url ?? "",
    script: row.script ?? "",
    caption: row.caption ?? "",
    cta: row.cta ?? "",
    hashtags: row.hashtags ?? "",
    channels: channels.length > 0 ? channels : [...CHANNELS],
    rightsConfirmed: row.rights_confirmed === true,
    status: STATUS_TO_LABEL[row.status] ?? "Rascunho",
    updatedAt: row.updated_at ?? new Date().toISOString(),
    createdAt: row.created_at,
  };
}

export function itemToPayload(item: ContentItem, status?: ContentStatusApi): ContentPayload {
  return {
    id: item.id || undefined,
    title: item.title,
    product: item.product,
    sourceUrl: item.sourceUrl,
    assetUrl: item.assetUrl,
    script: item.script,
    caption: item.caption,
    cta: item.cta,
    hashtags: item.hashtags,
    channels: item.channels,
    rightsConfirmed: item.rightsConfirmed,
    status: status ?? LABEL_TO_STATUS[item.status] ?? "draft",
  };
}

export function emptyItem(): ContentItem {
  return {
    id: "",
    title: "",
    product: "",
    sourceUrl: "",
    assetUrl: "",
    script: "",
    caption: "",
    cta: "",
    hashtags: "",
    channels: [...CHANNELS],
    rightsConfirmed: false,
    status: "Rascunho",
    updatedAt: new Date().toISOString(),
  };
}

/** Stable key for deduping localStorage migration against server items. */
export function migrationKey(item: { title: string; updatedAt?: string; updated_at?: string }): string {
  const ts = item.updatedAt ?? item.updated_at ?? "";
  return `${(item.title || "").trim().toLowerCase()}|${ts}`;
}
