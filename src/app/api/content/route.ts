import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ContentPayload = {
  id?: string;
  title?: string;
  product?: string;
  sourceUrl?: string;
  assetUrl?: string;
  script?: string;
  caption?: string;
  cta?: string;
  hashtags?: string;
  channels?: string[];
  rightsConfirmed?: boolean;
  status?: "draft" | "approved" | "archived";
};

const allowedChannels = new Set(["YouTube", "Instagram", "TikTok"]);

async function getWorkspace(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (membership?.organization_id) return membership;

  const slug = `smkon-${userId.replace(/-/g, "").slice(0, 12)}`;
  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .insert({ name: "SMKON Workspace", slug, created_by: userId })
    .select("id")
    .single();

  if (organizationError) throw organizationError;

  const { data: newMembership, error: createMembershipError } = await supabase
    .from("organization_members")
    .insert({ organization_id: organization.id, user_id: userId, role: "owner" })
    .select("organization_id, role")
    .single();

  if (createMembershipError) throw createMembershipError;
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
  if (sourceUrl && payload.rightsConfirmed !== true) {
    throw new Error("Confirme os direitos de uso do vídeo de referência.");
  }
  const status = payload.status ?? "draft";
  if (!["draft", "approved", "archived"].includes(status)) throw new Error("Status inválido.");

  return {
    title,
    product: String(payload.product ?? "").slice(0, 180),
    source_url: sourceUrl.slice(0, 2048),
    asset_url: String(payload.assetUrl ?? "").slice(0, 2048),
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

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const workspace = await getWorkspace(supabase, user.id);
    const { data, error } = await supabase
      .from("content_items")
      .select("id,title,product,source_url,asset_url,script,caption,cta,hashtags,channels,rights_confirmed,status,created_at,updated_at")
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

    const payload = await request.json() as ContentPayload;
    const row = toRow(payload);
    const workspace = await getWorkspace(supabase, user.id);
    const { data, error } = await supabase
      .from("content_items")
      .insert({ ...row, organization_id: workspace.organization_id, created_by: user.id })
      .select("id")
      .single();

    if (error) throw error;
    return NextResponse.json({ id: data.id }, { status: 201 });
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

    const payload = await request.json() as ContentPayload;
    if (!payload.id || !/^[0-9a-f-]{36}$/i.test(payload.id)) {
      return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
    }
    const row = toRow(payload);
    const workspace = await getWorkspace(supabase, user.id);
    const { error } = await supabase
      .from("content_items")
      .update(row)
      .eq("id", payload.id)
      .eq("organization_id", workspace.organization_id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
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
    if (!contentId || !/^[0-9a-f-]{36}$/i.test(contentId)) {
      return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
    }
    const workspace = await getWorkspace(supabase, user.id);
    const { error } = await supabase
      .from("content_items")
      .delete()
      .eq("id", contentId)
      .eq("organization_id", workspace.organization_id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível excluir o conteúdo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
