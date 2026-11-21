/**
 * Catálogo do Hub de Conectores (S17). Puro e sem I/O: descreve o que cada plataforma
 * permite de fato pelas APIs oficiais, para a UI e os conectores não prometerem o que
 * não existe. Atualize somente com base na documentação oficial do provedor.
 */

export type SocialNetwork =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "pinterest"
  | "linkedin"
  | "threads"
  | "x";

export type SocialAccountType = "business" | "creator" | "page" | "channel" | "personal";
export type SocialVia = "metricool" | "native";
export type SocialCapability =
  | "publish"
  | "read_metrics"
  | "update_bio"
  | "update_photo"
  | "update_link"
  | "read_comments";

export type ExternalAction = "publish_post" | "update_bio" | "update_photo" | "update_link";

export type RevenueProvider =
  | "mercado_livre"
  | "hotmart"
  | "shopify"
  | "stripe"
  | "meta_ads"
  | "google_ads"
  | "tiktok_shop_seller"
  | "tiktok_shop_affiliate"
  | "amazon_associates";

export type IntegrationPhase = "active" | "next" | "planned";

export type SocialNetworkInfo = {
  network: SocialNetwork;
  label: string;
  accountTypes: SocialAccountType[];
  via: SocialVia[];
  /** Capacidades possíveis por API oficial, independentemente do caminho. */
  nativeCapabilities: SocialCapability[];
  /** O que não existe na API oficial e precisa ser feito no app pelo usuário. */
  manualOnly: string[];
};

export const SOCIAL_NETWORKS: readonly SocialNetworkInfo[] = [
  { network: "instagram", label: "Instagram", accountTypes: ["business", "creator"], via: ["metricool", "native"], nativeCapabilities: ["publish", "read_metrics", "read_comments"], manualOnly: ["foto de perfil", "bio", "link da bio"] },
  { network: "facebook", label: "Facebook", accountTypes: ["page"], via: ["metricool", "native"], nativeCapabilities: ["publish", "read_metrics", "read_comments"], manualOnly: ["foto de perfil"] },
  { network: "tiktok", label: "TikTok", accountTypes: ["business", "creator"], via: ["metricool", "native"], nativeCapabilities: ["publish", "read_metrics"], manualOnly: ["foto de perfil", "bio", "link da bio"] },
  { network: "youtube", label: "YouTube", accountTypes: ["channel"], via: ["metricool", "native"], nativeCapabilities: ["publish", "read_metrics", "read_comments", "update_bio"], manualOnly: ["foto do canal"] },
  { network: "pinterest", label: "Pinterest", accountTypes: ["business", "creator"], via: ["metricool", "native"], nativeCapabilities: ["publish", "read_metrics"], manualOnly: ["foto de perfil", "bio"] },
  { network: "linkedin", label: "LinkedIn", accountTypes: ["page", "personal"], via: ["metricool", "native"], nativeCapabilities: ["publish"], manualOnly: ["foto de perfil", "bio"] },
  { network: "threads", label: "Threads", accountTypes: ["business", "creator"], via: ["metricool", "native"], nativeCapabilities: ["publish", "read_metrics"], manualOnly: ["foto de perfil", "bio"] },
  { network: "x", label: "X", accountTypes: ["business", "creator", "personal"], via: ["native"], nativeCapabilities: ["publish", "read_metrics", "update_bio", "update_photo", "update_link"], manualOnly: [] },
];

/** Pelo Metricool só há publicação e métricas; edição de perfil exige API nativa. */
const METRICOOL_CAPABILITIES: readonly SocialCapability[] = ["publish", "read_metrics"];

export type RevenueProviderInfo = {
  provider: RevenueProvider;
  label: string;
  domains: ("owned_sales" | "affiliate" | "paid_media")[];
  phase: IntegrationPhase;
  summary: string;
};

