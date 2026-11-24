import { NextResponse } from "next/server";
import { jsonError, toErrorResponse, ValidationError } from "@/lib/http/errors";
import { signMediaUrls } from "@/lib/media/repository";
import { createClient } from "@/lib/supabase/server";
import { findWorkspace } from "@/lib/tenancy/service";
import { isPlainObject, isUuid } from "@/lib/validation/fields";

const MAX_IDS = 50;

/**
 * URLs assinadas (10 min) das mídias usadas num design, para o editor de camadas
 * desenhar e exportar as imagens. Só devolve mídia não arquivada do próprio workspace.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return jsonError(401, "not_authenticated", "Não autenticado.");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Corpo da requisição inválido.");
    }
    const ids = isPlainObject(body) ? (body as { ids?: unknown }).ids : undefined;
    if (!Array.isArray(ids) || ids.length > MAX_IDS || !ids.every(isUuid)) {
      throw new ValidationError(`Informe até ${MAX_IDS} ids de mídia.`);
    }

    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return NextResponse.json({ urls: {} });
    const urls = await signMediaUrls(supabase, workspace.organizationId, [...new Set(ids as string[])]);
    return NextResponse.json({ urls }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return toErrorResponse("api.media.signed-urls", error, "Não foi possível carregar as imagens.");
  }
}
