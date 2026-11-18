import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CONTENT_HASH_PATTERN, CONTENT_SELECT_COLUMNS, isUuid } from "@/lib/content/server";
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

    let body: { id?: unknown; contentHash?: unknown; note?: unknown };
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "invalid_input", "Corpo da requisição inválido.");
    }
    if (!isUuid(body?.id)) return jsonError(400, "invalid_input", "Identificador inválido.");
    if (typeof body.contentHash !== "string" || !CONTENT_HASH_PATTERN.test(body.contentHash)) {
      return jsonError(400, "invalid_input", "Hash da versão inválido.");
    }
    const note = typeof body.note === "string" ? body.note.slice(0, 1000) : null;

    const { error } = await supabase.rpc("approve_content", {
      p_content_id: body.id,
      p_expected_hash: body.contentHash,
      p_note: note,
    });
    if (error) throw error;

    const { data, error: readError } = await supabase
      .from("content_items")
      .select(CONTENT_SELECT_COLUMNS)
      .eq("id", body.id)
      .single();
    if (readError) throw readError;

    return NextResponse.json({ id: data.id, item: data });
  } catch (error) {
    return toErrorResponse("api.content.approve", error, "Não foi possível aprovar o conteúdo.");
  }
}
