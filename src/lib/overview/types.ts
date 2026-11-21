/**
 * S12 — indicadores do workspace (espelha public.workspace_overview).
 * O banco calcula tudo sob a RLS de quem consulta; este módulo só valida o formato
 * e normaliza a resposta, sem inventar valores: campo ausente ou inválido vira 0 ou lista vazia.
 */

export type ContentCounts = { total: number; draft: number; approved: number; archived: number };

export type ApprovalQueueItem = { id: string; title: string; product: string; version: number; updated_at: string };

export type ProductCounts = {
  total: number;
  discovered: number;
  selected: number;
  active: number;
  archived: number;
  scored: number;
  evidence_pending: number;
};

export type UpcomingPublication = { id: string; title: string; channel: string; scheduled_for: string; status: string };

export type PublicationCounts = {
  next_7_days: number;
  awaiting_dry_run: number;
  dry_run_passed: number;
  dry_run_failed: number;
  upcoming: UpcomingPublication[];
};

export type AffiliateTotals = {
  currency: string;
  conversions: number;
  forecast: number;
  approved: number;
  settled: number;
  paid: number;
  cancelled: number;
  reversed: number;
};

export type OwnedSalesTotals = { currency: string; orders: number; gross: number; refunds: number; fees: number };

export type PaidMediaTotals = { currency: string; spend: number; impressions: number; clicks: number };

