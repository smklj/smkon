import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findWorkspace } from "@/lib/tenancy/workspace";
import { createExternalActionRequest, listPendingExternalActions } from "@/lib/actions/external";
import { jsonError, toErrorResponse } from "@/lib/http/errors";
import type { ExternalAction } from "@/lib/integrations/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonError(401, "not_authenticated", "Não autenticado.");

    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return jsonError(404, "workspace_not_found", "Workspace não encontrado.");

    const items = await listPendingExternalActions(supabase, workspace.organizationId);
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse("api.actions.external.list", error, "Erro ao carregar ações externas.");
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonError(401, "not_authenticated", "Não autenticado.");

    let body: { socialAccountId?: string; action?: ExternalAction; payload?: unknown };
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "invalid_json", "JSON inválido.");
    }

    if (!body.socialAccountId || !body.action || !body.payload) {
      return jsonError(400, "invalid_input", "socialAccountId, action e payload são obrigatórios.");
    }

    const result = await createExternalActionRequest(supabase, {
      socialAccountId: body.socialAccountId,
      action: body.action,
      payload: body.payload,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return toErrorResponse("api.actions.external.create", error, "Erro ao criar pedido de ação externa.");
  }
}
