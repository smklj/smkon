import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findWorkspace } from "@/lib/tenancy/workspace";
import { executeExternalActionRequest } from "@/lib/integrations/metricool/service";
import { jsonError, toErrorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonError(401, "not_authenticated", "Não autenticado.");

    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return jsonError(404, "workspace_not_found", "Workspace não encontrado.");

    if (workspace.role !== "owner" && workspace.role !== "admin") {
      return jsonError(403, "forbidden", "Apenas Owner ou Admin podem executar ações externas.");
    }

    let body: { requestId?: string };
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "invalid_json", "JSON inválido.");
    }

    if (!body.requestId) {
      return jsonError(400, "invalid_input", "requestId é obrigatório.");
    }

    const result = await executeExternalActionRequest(body.requestId);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.message, code: result.errorCode },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, externalRef: result.externalRef });
  } catch (error) {
    return toErrorResponse("api.actions.external.execute", error, "Erro ao executar ação externa.");
  }
}
