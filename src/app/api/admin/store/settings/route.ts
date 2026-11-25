import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError, toErrorResponse } from "@/lib/http/errors";
import { findWorkspace } from "@/lib/tenancy/service";
import { getStoreSettings, saveStoreSettings } from "@/lib/store/repository";

async function authContext() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { response: jsonError(401, "not_authenticated", "Não autenticado.") } as const;
  const workspace = await findWorkspace(supabase, user.id);
  if (!workspace) return { response: jsonError(409, "no_workspace", "Workspace ainda não criado.") } as const;
  const isAdmin = workspace.role === "owner" || workspace.role === "admin";
  if (!isAdmin) return { response: jsonError(403, "forbidden", "Acesso restrito a administradores.") } as const;

  return { supabase, workspace } as const;
}

export async function GET() {
  try {
    const ctx = await authContext();
    if ("response" in ctx) return ctx.response;

    const settings = await getStoreSettings(ctx.workspace.organizationId);
    return NextResponse.json({ settings });
  } catch (err) {
    return toErrorResponse("api.admin.store.settings.get", err, "Falha ao carregar configurações da loja.");
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await authContext();
    if ("response" in ctx) return ctx.response;

    const body = await request.json();
    const updated = await saveStoreSettings(ctx.workspace.organizationId, body);

    return NextResponse.json({ settings: updated });
  } catch (err) {
    return toErrorResponse("api.admin.store.settings.put", err, "Falha ao salvar configurações da loja.");
  }
}