export const CONNECTION_STATUSES = ["pending", "connected", "reauthorization_required", "disabled", "error"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export type ConnectionItem = {
  id: string;
  provider: string;
  domain: string;
  display_name: string | null;
  status: ConnectionStatus;
  last_synced_at: string | null;
};

export type DailyPoint = { day: string; count: number };

export type Trends = {
  content_created: DailyPoint[];
  publications_scheduled: DailyPoint[];
  agent_runs: DailyPoint[];
};

export type WorkspaceOverview = {
  generated_at: string;
  trends: Trends;
  content: ContentCounts;
  approval_queue: ApprovalQueueItem[];
  products: ProductCounts;
  publication: PublicationCounts;
  finance: {
    period_days: number;
    affiliate: AffiliateTotals[];
    owned_sales: OwnedSalesTotals[];
    paid_media: PaidMediaTotals[];
  };
  connections: { total: number; connected: number; attention: number; items: ConnectionItem[] };
};

export const CONNECTION_STATUS_LABEL: Record<ConnectionStatus, string> = {
  pending: "Pendente",
  connected: "Conectada",
  reauthorization_required: "Reautorizar",
  disabled: "Desativada",
  error: "Com erro",
};

export const CONNECTION_STATUS_TONE: Record<ConnectionStatus, "neutral" | "info" | "ok" | "warn" | "danger"> = {
  pending: "neutral",
  connected: "ok",
  reauthorization_required: "warn",
  disabled: "neutral",
  error: "danger",
};

export const PROVIDER_LABEL: Record<string, string> = {
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  mercado_livre: "Mercado Livre",
  tiktok_shop_seller: "TikTok Shop (vendedor)",
  tiktok_shop_affiliate: "TikTok Shop (afiliado)",
  amazon_associates: "Amazon Associados",
  hotmart: "Hotmart",
  shopify: "Shopify",
  stripe: "Stripe",
};

type Obj = Record<string, unknown>;

function obj(value: unknown): Obj {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : {};
}

function list(value: unknown): Obj[] {
  return Array.isArray(value) ? value.map(obj) : [];
}

/** Numeric do Postgres chega como number (jsonb). Aceita string numérica; o resto vira 0. */
function num(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableStr(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function series(value: unknown): DailyPoint[] {
  return list(value)
    .filter((row) => typeof row.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.day as string))
    .map((row) => ({ day: row.day as string, count: Math.max(0, Math.round(num(row.count))) }));
}

function connectionStatus(value: unknown): ConnectionStatus {
  return (CONNECTION_STATUSES as readonly string[]).includes(value as string) ? (value as ConnectionStatus) : "error";
}

export function parseOverview(raw: unknown): WorkspaceOverview {
  const root = obj(raw);
  const content = obj(root.content);
  const products = obj(root.products);
  const publication = obj(root.publication);
  const finance = obj(root.finance);
  const connections = obj(root.connections);
  const trends = obj(root.trends);

  return {
    generated_at: str(root.generated_at),
    trends: {
      content_created: series(trends.content_created),
      publications_scheduled: series(trends.publications_scheduled),
      agent_runs: series(trends.agent_runs),
    },
    content: {
      total: num(content.total),
      draft: num(content.draft),
      approved: num(content.approved),
      archived: num(content.archived),
    },
    approval_queue: list(root.approval_queue)
      .filter((row) => typeof row.id === "string")
      .map((row) => ({
        id: str(row.id),
        title: str(row.title, "Sem título"),
        product: str(row.product),
        version: num(row.version),
        updated_at: str(row.updated_at),
      })),
    products: {
      total: num(products.total),
      discovered: num(products.discovered),
      selected: num(products.selected),
      active: num(products.active),
      archived: num(products.archived),
      scored: num(products.scored),
      evidence_pending: num(products.evidence_pending),
    },
    publication: {
      next_7_days: num(publication.next_7_days),
      awaiting_dry_run: num(publication.awaiting_dry_run),
      dry_run_passed: num(publication.dry_run_passed),
      dry_run_failed: num(publication.dry_run_failed),
      upcoming: list(publication.upcoming)
        .filter((row) => typeof row.id === "string")
        .map((row) => ({
          id: str(row.id),
          title: str(row.title, "Sem título"),
          channel: str(row.channel),
          scheduled_for: str(row.scheduled_for),
          status: str(row.status),
        })),
    },
    finance: {
      period_days: num(finance.period_days) || 30,
      affiliate: list(finance.affiliate).map((row) => ({
        currency: str(row.currency, "BRL"),
        conversions: num(row.conversions),
        forecast: num(row.forecast),
        approved: num(row.approved),
        settled: num(row.settled),
        paid: num(row.paid),
        cancelled: num(row.cancelled),
        reversed: num(row.reversed),
      })),
      owned_sales: list(finance.owned_sales).map((row) => ({
        currency: str(row.currency, "BRL"),
        orders: num(row.orders),
        gross: num(row.gross),
        refunds: num(row.refunds),
        fees: num(row.fees),
      })),
      paid_media: list(finance.paid_media).map((row) => ({
        currency: str(row.currency, "BRL"),
        spend: num(row.spend),
        impressions: num(row.impressions),
        clicks: num(row.clicks),
      })),
    },
    connections: {
      total: num(connections.total),
      connected: num(connections.connected),
      attention: num(connections.attention),
      items: list(connections.items)
        .filter((row) => typeof row.id === "string")
        .map((row) => ({
          id: str(row.id),
          provider: str(row.provider),
          domain: str(row.domain),
          display_name: nullableStr(row.display_name),
          status: connectionStatus(row.status),
          last_synced_at: nullableStr(row.last_synced_at),
        })),
    },
  };
}

export function emptyOverview(): WorkspaceOverview {
  return parseOverview(null);
}

/** Comissão de afiliado em aberto: prevista + aprovada + liquidada (ainda não paga, não estornada). */
export function affiliateOpen(totals: AffiliateTotals): number {
  return totals.forecast + totals.approved + totals.settled;
}

/** Custo por clique; null quando não há clique (evita divisão por zero e número inventado). */
export function costPerClick(totals: PaidMediaTotals): number | null {
  return totals.clicks > 0 ? totals.spend / totals.clicks : null;
}

export function providerLabel(provider: string): string {
  return PROVIDER_LABEL[provider] ?? provider;
}

/** Soma de uma série diária. */
export function seriesTotal(points: DailyPoint[]): number {
  return points.reduce((sum, point) => sum + point.count, 0);
}
