import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findWorkspace } from "@/lib/tenancy/workspace";
import { syncMetricoolAccountsForOrg } from "@/lib/integrations/metricool/service";
import { jsonError, toErrorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonError(401, "not_authenticated", "Não autenticado.");

    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return jsonError(404, "workspace_not_found", "Workspace não encontrado.");

    if (workspace.role !== "owner" && workspace.role !== "admin") {
      return jsonError(403, "forbidden", "Apenas Owner ou Admin podem sincronizar contas.");
    }

    const result = await syncMetricoolAccountsForOrg(workspace.organizationId);
    return NextResponse.json({ ok: true, synced: result.syncedCount });
  } catch (error) {
    return toErrorResponse("api.integrations.metricool.sync", error, "Falha ao sincronizar contas do Metricool.");
  }
}
