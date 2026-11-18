/** SMKON Product Intelligence — tipos e rótulos compartilhados (espelham as constraints do banco). */

export const PRODUCT_SOURCES = ["kiwify", "hotmart", "shopify", "amazon", "manual", "other"] as const;
export type ProductSource = (typeof PRODUCT_SOURCES)[number];

export const PRODUCT_TYPES = ["digital", "info", "physical", "service", "unknown"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_STATUSES = ["discovered", "selected", "active", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

/** Mesmo vocabulário do enum public.smkon_revenue_domain. */
export const REVENUE_DOMAINS = ["owned_sales", "affiliate", "paid_media"] as const;
export type RevenueDomain = (typeof REVENUE_DOMAINS)[number];

export const EVIDENCE_KINDS = ["sales_page", "price", "commission", "rating", "refund_policy", "demand_signal", "other"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export type ReviewStatus = "pending" | "verified" | "rejected";

export const SOURCE_LABEL: Record<ProductSource, string> = {
  kiwify: "Kiwify",
  hotmart: "Hotmart",
  shopify: "Shopify",
  amazon: "Amazon",
  manual: "Manual",
  other: "Outra",
};

export const TYPE_LABEL: Record<ProductType, string> = {
  digital: "Digital",
  info: "Infoproduto",
  physical: "Físico",
  service: "Serviço",
  unknown: "Não definido",
};

export const STATUS_LABEL: Record<ProductStatus, string> = {
  discovered: "Descoberto",
  selected: "Selecionado",
  active: "Ativo",
  archived: "Arquivado",
};

export const REVENUE_DOMAIN_LABEL: Record<RevenueDomain, string> = {
  owned_sales: "Venda própria",
  affiliate: "Afiliado",
  paid_media: "Mídia paga",
};

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  pending: "Pendente",
  verified: "Verificada",
  rejected: "Rejeitada",
};

/** Regras de valor por tipo de evidência (iguais à constraint product_evidence_value_by_kind). */
export const EVIDENCE_KIND_META: Record<
  EvidenceKind,
  { label: string; hint: string; value: "required" | "optional" | "none"; unit?: string; min?: number; max?: number }
> = {
  sales_page: { label: "Página de venda", hint: "O produto está à venda neste link.", value: "none" },
  price: { label: "Preço", hint: "Preço exibido na página, na moeda do produto.", value: "required", unit: "valor", min: 0, max: 999_999_999 },
  commission: { label: "Comissão", hint: "Percentual de comissão publicado para afiliados.", value: "required", unit: "%", min: 0, max: 100 },
  rating: { label: "Avaliação", hint: "Nota média publicada (0 a 5).", value: "required", unit: "/5", min: 0, max: 5 },
  refund_policy: { label: "Reembolso", hint: "Política de reembolso publicada (prazo em dias, se houver).", value: "optional", unit: "dias", min: 0, max: 365 },
  demand_signal: { label: "Sinal de demanda", hint: "Busca, ranking ou volume público que indique procura.", value: "none" },
  other: { label: "Outra", hint: "Qualquer outra afirmação verificável.", value: "none" },
};

export type ProductRow = {
  id: string;
  name: string;
  source: ProductSource;
  type: ProductType;
  status: ProductStatus;
  revenue_domain: RevenueDomain;
  price_cents: number | null;
  currency: string;
  commission_percent: number | null;
  affiliate_url: string | null;
  external_id: string | null;
  score: number | null;
  score_reasons: string[];
  updated_at: string;
};

export type EvidenceRow = {
  id: string;
  kind: EvidenceKind;
  claim: string;
  source_url: string;
  value: number | null;
  observed_at: string;
  captured_by: string;
  review_status: ReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
};
