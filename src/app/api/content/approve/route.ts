import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { approveExactVersion } from "@/lib/content/service";
import { jsonError, toErrorResponse } from "@/lib/http/errors";

/**
 * Aprovação humana da versão exata.
 * O cliente envia o hash da versão que o revisor viu; o banco só aprova se o
 * conteúdo atual tiver exatamente esse hash (public.approve_content).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonError(401, "not_authenticated", "Não autenticado.");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "invalid_input", "Corpo da requisição inválido.");
    }

    // Validação (id e hash) → 400 invalid_input pela ValidationError; depois RPC e releitura.
    const data = await approveExactVersion(supabase, body);
    return NextResponse.json({ id: data.id, item: data });
  } catch (error) {
    return toErrorResponse("api.content.approve", error, "Não foi possível aprovar o conteúdo.");
  }
}
