import "server-only";

import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit } from "@/lib/http/rate-limit";
import { findWorkspace } from "@/lib/tenancy/service";
import { assistConfig, type AssistConfig, type AssistFeature, type AssistStore } from "./assist";
import type { ProductFacts } from "./content-writer";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AssistContext = {
  supabase: Supabase;
  organizationId: string;
  role: string;
  config: AssistConfig | null;
  store(feature: AssistFeature): AssistStore;
};

/** Sessão, workspace, configuração da IA e operações de banco com a sessão do usuário. */
export async function assistContext(request: Request): Promise<AssistContext | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const workspace = await findWorkspace(supabase, user.id);
  if (!workspace) return null;
  const organizationId = workspace.organizationId;
  // Na Vercel, o token OIDC da invocação chega neste header (usado com AGENT_MODEL_AUTH=oidc).
  const config = assistConfig(process.env, request.headers.get("x-vercel-oidc-token"));

  return {
    supabase,
    organizationId,
    role: workspace.role,
    config,
    store(feature) {
      return {
        async consumeRateLimit() {
          return (await consumeRateLimit(supabase, "ai_assist")).allowed;
        },
        async spentSince(since) {
          const { data, error } = await supabase.rpc("ai_assist_spend_since", {
            p_organization_id: organizationId,
            p_since: since.toISOString(),
          });
          if (error) return Number.POSITIVE_INFINITY; // sem leitura do gasto, não chama o modelo
          const value = typeof data === "number" ? data : Number(data);
          return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
        },
        async recordUsage(usage) {
          const { error } = await supabase.rpc("ai_assist_record_usage", {
            p_organization_id: organizationId,
            p_feature: feature,
            p_model: usage.model,
            p_input_tokens: usage.inputTokens,
            p_output_tokens: usage.outputTokens,
            p_cost_usd: usage.costUsd,
          });
          if (error) throw error;
        },
      };
    },
  };
}

const MAX_EVIDENCE = 12;

/** Produto do workspace pelo nome (sem diferenciar maiúsculas) e só as evidências verificadas. */
export async function loadProductFacts(supabase: Supabase, organizationId: string, name: string): Promise<ProductFacts | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data: products, error } = await supabase
    .from("products")
    .select("id,name,type,source,revenue_domain,price_cents,currency,commission_percent")
    .eq("organization_id", organizationId)
    .ilike("name", trimmed.replace(/[%_\\]/g, (char) => `\\${char}`))
    .limit(1);
  if (error || !products?.length) return null;
  const product = products[0];
  const { data: evidence } = await supabase
    .from("product_evidence")
    .select("kind,claim,value,source_url,observed_at")
    .eq("organization_id", organizationId)
    .eq("product_id", product.id)
    .eq("review_status", "verified")
    .order("observed_at", { ascending: false })
    .limit(MAX_EVIDENCE);

  return {
    name: product.name,
    type: product.type,
    source: product.source,
    revenueDomain: product.revenue_domain,
    price: product.price_cents === null ? null : `${(product.price_cents / 100).toFixed(2)} ${product.currency ?? "BRL"}`,
    commissionPercent: product.commission_percent === null ? null : Number(product.commission_percent),
    evidence: (evidence ?? []).map((row) => ({
      kind: row.kind,
      claim: row.claim,
      value: row.value === null ? null : Number(row.value),
      source: row.source_url,
      observedAt: row.observed_at,
    })),
  };
}

/** Lê JSON do corpo com teto de tamanho. */
export async function readJsonBody(request: Request, maxBytes = 24_000): Promise<Record<string, unknown> | null> {
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > maxBytes) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
