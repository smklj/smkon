import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CHANNELS, type ContentPayload, type WritableContentStatus } from "@/lib/content/types";
import { ValidationError, jsonError, toErrorResponse } from "@/lib/http/errors";
import { canEditContent, ensureWorkspace, findWorkspace } from "@/lib/tenancy/workspace";
import { CONTENT_SELECT_COLUMNS, isUuid } from "@/lib/content/server";

const allowedChannels = new Set<string>(CHANNELS);
const WRITABLE_STATUSES = new Set<WritableContentStatus>(["draft", "archived"]);

function isHttpsUrl(value: string): boolean {
  if (!value) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

async function readJson(request: Request): Promise<ContentPayload> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
    return body as ContentPayload;
  } catch {
    throw new ValidationError("Corpo da requisição inválido.");
  }
}

function toRow(payload: ContentPayload) {
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const channels: string[] = Array.isArray(payload.channels) ? payload.channels : [];
  if (!title || title.length > 180) throw new ValidationError("Informe um título de até 180 caracteres.");
  if (channels.length === 0 || channels.some((channel) => !allowedChannels.has(channel))) {
    throw new ValidationError("Selecione ao menos um canal válido.");
  }

  const sourceUrl = typeof payload.sourceUrl === "string" ? payload.sourceUrl.trim() : "";
  const assetUrl = typeof payload.assetUrl === "string" ? payload.assetUrl.trim() : "";
  if (!isHttpsUrl(sourceUrl)) throw new ValidationError("O vídeo de referência deve usar HTTPS.");
  if (!isHttpsUrl(assetUrl)) throw new ValidationError("O link do produto deve usar HTTPS.");
  if (sourceUrl && payload.rightsConfirmed !== true) {
    throw new ValidationError("Confirme os direitos de uso do vídeo de referência.");
  }

  const mediaAssetId = payload.mediaAssetId ? String(payload.mediaAssetId) : null;
  if (mediaAssetId && !isUuid(mediaAssetId)) throw new ValidationError("Mídia inválida.");

  const status = payload.status ?? "draft";
  if (!WRITABLE_STATUSES.has(status)) {
    throw new ValidationError("Status inválido. Para aprovar, use o fluxo de aprovação.");
  }

  // version, content_hash e approved_* são calculados pelo banco.
  return {
    title,
    product: String(payload.product ?? "").slice(0, 180),
    source_url: sourceUrl.slice(0, 2048),
    asset_url: assetUrl.slice(0, 2048),
    script: String(payload.script ?? "").slice(0, 20000),
    caption: String(payload.caption ?? "").slice(0, 10000),
    cta: String(payload.cta ?? "").slice(0, 1000),
    hashtags: String(payload.hashtags ?? "").slice(0, 2000),
    channels: [...new Set(channels)],
    rights_confirmed: payload.rightsConfirmed === true,
    // O banco confere se a mídia é do mesmo workspace e não está arquivada (invalid_media).
    media_asset_id: mediaAssetId,
    status,
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonError(401, "not_authenticated", "Não autenticado.");

    // Leitura sem efeito colateral: sem workspace, não há conteúdo.
    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return NextResponse.json({ items: [], role: null });

    const { data, error } = await supabase
      .from("content_items")
      .select(CONTENT_SELECT_COLUMNS)
      .eq("organization_id", workspace.organizationId)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ items: data ?? [], role: workspace.role });
  } catch (error) {
    return toErrorResponse("api.content.get", error, "Não foi possível carregar os conteúdos.");
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonError(401, "not_authenticated", "Não autenticado.");

    const row = toRow(await readJson(request));
    const workspace = await ensureWorkspace(supabase);
    if (!canEditContent(workspace.role)) return jsonError(403, "forbidden", "Seu papel não permite criar conteúdo.");

    const { data, error } = await supabase
      .from("content_items")
      .insert({ ...row, organization_id: workspace.organizationId, created_by: user.id })
      .select(CONTENT_SELECT_COLUMNS)
      .single();

    if (error) throw error;
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

    const payload = await readJson(request);
    if (!isUuid(payload.id)) return jsonError(400, "invalid_input", "Identificador inválido.");
    const row = toRow(payload);

    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return jsonError(404, "content_not_found", "Conteúdo não encontrado.");
    if (!canEditContent(workspace.role)) return jsonError(403, "forbidden", "Seu papel não permite editar conteúdo.");

    const { data, error } = await supabase
      .from("content_items")
      .update(row)
      .eq("id", payload.id)
      .eq("organization_id", workspace.organizationId)
      .select(CONTENT_SELECT_COLUMNS)
      .maybeSingle();

    if (error) throw error;
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

    const { data, error } = await supabase
      .from("content_items")
      .delete()
      .eq("id", contentId)
      .eq("organization_id", workspace.organizationId)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) return jsonError(404, "content_not_found", "Conteúdo não encontrado.");
    return NextResponse.json({ ok: true, id: data.id });
  } catch (error) {
    return toErrorResponse("api.content.delete", error, "Não foi possível excluir o conteúdo.");
  }
}