export const REVENUE_PROVIDERS: readonly RevenueProviderInfo[] = [
  { provider: "mercado_livre", label: "Mercado Livre", domains: ["owned_sales"], phase: "active", summary: "Pedidos por OAuth, somente leitura." },
  { provider: "hotmart", label: "Hotmart", domains: ["owned_sales", "affiliate"], phase: "active", summary: "Vendas de produtor e comissões de afiliado por webhook (S18)." },
  { provider: "shopify", label: "Shopify", domains: ["owned_sales"], phase: "planned", summary: "Pedidos e produtos da loja própria." },
  { provider: "stripe", label: "Stripe", domains: ["owned_sales"], phase: "planned", summary: "Pagamentos e assinaturas próprios." },
  { provider: "meta_ads", label: "Meta Ads", domains: ["paid_media"], phase: "planned", summary: "Custo de mídia paga." },
  { provider: "google_ads", label: "Google Ads", domains: ["paid_media"], phase: "planned", summary: "Custo de mídia paga." },
  { provider: "tiktok_shop_seller", label: "TikTok Shop (vendedor)", domains: ["owned_sales"], phase: "planned", summary: "Pedidos da loja no TikTok." },
  { provider: "tiktok_shop_affiliate", label: "TikTok Shop (afiliado)", domains: ["affiliate"], phase: "planned", summary: "Comissões de afiliado no TikTok." },
  { provider: "amazon_associates", label: "Amazon Associados", domains: ["affiliate"], phase: "planned", summary: "Comissões de afiliado." },
];

export const ACTION_CAPABILITY: Record<ExternalAction, SocialCapability> = {
  publish_post: "publish",
  update_bio: "update_bio",
  update_photo: "update_photo",
  update_link: "update_link",
};

export function networkInfo(network: SocialNetwork): SocialNetworkInfo {
  const info = SOCIAL_NETWORKS.find((item) => item.network === network);
  if (!info) throw new Error(`unknown_network:${network}`);
  return info;
}

/**
 * Capacidades reais de uma conta, para gravar em social_accounts.capabilities na conexão.
 * Retorna null quando a combinação não é permitida (mesmas regras das constraints do banco).
 */
export function resolveCapabilities(
  network: SocialNetwork,
  accountType: SocialAccountType,
  via: SocialVia,
  grantedScopes: readonly SocialCapability[] | null = null,
): SocialCapability[] | null {
  const info = networkInfo(network);
  if (!info.accountTypes.includes(accountType) || !info.via.includes(via)) return null;
  const possible = via === "metricool"
    ? info.nativeCapabilities.filter((capability) => METRICOOL_CAPABILITIES.includes(capability))
    : [...info.nativeCapabilities];
  return grantedScopes ? possible.filter((capability) => grantedScopes.includes(capability)) : possible;
}

export function canPerform(action: ExternalAction, capabilities: readonly SocialCapability[]): boolean {
  return capabilities.includes(ACTION_CAPABILITY[action]);
}

const MAX_CAPTION = 2200;
const MAX_BIO = 1000;

export type ActionPayloadResult =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; error: string };

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Normaliza o payload antes de criar o pedido: o hash aprovado é calculado sobre exatamente
 * o que for enviado, então campos extras ou formatos ambíguos são recusados aqui.
 */
export function normalizeActionPayload(action: ExternalAction, input: unknown): ActionPayloadResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "payload_must_be_object" };
  }
  const raw = input as Record<string, unknown>;
  switch (action) {
    case "publish_post": {
      const caption = typeof raw.caption === "string" ? raw.caption.trim() : "";
      const mediaIds = Array.isArray(raw.mediaIds) ? raw.mediaIds : [];
      if (!caption && mediaIds.length === 0) return { ok: false, error: "post_requires_caption_or_media" };
      if (caption.length > MAX_CAPTION) return { ok: false, error: "caption_too_long" };
      if (mediaIds.length > 10 || !mediaIds.every((id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id))) {
        return { ok: false, error: "invalid_media_ids" };
      }
      const contentItemId = raw.contentItemId;
      if (contentItemId !== undefined && (typeof contentItemId !== "string" || !/^[0-9a-f-]{36}$/i.test(contentItemId))) {
        return { ok: false, error: "invalid_content_item_id" };
      }
      return {
        ok: true,
        payload: { caption, mediaIds, ...(contentItemId ? { contentItemId } : {}) },
      };
    }
    case "update_bio": {
      const bio = typeof raw.bio === "string" ? raw.bio.trim() : "";
      if (!bio) return { ok: false, error: "bio_required" };
      if (bio.length > MAX_BIO) return { ok: false, error: "bio_too_long" };
      return { ok: true, payload: { bio } };
    }
    case "update_link":
      return isHttpsUrl(raw.url) ? { ok: true, payload: { url: raw.url } } : { ok: false, error: "https_url_required" };
    case "update_photo": {
      const mediaId = raw.mediaId;
      return typeof mediaId === "string" && /^[0-9a-f-]{36}$/i.test(mediaId)
        ? { ok: true, payload: { mediaId } }
        : { ok: false, error: "invalid_media_id" };
    }
  }
}
