import "server-only";

import { createClient } from "@/lib/supabase/server";
import { findWorkspace } from "@/lib/tenancy/service";
import { errorFields, log } from "@/lib/observability/log";
import { mapContents, mapLedger, mapProducts, type ContentRecord, type LedgerRecord, type ProductRecord } from "./mappers";
import { DATA_STUDIO_ROW_LIMIT, type DataStudioPayload } from "./types";

export type DataStudioState =
  | { state: "ok"; data: DataStudioPayload }
  | { state: "no-workspace" }
  | { state: "error" };

/**
 * Lê os dados do workspace com a sessão do usuário: a RLS decide o que cada papel vê.
 * Carrega até DATA_STUDIO_ROW_LIMIT + 1 linhas por modelo só para saber se há mais.
 */
export async function loadDataStudio(): Promise<DataStudioState> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { state: "no-workspace" };
    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return { state: "no-workspace" };
    const org = workspace.organizationId;
    const limit = DATA_STUDIO_ROW_LIMIT + 1;

    const [products, contents, ledger] = await Promise.all([
      supabase
        .from("products")
        .select("id,name,source,type,revenue_domain,price_cents,currency,commission_percent,score,status,updated_at")
        .eq("organization_id", org)
        .order("updated_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit),
      supabase
        .from("content_items")
        .select("id,title,product,channels,status,version,approved_version,updated_at")
        .eq("organization_id", org)
        .order("updated_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit),
      supabase
        .from("financial_ledger_entries")
        .select("id,domain,entry_type,source_table,amount,currency,effective_at")
        .eq("organization_id", org)
        .order("effective_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit),
    ]);

    for (const result of [products, contents, ledger]) {
      if (result.error) throw result.error;
    }

    const productRows = (products.data ?? []) as ProductRecord[];
    const contentRows = (contents.data ?? []) as ContentRecord[];
    const ledgerRows = (ledger.data ?? []) as LedgerRecord[];
    const cut = <T,>(rows: T[]) => rows.slice(0, DATA_STUDIO_ROW_LIMIT);

    return {
      state: "ok",
      data: {
        products: { rows: mapProducts(cut(productRows), contentRows), truncated: productRows.length > DATA_STUDIO_ROW_LIMIT },
        content: { rows: mapContents(cut(contentRows)), truncated: contentRows.length > DATA_STUDIO_ROW_LIMIT },
        ledger: { rows: mapLedger(cut(ledgerRows)), truncated: ledgerRows.length > DATA_STUDIO_ROW_LIMIT },
      },
    };
  } catch (error) {
    log("error", "data_studio.load", errorFields(error));
    return { state: "error" };
  }
}
