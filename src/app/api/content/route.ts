import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ValidationError, jsonError, toErrorResponse } from "@/lib/http/errors";
import { ensureWorkspace, findWorkspace } from "@/lib/tenancy/workspace";
import { CONTENT_KEYSET, deleteContent, emptyCounts, insertContent, updateContent } from "@/lib/content/repository";
import { parseContentPayload, parseContentStatusFilter, readContentJson } from "@/lib/content/schema";
import { canEditContent, listLibrary } from "@/lib/content/service";
import { isUuid } from "@/lib/validation/fields";
import { decodeCursor, parsePageSize } from "@/lib/pagination/keyset";

// Dados do workspace do usuário: nenhum cache compartilhado (CDN/proxy) nem do navegador (S16).
const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * Biblioteca do Studio paginada por cursor: ?cursor=&limit= (até 100) e ?status=draft|approved|archived.
 * Na primeira página (sem cursor) também devolve as contagens por status do workspace inteiro,
 * para os indicadores não dependerem de quantas peças já foram carregadas.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonError(401, "not_authenticated", "Não autenticado.");

    const params = new URL(request.url).searchParams;
    const status = parseContentStatusFilter(params.get("status"));
    if (status === "invalid") throw new ValidationError("Filtro de status inválido.");
    const after = decodeCursor(CONTENT_KEYSET, params.get("cursor"));
    const pageSize = parsePageSize(params.get("limit"));

    // Leitura sem efeito colateral: sem workspace, não há conteúdo.
    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return NextResponse.json({ items: [], nextCursor: null, counts: after ? null : emptyCounts(), role: null }, { headers: PRIVATE_NO_STORE });

    const page = await listLibrary(supabase, workspace.organizationId, status, after, pageSize);
    return NextResponse.json({ items: page.items, nextCursor: page.nextCursor, counts: page.counts, role: workspace.role }, { headers: PRIVATE_NO_STORE });
  } catch (error) {
    return toErrorResponse("api.content.get", error, "Não foi possível carregar os conteúdos.");
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonError(401, "not_authenticated", "Não autenticado.");

    const row = parseContentPayload(await readContentJson(request));
    const workspace = await ensureWorkspace(supabase);
    if (!canEditContent(workspace.role)) return jsonError(403, "forbidden", "Seu papel não permite criar conteúdo.");

    const data = await insertContent(supabase, workspace.organizationId, user.id, row);
    return NextResponse.json({ id: data.id, item: data }, { status: 201 });
  } catch (error) {
    return toErrorResponse("api.content.post", error, "Não foi possível salvar o conteúdo.");
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonError(401, "not_authenticated", "Não autenticado.");

    const payload = await readContentJson(request);
    if (!isUuid(payload.id)) return jsonError(400, "invalid_input", "Identificador inválido.");
    const row = parseContentPayload(payload);

    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return jsonError(404, "content_not_found", "Conteúdo não encontrado.");
    if (!canEditContent(workspace.role)) return jsonError(403, "forbidden", "Seu papel não permite editar conteúdo.");

    const data = await updateContent(supabase, workspace.organizationId, payload.id, row);
    if (!data) return jsonError(404, "content_not_found", "Conteúdo não encontrado.");
    return NextResponse.json({ id: data.id, item: data });
  } catch (error) {
    return toErrorResponse("api.content.patch", error, "Não foi possível atualizar o conteúdo.");
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonError(401, "not_authenticated", "Não autenticado.");

    const contentId = new URL(request.url).searchParams.get("id");
    if (!isUuid(contentId)) return jsonError(400, "invalid_input", "Identificador inválido.");

    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return jsonError(404, "content_not_found", "Conteúdo não encontrado.");
    if (!canEditContent(workspace.role)) return jsonError(403, "forbidden", "Seu papel não permite excluir conteúdo.");

    const deletedId = await deleteContent(supabase, workspace.organizationId, contentId);
    if (!deletedId) return jsonError(404, "content_not_found", "Conteúdo não encontrado.");
    return NextResponse.json({ ok: true, id: deletedId });
  } catch (error) {
    return toErrorResponse("api.content.delete", error, "Não foi possível excluir o conteúdo.");
  }
}
