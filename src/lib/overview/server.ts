import type { createClient } from "@/lib/supabase/server";
import { emptyOverview, parseOverview, type WorkspaceOverview } from "./types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type OverviewResult = { overview: WorkspaceOverview; complete: boolean };

/**
 * Função ainda não existe no banco (código publicado antes da migration 20261119010000).
 * PostgREST responde PGRST202; Postgres direto, 42883.
 */
function isMissingFunction(error: { code?: string } | null): boolean {
  return error?.code === "PGRST202" || error?.code === "42883";
}

/**
 * Indicadores do workspace em uma leitura, calculados no banco sob a RLS do usuário.
 * Sem a migration S12 aplicada, cai para a contagem de conteúdo (comportamento anterior)
 * e sinaliza `complete: false`, para a tela não exibir zeros como se fossem dados reais.
 */
export async function loadWorkspaceOverview(supabase: SupabaseClient, organizationId: string): Promise<OverviewResult> {
  const { data, error } = await supabase.rpc("workspace_overview", { p_organization_id: organizationId });
  if (!error) return { overview: parseOverview(data), complete: true };
  if (!isMissingFunction(error)) throw error;

  const content = await supabase
    .from("content_items")
    .select("id,title,product,version,status,updated_at")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (content.error) throw content.error;

  const rows = content.data ?? [];
  const count = (status: string) => rows.filter((row) => row.status === status).length;
  const overview = emptyOverview();
  overview.content = { total: rows.length, draft: count("draft"), approved: count("approved"), archived: count("archived") };
  overview.approval_queue = rows
    .filter((row) => row.status === "draft")
    .slice(0, 5)
    .map((row) => ({ id: row.id, title: row.title, product: row.product, version: row.version, updated_at: row.updated_at }));
  return { overview, complete: false };
}
