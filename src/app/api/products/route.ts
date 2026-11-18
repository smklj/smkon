import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError, toErrorResponse } from "@/lib/http/errors";
import { canEditProducts, createProduct, listProducts } from "@/lib/products/server";
import { parseProductInput } from "@/lib/products/validation";
import { findWorkspace } from "@/lib/tenancy/workspace";

async function context() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { response: jsonError(401, "not_authenticated", "Não autenticado.") } as const;
  const workspace = await findWorkspace(supabase, user.id);
  if (!workspace) return { response: jsonError(409, "no_workspace", "Workspace ainda não criado.") } as const;
  return { supabase, workspace } as const;
}

/** Catálogo do workspace. O score vem do banco e só existe com evidência verificada. */
export async function GET(request: Request) {
  try {
    const ctx = await context();
    if ("response" in ctx) return ctx.response;
    const includeArchived = new URL(request.url).searchParams.get("archived") === "1";
    const items = await listProducts(ctx.supabase, ctx.workspace.organizationId, includeArchived);
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse("api.products.get", error, "Não foi possível consultar produtos.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await context();
    if ("response" in ctx) return ctx.response;
    if (!canEditProducts(ctx.workspace.role)) return jsonError(403, "forbidden", "Apenas owner ou admin cadastram produtos.");

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "invalid_input", "Corpo da requisição inválido.");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) return jsonError(400, "invalid_input", "Corpo da requisição inválido.");

    const id = await createProduct(ctx.supabase, ctx.workspace.organizationId, parseProductInput(body));
    return NextResponse.json({ id, score: null, note: "Produto salvo sem score: adicione e verifique evidências." }, { status: 201 });
  } catch (error) {
    return toErrorResponse("api.products.post", error, "Não foi possível salvar o produto.");
  }
}
