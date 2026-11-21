import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cancelExternalAction } from "@/lib/actions/external";
import { jsonError, toErrorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonError(401, "not_authenticated", "Não autenticado.");

    let body: { requestId?: string };
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "invalid_json", "JSON inválido.");
    }

    if (!body.requestId) {
      return jsonError(400, "invalid_input", "requestId é obrigatório.");
    }

    await cancelExternalAction(supabase, body.requestId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse("api.actions.external.cancel", error, "Erro ao cancelar ação externa.");
  }
}
