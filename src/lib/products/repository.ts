/**
 * Produtos · repository: acesso a dados (Supabase) do catálogo e das evidências (S4).
 * Só consultas e chamadas de RPC; regras de permissão ficam em service.ts e a
 * validação de entrada em schema.ts. O isolamento por workspace é garantido
 * pela RLS e reforçado pelo filtro organization_id em cada consulta.
 */
import { log } from "@/lib/observability/log";
import type { createClient } from "@/lib/supabase/server";
import { applyKeyset, decodeCursor, DEFAULT_PAGE_SIZE, toPage, type KeysetSpec, type Page } from "@/lib/pagination/keyset";
import type { EvidenceRow, ProductRow } from "./types";
import type { EvidenceInput, ProductInput } from "./schema";
import type { BindingData, BindingEvidence, BindingProduct, LatestEvidence } from "@/lib/scene/bindings";

export type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export const PRODUCT_COLUMNS =
  "id,name,source,type,status,revenue_domain,price_cents,currency,commission_percent,affiliate_url,external_id,score,score_reasons,updated_at";

/** A lista também lê score_rank: o cursor da próxima página é montado a partir dela. */
const PRODUCT_LIST_COLUMNS =
  "id,name,source,type,status,revenue_domain,price_cents,currency,commission_percent,affiliate_url,external_id,score,score_reasons,updated_at,score_rank";

/**
 * Catálogo: maior score primeiro, sem score no fim (score_rank = -1), mais recente
 * primeiro e id como desempate. Índice products_org_rank_keyset_idx (S16).
 */
export const PRODUCTS_KEYSET: KeysetSpec = {
  id: "products:v1",
  direction: "desc",
  keys: [
    { column: "score_rank", type: "integer" },
    { column: "updated_at", type: "timestamp" },
    { column: "id", type: "uuid" },
  ],
};

export const EVIDENCE_COLUMNS =
  "id,kind,claim,source_url,value,observed_at,captured_by,review_status,reviewed_by,reviewed_at,review_note";

