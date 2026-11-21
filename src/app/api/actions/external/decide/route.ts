import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decideExternalAction } from "@/lib/actions/external";
import { jsonError, toErrorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonError(401, "not_authenticated", "Não autenticado.");

    let body: { requestId?: string; decision?: "approved" | "rejected"; expectedHash?: string; note?: string };
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "invalid_json", "JSON inválido.");
    }

    if (!body.requestId || !body.decision || !body.expectedHash) {
      return jsonError(400, "invalid_input", "requestId, decision e expectedHash são obrigatórios.");
    }

    if (body.decision !== "approved" && body.decision !== "rejected") {
      return jsonError(400, "invalid_decision", "decision deve ser 'approved' ou 'rejected'.");
    }

    const status = await decideExternalAction(supabase, {
      requestId: body.requestId,
      decision: body.decision,
      expectedHash: body.expectedHash,
      note: body.note,
    });

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    return toErrorResponse("api.actions.external.decide", error, "Erro ao processar decisão da ação.");
  }
}
