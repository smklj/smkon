import {
  REVENUE_DOMAIN_LABEL,
  SOURCE_LABEL,
  STATUS_LABEL,
  TYPE_LABEL,
  type ProductSource,
  type ProductStatus,
  type ProductType,
  type RevenueDomain,
} from "../products/types.ts";
import { STATUS_TO_LABEL, type ContentStatusApi } from "../content/types.ts";
import { LEDGER_ENTRY_LABEL, LEDGER_SOURCE_LABEL, type DataRow } from "./types.ts";

export type ProductRecord = {
  id: string;
  name: string;
  source: string;
  type: string;
  revenue_domain: string;
  price_cents: number | null;
  currency: string | null;
  commission_percent: number | string | null;
  score: number | string | null;
  status: string;
  updated_at: string;
};

export type ContentRecord = {
  id: string;
  title: string;
  product: string | null;
  channels: string[] | null;
  status: string;
  version: number;
  approved_version: number | null;
  updated_at: string;
};

export type LedgerRecord = {
  id: string;
  domain: string;
  entry_type: string;
  source_table: string;
  amount: number | string;
  currency: string;
  effective_at: string;
};

const toNumber = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Chave usada para ligar produto a conteúdo: o conteúdo guarda o nome do produto em texto. */
export const productKey = (name: string | null | undefined): string => (name ?? "").trim().toLocaleLowerCase("pt-BR");

export function mapProducts(products: readonly ProductRecord[], contents: readonly ContentRecord[]): DataRow[] {
  const contentCount = new Map<string, number>();
  for (const content of contents) {
    const key = productKey(content.product);
    if (key) contentCount.set(key, (contentCount.get(key) ?? 0) + 1);
  }
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    source: SOURCE_LABEL[product.source as ProductSource] ?? product.source,
    type: TYPE_LABEL[product.type as ProductType] ?? product.type,
    domain: REVENUE_DOMAIN_LABEL[product.revenue_domain as RevenueDomain] ?? product.revenue_domain,
    price: product.price_cents === null ? null : product.price_cents / 100,
    currency: product.currency ?? "BRL",
    commission: toNumber(product.commission_percent),
    score: toNumber(product.score),
    status: STATUS_LABEL[product.status as ProductStatus] ?? product.status,
    contents: contentCount.get(productKey(product.name)) ?? 0,
    updated_at: product.updated_at,
  }));
}

export function mapContents(contents: readonly ContentRecord[]): DataRow[] {
  return contents.map((content) => ({
    id: content.id,
    title: content.title,
    product: content.product?.trim() || null,
    channels: content.channels ?? [],
    status: STATUS_TO_LABEL[content.status as ContentStatusApi] ?? content.status,
    version: `v${content.version}`,
    approved_version: content.approved_version ? `v${content.approved_version}` : null,
    updated_at: content.updated_at,
  }));
}

export function mapLedger(entries: readonly LedgerRecord[]): DataRow[] {
  return entries.map((entry) => ({
    id: entry.id,
    effective_at: entry.effective_at,
    domain: REVENUE_DOMAIN_LABEL[entry.domain as RevenueDomain] ?? entry.domain,
    entry_type: LEDGER_ENTRY_LABEL[entry.entry_type] ?? entry.entry_type,
    amount: toNumber(entry.amount),
    currency: entry.currency,
    source: LEDGER_SOURCE_LABEL[entry.source_table] ?? entry.source_table,
  }));
}
