import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError, toErrorResponse, ValidationError } from "@/lib/http/errors";
import { findWorkspace } from "@/lib/tenancy/service";
import { getContentScene, updateContentScene } from "@/lib/content/repository";
import { parseSceneWrite } from "@/lib/content/schema";
import { canEditContent } from "@/lib/content/service";
import { isUuid } from "@/lib/validation/fields";
import { findActiveMedia } from "@/lib/media/repository";
import { assertLocksRespected, canEditBrand } from "@/lib/scene/locks";
import { sceneAssetIds } from "@/lib/scene/geometry";

const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" };

/** Design da peça (documento de cena), com a versão e o hash a que pertence. */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonError(401, "not_authenticated", "Não autenticado.");

    const contentId = new URL(request.url).searchParams.get("id");
    if (!isUuid(contentId)) return jsonError(400, "invalid_input", "Identificador inválido.");

    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return jsonError(404, "content_not_found", "Conteúdo não encontrado.");

    const row = await getContentScene(supabase, workspace.organizationId, contentId);
    if (!row) return jsonError(404, "content_not_found", "Conteúdo não encontrado.");
    return NextResponse.json(row, { headers: PRIVATE_NO_STORE });
  } catch (error) {
    return toErrorResponse("api.content.scene.get", error, "Não foi possível carregar o design.");
  }
}

/**
 * Grava o design da peça. O documento é validado inteiro (src/lib/scene/schema.ts);
 * o banco recalcula hash e versão, e uma peça aprovada volta para rascunho.
 * Só owner/admin editam conteúdo, então as camadas travadas como marca podem mudar aqui.
 */
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonError(401, "not_authenticated", "Não autenticado.");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Corpo da requisição inválido.");
    }
    const input = parseSceneWrite(body);

    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return jsonError(404, "content_not_found", "Conteúdo não encontrado.");
    if (!canEditContent(workspace.role)) return jsonError(403, "forbidden", "Seu papel não permite editar conteúdo.");

    // Travas: a API recebe o documento inteiro, então confere contra o que está gravado.
    const current = await getContentScene(supabase, workspace.organizationId, input.id);
    if (!current) return jsonError(404, "content_not_found", "Conteúdo não encontrado.");
    assertLocksRespected(current.scene, input.scene, { allowBrand: canEditBrand(workspace.role) });

    // Imagens do design: só mídia não arquivada do próprio workspace (licença é conferida na fila).
    const assetIds = sceneAssetIds(input.scene);
    if (assetIds.length > 0) {
      const found = await findActiveMedia(supabase, workspace.organizationId, assetIds);
      if (found.length !== assetIds.length) {
        throw new ValidationError("O design usa mídia que não está na biblioteca deste workspace ou foi arquivada.");
      }
    }

    const result = await updateContentScene(supabase, workspace.organizationId, input.id, input.scene, input.expectedHash);
    if (result === "not_found") return jsonError(404, "content_not_found", "Conteúdo não encontrado.");
    if (result === "stale") {
      return jsonError(409, "stale_version", "A peça mudou desde que você abriu o design. Recarregue antes de salvar.");
    }
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse("api.content.scene.put", error, "Não foi possível salvar o design.");
  }
}
