/**
 * S14 etapa 3 — ferramentas de leitura reais dos agentes (read_*).
 *
 * Regras:
 * - Organização vem de RunContext (banco), nunca da entrada do modelo; a porta ToolDb aplica o filtro sempre.
 * - Colunas mínimas e sem dados pessoais: nenhum created_by/captured_by/reviewed_by/e-mail; textos longos cortados.
 * - Saída limitada: no máximo 50 itens e TOOL_OUTPUT_MAX_BYTES (abaixo dos 64 KB do banco, com folga para o
 *   envelope do passo). Quando corta, devolve truncated = true — o modelo sabe que não viu tudo.
 * - Entrada estrita: chave desconhecida ou valor fora do domínio lança ToolInputError (o executor grava tool_error).
 * - Financeiro: vendas próprias, afiliados e mídia paga em blocos separados, por moeda; nunca somados entre si
 *   e sem misturar estados (previsto/aprovado/liquidado/pago/cancelado/estornado).
 */
import { jsonBytes } from "../limits.ts";
import type { JsonObject, ToolHandler, ToolRegistry } from "../types.ts";
import type { Filter, Row, ToolDb } from "./db.ts";

export const TOOL_MAX_ITEMS = 50;
export const TOOL_OUTPUT_MAX_BYTES = 60_000;
/** Linhas lidas por domínio financeiro para agregar. Acima disso o bloco sai com truncated = true. */
export const FINANCE_SCAN_LIMIT = 5_000;
export const FINANCE_PERIODS = [7, 30, 90] as const;
export const WORKSPACE_TIME_ZONE = "America/Sao_Paulo";

export class ToolInputError extends Error {
  constructor(message: string) {
    super(`invalid_input: ${message}`);
    this.name = "ToolInputError";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------------------------------------------

function strictInput(input: JsonObject, allowed: readonly string[]): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ToolInputError("entrada deve ser objeto");
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) throw new ToolInputError(`campo desconhecido "${key}"`);
  }
}

function optionalEnum<T extends string>(input: JsonObject, key: string, values: readonly T[]): T | undefined {
  const value = input[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !(values as readonly string[]).includes(value)) {
    throw new ToolInputError(`${key} deve ser um de: ${values.join(", ")}`);
  }
  return value as T;
}

function limitOf(input: JsonObject): number {
  const value = input.limit;
  if (value === undefined || value === null) return 20;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > TOOL_MAX_ITEMS) {
    throw new ToolInputError(`limit deve ser inteiro de 1 a ${TOOL_MAX_ITEMS}`);
  }
  return value;
}

