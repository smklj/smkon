import type { createClient } from "@/lib/supabase/server";
import type { EvidenceRow, ProductRow } from "./types";
import type { EvidenceInput, ProductInput } from "./validation";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export const PRODUCT_COLUMNS =
  "id,name,source,type,status,revenue_domain,price_cents,currency,commission_percent,affiliate_url,external_id,score,score_reasons,updated_at";

export const EVIDENCE_COLUMNS =
  "id,kind,claim,source_url,value,observed_at,captured_by,review_status,reviewed_by,reviewed_at,review_note";

function toReasons(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toProduct(row: Record<string, unknown>): ProductRow {
  return { ...(row as unknown as ProductRow), score: row.score === null ? null : Number(row.score), score_reasons: toReasons(row.score_reasons) };
}

export async function listProducts(supabase: SupabaseClient, organizationId: string, includeArchived = false): Promise<ProductRow[]> {
  let query = supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("organization_id", organizationId)
    .order("score", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(200);
  if (!includeArchived) query = query.neq("status", "archived");
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => toProduct(row as unknown as Record<string, unknown>));
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

export function canEditProducts(role: string): boolean {
  return role === "owner" || role === "admin";
}

export function canAddEvidence(role: string): boolean {
  return role === "owner" || role === "admin" || role === "analyst";
}
