import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  CHANNELS,
  type ContentPayload,
  type ContentStatusApi,
} from "@/lib/content/types";

const allowedChannels = new Set<string>(CHANNELS);
const SELECT_COLUMNS =
  "id,title,product,source_url,asset_url,script,caption,cta,hashtags,channels,rights_confirmed,status,created_at,updated_at";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "23505" || /duplicate key|unique/i.test(error?.message ?? "");
}

function isHttpsUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

async function refetchMembership(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getWorkspace(supabase: SupabaseClient, userId: string) {
  const membership = await refetchMembership(supabase, userId);
  if (membership?.organization_id) return membership;

  const slug = `smkon-${userId.replace(/-/g, "").slice(0, 12)}`;
  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .insert({ name: "SMKON Workspace", slug, created_by: userId })
    .select("id")
    .single();

  if (organizationError) {
    if (isUniqueViolation(organizationError)) {
      const existing = await refetchMembership(supabase, userId);
      if (existing?.organization_id) return existing;
    }
    throw organizationError;
  }

  const { data: newMembership, error: createMembershipError } = await supabase
    .from("organization_members")
    .insert({ organization_id: organization.id, user_id: userId, role: "owner" })
    .select("organization_id, role")
    .single();

  if (createMembershipError) {
    if (isUniqueViolation(createMembershipError)) {
      const existing = await refetchMembership(supabase, userId);
      if (existing?.organization_id) return existing;
    }
    throw createMembershipError;
  }
  return newMembership;
}

function toRow(payload: ContentPayload) {
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const channels = Array.isArray(payload.channels) ? payload.channels : [];
  if (!title || title.length > 180) throw new Error("Informe um título de até 180 caracteres.");
  if (channels.length === 0 || channels.some((channel) => !allowedChannels.has(channel))) {
    throw new Error("Selecione ao menos um canal válido.");
  }

  const sourceUrl = typeof payload.sourceUrl === "string" ? payload.sourceUrl.trim() : "";
  const assetUrl = typeof payload.assetUrl === "string" ? payload.assetUrl.trim() : "";
  if (!isHttpsUrl(sourceUrl)) throw new Error("O vídeo de referência deve usar HTTPS.");
  if (!isHttpsUrl(assetUrl)) throw new Error("O link do produto deve usar HTTPS.");
  if (sourceUrl && payload.rightsConfirmed !== true) {
    throw new Error("Confirme os direitos de uso do vídeo de referência.");
  }

  const status = (payload.status ?? "draft") as ContentStatusApi;
  if (!["draft", "approved", "archived"].includes(status)) throw new Error("Status inválido.");

  return {
    title,
    product: String(payload.product ?? "").slice(0, 180),
    source_url: sourceUrl.slice(0, 2048),
    asset_url: assetUrl.slice(0, 2048),
    script: String(payload.script ?? "").slice(0, 20000),
    caption: String(payload.caption ?? "").slice(0, 10000),
    cta: String(payload.cta ?? "").slice(0, 1000),
    hashtags: String(payload.hashtags ?? "").slice(0, 2000),
    channels,
    rights_confirmed: payload.rightsConfirmed === true,
    status,
    updated_at: new Date().toISOString(),
  };
}

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const workspace = await getWorkspace(supabase, user.id);
    const { data, error } = await supabase
      .from("content_items")
      .select(SELECT_COLUMNS)
      .eq("organization_id", workspace.organization_id)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível carregar os conteúdos.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const payload = (await request.json()) as ContentPayload;
    const row = toRow(payload);
    const workspace = await getWorkspace(supabase, user.id);
    const { data, error } = await supabase
      .from("content_items")
      .insert({ ...row, organization_id: workspace.organization_id, created_by: user.id })
      .select(SELECT_COLUMNS)
      .single();

    if (error) throw error;
    return NextResponse.json({ id: data.id, item: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível salvar o conteúdo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const payload = (await request.json()) as ContentPayload;
    if (!isUuid(payload.id)) {
      return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
    }
    const row = toRow(payload);
    const workspace = await getWorkspace(supabase, user.id);
    const { data, error } = await supabase
      .from("content_items")
      .update(row)
      .eq("id", payload.id)
      .eq("organization_id", workspace.organization_id)
      .select(SELECT_COLUMNS)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 });
    return NextResponse.json({ id: data.id, item: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível atualizar o conteúdo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get("id");
    if (!isUuid(contentId)) {
      return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
    }
    const workspace = await getWorkspace(supabase, user.id);
    const { data, error } = await supabase
      .from("content_items")
      .delete()
      .eq("id", contentId)
      .eq("organization_id", workspace.organization_id)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true, id: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível excluir o conteúdo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