function toReasons(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toProduct(row: Record<string, unknown>): ProductRow {
  return { ...(row as unknown as ProductRow), score: row.score === null ? null : Number(row.score), score_reasons: toReasons(row.score_reasons) };
}

export type ListProductsOptions = { includeArchived?: boolean; cursor?: string | null; pageSize?: number; search?: string | null };

/** Busca por nome (contém, sem diferenciar maiúsculas); % e _ do usuário são literais. */
export function nameSearchPattern(search: string): string {
  return `%${search.trim().replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** Coluna score_rank ainda não existe no banco (código publicado antes da migration 20261119120000). */
function isMissingScoreRank(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "42703" && (error.message ?? "").includes("score_rank");
}

/**
 * Uma página do catálogo. Cursor inválido lança InvalidCursorError (erro de validação).
 * Sem a migration S16 aplicada, devolve as primeiras 200 linhas como antes (sem próxima
 * página), para a tela não quebrar entre o deploy e a migration.
 */
export async function listProducts(
  supabase: SupabaseClient,
  organizationId: string,
  { includeArchived = false, cursor = null, pageSize = DEFAULT_PAGE_SIZE, search = null }: ListProductsOptions = {},
): Promise<Page<ProductRow>> {
  const after = decodeCursor(PRODUCTS_KEYSET, cursor);
  let query = supabase.from("products").select(PRODUCT_LIST_COLUMNS).eq("organization_id", organizationId);
  if (!includeArchived) query = query.neq("status", "archived");
  if (search && search.trim()) query = query.ilike("name", nameSearchPattern(search));
  const { data, error } = await applyKeyset(query, PRODUCTS_KEYSET, after, pageSize);
  if (error && isMissingScoreRank(error)) return listProductsLegacy(supabase, organizationId, includeArchived);
  if (error) throw error;
  const page = toPage(PRODUCTS_KEYSET, (data ?? []) as unknown as Record<string, unknown>[], pageSize);
  return { items: page.items.map(toProduct), nextCursor: page.nextCursor };
}

async function listProductsLegacy(supabase: SupabaseClient, organizationId: string, includeArchived: boolean): Promise<Page<ProductRow>> {
  log("warn", "products.list.legacy", { reason: "score_rank_missing" });
  let query = supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("organization_id", organizationId)
    .order("score", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(200);
  if (!includeArchived) query = query.neq("status", "archived");
  const { data, error } = await query;
  if (error) throw error;
  return { items: (data ?? []).map((row) => toProduct(row as unknown as Record<string, unknown>)), nextCursor: null };
}

export async function getProduct(supabase: SupabaseClient, organizationId: string, id: string): Promise<ProductRow | null> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toProduct(data as unknown as Record<string, unknown>) : null;
}

export async function createProduct(supabase: SupabaseClient, organizationId: string, input: ProductInput): Promise<string> {
  const { data, error } = await supabase
    .from("products")
    .insert({ organization_id: organizationId, ...input })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateProductStatus(supabase: SupabaseClient, organizationId: string, id: string, status: ProductRow["status"]) {
  const { error } = await supabase.from("products").update({ status }).eq("organization_id", organizationId).eq("id", id);
  if (error) throw error;
}

export async function listEvidence(supabase: SupabaseClient, organizationId: string, productId: string): Promise<EvidenceRow[]> {
  const { data, error } = await supabase
    .from("product_evidence")
    .select(EVIDENCE_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("product_id", productId)
    .order("observed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...(row as unknown as EvidenceRow), value: row.value === null ? null : Number(row.value) }));
}

export async function addEvidence(supabase: SupabaseClient, organizationId: string, productId: string, input: EvidenceInput) {
  const { error } = await supabase
    .from("product_evidence")
    .insert({ organization_id: organizationId, product_id: productId, ...input });
  if (error) throw error;
}

export async function reviewEvidence(
  supabase: SupabaseClient,
  evidenceId: string,
  decision: "verified" | "rejected",
  note: string | null,
): Promise<number | null> {
  const { data, error } = await supabase.rpc("review_product_evidence", {
    p_evidence_id: evidenceId,
    p_decision: decision,
    p_note: note ?? undefined,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row?.product_score ?? null;
}

/* ---------- dados para peças (F3: campos ligados ao produto) ---------- */

export type TemplateProduct = BindingProduct & { status: ProductRow["status"]; affiliateUrl: string | null };

type EvidenceDbRow = {
  id: string;
  product_id: string;
  kind: string;
  value: number | string | null;
  source_url: string;
  observed_at: string;
  review_status: BindingEvidence["reviewStatus"];
};

const BINDING_EVIDENCE_COLUMNS = "id,product_id,kind,value,source_url,observed_at,review_status";

function toBindingEvidence(row: EvidenceDbRow): BindingEvidence {
  return {
    id: row.id,
    productId: row.product_id,
    kind: row.kind,
    value: row.value === null ? null : Number(row.value),
    sourceUrl: row.source_url,
    observedAt: row.observed_at,
    reviewStatus: row.review_status,
  };
}

export async function getTemplateProducts(
  supabase: SupabaseClient,
  organizationId: string,
  ids: readonly string[],
): Promise<Record<string, TemplateProduct>> {
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from("products")
    .select("id,name,currency,status,affiliate_url")
    .eq("organization_id", organizationId)
    .in("id", [...ids]);
  if (error) throw error;
  const out: Record<string, TemplateProduct> = {};
  for (const row of data ?? []) {
    out[row.id] = { id: row.id, name: row.name, currency: row.currency, status: row.status as ProductRow["status"], affiliateUrl: row.affiliate_url };
  }
  return out;
}

/** Evidências pelos ids (qualquer status: quem chama decide; bindings.ts só aceita verificadas). */
export async function getEvidenceByIds(
  supabase: SupabaseClient,
  organizationId: string,
  ids: readonly string[],
): Promise<Record<string, BindingEvidence>> {
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from("product_evidence")
    .select(BINDING_EVIDENCE_COLUMNS)
    .eq("organization_id", organizationId)
    .in("id", [...ids]);
  if (error) throw error;
  const out: Record<string, BindingEvidence> = {};
  for (const row of (data ?? []) as EvidenceDbRow[]) out[row.id] = toBindingEvidence(row);
  return out;
}

/** Preço e avaliação verificados mais recentes de cada produto (observação mais nova). */
export async function getLatestVerifiedEvidence(
  supabase: SupabaseClient,
  organizationId: string,
  productIds: readonly string[],
): Promise<{ evidence: Record<string, BindingEvidence>; latest: LatestEvidence }> {
  const evidence: Record<string, BindingEvidence> = {};
  const latest: LatestEvidence = {};
  if (productIds.length === 0) return { evidence, latest };
  const { data, error } = await supabase
    .from("product_evidence")
    .select(BINDING_EVIDENCE_COLUMNS)
    .eq("organization_id", organizationId)
    .in("product_id", [...productIds])
    .in("kind", ["price", "rating"])
    .eq("review_status", "verified")
    .order("observed_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  for (const row of (data ?? []) as EvidenceDbRow[]) {
    const kind = row.kind as "price" | "rating";
    const slot = (latest[row.product_id] ??= {});
    if (slot[kind]) continue;
    slot[kind] = row.id;
    evidence[row.id] = toBindingEvidence(row);
  }
  return { evidence, latest };
}

/** Tudo que o design precisa para conferir os campos ligados. */
export async function getBindingData(
  supabase: SupabaseClient,
  organizationId: string,
  refs: { productIds: readonly string[]; evidenceIds: readonly string[] },
): Promise<BindingData> {
  const [products, evidence] = await Promise.all([
    getTemplateProducts(supabase, organizationId, refs.productIds),
    getEvidenceByIds(supabase, organizationId, refs.evidenceIds),
  ]);
  return { products, evidence };
}