function optionalBoolean(input: JsonObject, key: string, fallback: boolean): boolean {
  const value = input[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") throw new ToolInputError(`${key} deve ser booleano`);
  return value;
}

function optionalNumber(input: JsonObject, key: string, min: number, max: number): number | undefined {
  const value = input[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new ToolInputError(`${key} deve ser número de ${min} a ${max}`);
  }
  return value;
}

function uuidList(input: JsonObject, key: string, max: number): string[] | undefined {
  const value = input[key];
  if (value === undefined || value === null) return undefined;
  const list = typeof value === "string" ? [value] : value;
  if (!Array.isArray(list) || list.length === 0 || list.length > max) {
    throw new ToolInputError(`${key} deve ter de 1 a ${max} UUIDs`);
  }
  const ids = list.map((item) => {
    if (typeof item !== "string" || !UUID.test(item)) throw new ToolInputError(`${key} contém id inválido`);
    return item.toLowerCase();
  });
  return [...new Set(ids)];
}

// ---------------------------------------------------------------------------------------------------------------
// Saída
// ---------------------------------------------------------------------------------------------------------------

function clip(value: unknown, max: number): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * Monta { items, count, truncated, ...extra } garantindo ≤ TOOL_MAX_ITEMS e ≤ TOOL_OUTPUT_MAX_BYTES.
 * As ferramentas pedem limit + 1 linhas: se veio mais do que o pedido, truncated = true (havia mais).
 */
export function boundedList(items: JsonObject[], requested: number, extra: JsonObject = {}): JsonObject {
  let kept = items.slice(0, Math.min(requested, TOOL_MAX_ITEMS));
  let truncated = items.length > kept.length;
  const build = () => ({ ...extra, items: kept, count: kept.length, truncated });
  while (kept.length > 0 && jsonBytes(build()) > TOOL_OUTPUT_MAX_BYTES) {
    kept = kept.slice(0, Math.max(0, Math.floor(kept.length * 0.8)));
    truncated = true;
  }
  return build();
}

// ---------------------------------------------------------------------------------------------------------------
// Ferramentas
// ---------------------------------------------------------------------------------------------------------------

const PRODUCT_STATUSES = ["discovered", "selected", "active", "archived"] as const;
const EVIDENCE_STATUSES = ["pending", "verified", "rejected"] as const;
const CONTENT_STATUSES = ["draft", "approved", "archived"] as const;
const JOB_STATUSES = ["scheduled", "dry_run_passed", "dry_run_failed", "cancelled"] as const;

export const READ_COLUMNS = {
  products: ["id", "name", "source", "type", "status", "revenue_domain", "price_cents", "currency", "commission_percent", "score", "score_reasons", "updated_at"],
  product_evidence: ["id", "product_id", "kind", "claim", "source_url", "value", "observed_at", "review_status", "reviewed_at"],
  content_items: ["id", "title", "product", "status", "version", "approved_version", "channels", "caption", "cta", "hashtags", "script", "updated_at"],
  publication_jobs: ["id", "content_item_id", "content_version", "channel", "scheduled_for", "mode", "status", "last_run_at"],
  affiliate_commission_summary: ["currency", "conversions", "forecast_amount", "approved_amount", "settled_amount", "paid_amount", "cancelled_amount", "reversed_amount"],
  sales_orders: ["currency", "order_status", "gross_amount", "refund_amount", "fee_amount"],
  ad_campaign_daily_metrics: ["currency", "spend", "impressions", "clicks"],
} as const;

/** Colunas que nunca podem aparecer numa leitura de agente (dados pessoais / autoria). */
export const FORBIDDEN_COLUMNS = ["created_by", "captured_by", "reviewed_by", "approved_by", "cancelled_by", "email", "affiliate_url", "external_id", "review_note"] as const;

function readProducts(db: ToolDb): ToolHandler {
  return async (ctx, input, signal) => {
    strictInput(input, ["status", "min_score", "limit"]);
    const status = optionalEnum(input, "status", PRODUCT_STATUSES);
    const minScore = optionalNumber(input, "min_score", 0, 100);
    const limit = limitOf(input);
    const filters: Filter[] = [status ? { op: "eq", column: "status", value: status } : { op: "neq", column: "status", value: "archived" }];
    if (minScore !== undefined) filters.push({ op: "gte", column: "score", value: minScore });
    const rows = await db.select({
      table: "products",
      organizationId: ctx.organizationId,
      columns: READ_COLUMNS.products,
      filters,
      order: [{ column: "score", ascending: false, nullsFirst: false }, { column: "updated_at", ascending: false }],
      limit: limit + 1,
    }, signal);
    const items = rows.map((row) => ({
      id: row.id,
      name: clip(row.name, 200),
      source: row.source,
      type: row.type,
      status: row.status,
      revenue_domain: row.revenue_domain,
      price_cents: numberOrNull(row.price_cents),
      currency: row.currency,
      commission_percent: numberOrNull(row.commission_percent),
      score: numberOrNull(row.score),
      score_reasons: Array.isArray(row.score_reasons)
        ? row.score_reasons.filter((reason): reason is string => typeof reason === "string").slice(0, 5).map((reason) => clip(reason, 200))
        : [],
      updated_at: row.updated_at,
    }));
    return boundedList(items, limit, { note: "score nulo = evidência verificada insuficiente; não afirme qualidade sem read_product_evidence" });
  };
}

function readProductEvidence(db: ToolDb): ToolHandler {
  return async (ctx, input, signal) => {
    strictInput(input, ["product_ids", "review_status", "limit"]);
    const productIds = uuidList(input, "product_ids", 20);
    const reviewStatus = optionalEnum(input, "review_status", EVIDENCE_STATUSES);
    const limit = limitOf(input);
    const filters: Filter[] = [];
    if (productIds) filters.push({ op: "in", column: "product_id", value: productIds });
    if (reviewStatus) filters.push({ op: "eq", column: "review_status", value: reviewStatus });
    const rows = await db.select({
      table: "product_evidence",
      organizationId: ctx.organizationId,
      columns: READ_COLUMNS.product_evidence,
      filters,
      order: [{ column: "observed_at", ascending: false }],
      limit: limit + 1,
    }, signal);
    // Contrato consumido pelo Verifier (verifier.ts): id, product_id, review_status.
    const items = rows.map((row) => ({
      id: typeof row.id === "string" ? row.id.toLowerCase() : row.id,
      product_id: typeof row.product_id === "string" ? row.product_id.toLowerCase() : row.product_id,
      kind: row.kind,
      claim: clip(row.claim, 500),
      source_url: clip(row.source_url, 2048),
      value: numberOrNull(row.value),
      observed_at: row.observed_at,
      review_status: row.review_status,
      reviewed_at: row.reviewed_at ?? null,
    }));
    return boundedList(items, limit, { note: "só evidências com review_status = verified sustentam afirmações sobre produto" });
  };
}

function readContent(db: ToolDb): ToolHandler {
  return async (ctx, input, signal) => {
    strictInput(input, ["status", "limit"]);
    const status = optionalEnum(input, "status", CONTENT_STATUSES);
    const limit = limitOf(input);
    const rows = await db.select({
      table: "content_items",
      organizationId: ctx.organizationId,
      columns: READ_COLUMNS.content_items,
      filters: status ? [{ op: "eq", column: "status", value: status }] : [{ op: "neq", column: "status", value: "archived" }],
      order: [{ column: "updated_at", ascending: false }],
      limit: limit + 1,
    }, signal);
    const items = rows.map((row) => ({
      id: row.id,
      title: clip(row.title, 180),
      product: clip(row.product, 200),
      status: row.status,
      version: numberOrNull(row.version),
      approved_version: numberOrNull(row.approved_version),
      channels: Array.isArray(row.channels) ? row.channels.filter((channel) => typeof channel === "string") : [],
      caption: clip(row.caption, 600),
      cta: clip(row.cta, 200),
      hashtags: clip(row.hashtags, 300),
      script: clip(row.script, 1_000),
      updated_at: row.updated_at,
    }));
    return boundedList(items, limit);
  };
}

function readPublicationQueue(db: ToolDb, now: () => Date): ToolHandler {
  return async (ctx, input, signal) => {
    strictInput(input, ["status", "upcoming_only", "limit"]);
    const status = optionalEnum(input, "status", JOB_STATUSES);
    const upcomingOnly = optionalBoolean(input, "upcoming_only", true);
    const limit = limitOf(input);
    const filters: Filter[] = [status ? { op: "eq", column: "status", value: status } : { op: "neq", column: "status", value: "cancelled" }];
    if (upcomingOnly) filters.push({ op: "gte", column: "scheduled_for", value: now().toISOString() });
    const rows = await db.select({
      table: "publication_jobs",
      organizationId: ctx.organizationId,
      columns: READ_COLUMNS.publication_jobs,
      filters,
      order: [{ column: "scheduled_for", ascending: true }],
      limit: limit + 1,
    }, signal);
    const items = rows.map((row) => ({
      id: row.id,
      content_item_id: row.content_item_id,
      content_version: numberOrNull(row.content_version),
      channel: row.channel,
      scheduled_for: row.scheduled_for,
      mode: row.mode,
      status: row.status,
      last_run_at: row.last_run_at ?? null,
    }));
    return boundedList(items, limit, { note: "somente leitura; agentes não agendam, aprovam nem publicam" });
  };
}

// --- Financeiro ------------------------------------------------------------------------------------------------

const ZERO = BigInt(0);
const SCALE = BigInt(10_000); // numeric(18,4). Sem literais bigint: o tsconfig mira ES2017.

/** Converte numeric do PostgREST (número ou texto) em inteiro escalado por 10^4, sem ponto flutuante. */
export function toScaled(value: unknown): bigint {
  if (value === null || value === undefined || value === "") return ZERO;
  const text = typeof value === "number" ? value.toFixed(4) : String(value).trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) throw new Error(`numeric inválido: ${text.slice(0, 32)}`);
  const fraction = (match[3] ?? "").padEnd(4, "0").slice(0, 4);
  const scaled = BigInt(match[2]) * SCALE + BigInt(fraction);
  return match[1] === "-" ? -scaled : scaled;
}

export function formatScaled(value: bigint): string {
  const negative = value < ZERO;
  const absolute = negative ? -value : value;
  const whole = absolute / SCALE;
  const fraction = (absolute % SCALE).toString().padStart(4, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/** Data (YYYY-MM-DD) no fuso do workspace. */
export function workspaceDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: WORKSPACE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function currencyOf(row: Row): string {
  return typeof row.currency === "string" ? row.currency.trim().toUpperCase().slice(0, 3) : "???";
}

function readFinanceSummary(db: ToolDb, now: () => Date): ToolHandler {
  return async (ctx, input, signal) => {
    strictInput(input, ["period_days"]);
    const raw = input.period_days ?? 30;
    if (!(FINANCE_PERIODS as readonly unknown[]).includes(raw)) throw new ToolInputError(`period_days deve ser um de: ${FINANCE_PERIODS.join(", ")}`);
    const periodDays = raw as number;
    const since = new Date(now().getTime() - periodDays * 86_400_000);

    const [affiliateRows, salesRows, mediaRows] = await Promise.all([
      db.select({
        table: "affiliate_commission_summary",
        organizationId: ctx.organizationId,
        columns: READ_COLUMNS.affiliate_commission_summary,
        order: [{ column: "currency", ascending: true }],
        limit: TOOL_MAX_ITEMS,
      }, signal),
      db.select({
        table: "sales_orders",
        organizationId: ctx.organizationId,
        columns: READ_COLUMNS.sales_orders,
        filters: [{ op: "gte", column: "occurred_at", value: since.toISOString() }],
        limit: FINANCE_SCAN_LIMIT + 1,
      }, signal),
      db.select({
        table: "ad_campaign_daily_metrics",
        organizationId: ctx.organizationId,
        columns: READ_COLUMNS.ad_campaign_daily_metrics,
        filters: [{ op: "gte", column: "metric_date", value: workspaceDate(since) }],
        limit: FINANCE_SCAN_LIMIT + 1,
      }, signal),
    ]);

    // Afiliados: estado atual do ciclo de vida, por status (mesma regra do painel S12; não recortado por período).
    const affiliate = affiliateRows.map((row) => ({
      currency: currencyOf(row),
      conversions: numberOrNull(row.conversions) ?? 0,
      forecast: formatScaled(toScaled(row.forecast_amount)),
      approved: formatScaled(toScaled(row.approved_amount)),
      settled: formatScaled(toScaled(row.settled_amount)),
      paid: formatScaled(toScaled(row.paid_amount)),
      cancelled: formatScaled(toScaled(row.cancelled_amount)),
      reversed: formatScaled(toScaled(row.reversed_amount)),
    }));

    // Vendas próprias: bruto e taxas excluem pedidos cancelados; reembolsos à parte (regra do S12).
    const sales = new Map<string, { orders: number; gross: bigint; refunds: bigint; fees: bigint }>();
    for (const row of salesRows.slice(0, FINANCE_SCAN_LIMIT)) {
      const bucket = sales.get(currencyOf(row)) ?? { orders: 0, gross: ZERO, refunds: ZERO, fees: ZERO };
      const cancelled = row.order_status === "cancelled";
      if (!cancelled) {
        bucket.orders += 1;
        bucket.gross += toScaled(row.gross_amount);
        bucket.fees += toScaled(row.fee_amount);
      }
      bucket.refunds += toScaled(row.refund_amount);
      sales.set(currencyOf(row), bucket);
    }

    // Mídia paga: gasto é custo, nunca receita.
    const media = new Map<string, { spend: bigint; impressions: number; clicks: number }>();
    for (const row of mediaRows.slice(0, FINANCE_SCAN_LIMIT)) {
      const bucket = media.get(currencyOf(row)) ?? { spend: ZERO, impressions: 0, clicks: 0 };
      bucket.spend += toScaled(row.spend);
      bucket.impressions += numberOrNull(row.impressions) ?? 0;
      bucket.clicks += numberOrNull(row.clicks) ?? 0;
      media.set(currencyOf(row), bucket);
    }

    const sorted = <T>(map: Map<string, T>) => [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
    return {
      period_days: periodDays,
      since: since.toISOString(),
      note: "domínios separados e não somáveis entre si; valores em texto decimal com 4 casas, por moeda",
      affiliate: { scope: "lifecycle_current", by_currency: affiliate },
      owned_sales: {
        scope: "period",
        truncated: salesRows.length > FINANCE_SCAN_LIMIT,
        by_currency: sorted(sales).map(([currency, b]) => ({
          currency, orders: b.orders, gross: formatScaled(b.gross), refunds: formatScaled(b.refunds), fees: formatScaled(b.fees),
        })),
      },
      paid_media: {
        scope: "period",
        truncated: mediaRows.length > FINANCE_SCAN_LIMIT,
        by_currency: sorted(media).map(([currency, b]) => ({
          currency, spend: formatScaled(b.spend), impressions: b.impressions, clicks: b.clicks,
        })),
      },
    };
  };
}

export interface ReadToolOptions {
  now?: () => Date;
}

/** Registro das ferramentas de leitura sobre a porta ToolDb. draft_content entra na etapa 4. */
export function createReadTools(db: ToolDb, options: ReadToolOptions = {}): ToolRegistry {
  const now = options.now ?? (() => new Date());
  return {
    read_products: readProducts(db),
    read_product_evidence: readProductEvidence(db),
    read_content: readContent(db),
    read_publication_queue: readPublicationQueue(db, now),
    read_finance_summary: readFinanceSummary(db, now),
  };
}

