import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { jsonError, toErrorResponse } from "@/lib/http/errors";
import { findWorkspace } from "@/lib/tenancy/service";

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

    const serviceClient = createServiceClient() || ctx.supabase;
    const { data, error } = await serviceClient
      .from("products")
      .select("*")
      .eq("organization_id", ctx.workspace.organizationId)
      .neq("status", "archived")
      .order("updated_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ products: data ?? [] });
  } catch (err) {
    return toErrorResponse("api.admin.store.products.get", err, "Falha ao carregar produtos da loja.");
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await authContext();
    if ("response" in ctx) return ctx.response;

    const body = await request.json();
    const {
      name,
      price_cents,
      compare_at_price_cents,
      category,
      subcategory,
      fulfillment_mode,
      sku,
      stock_quantity,
      track_inventory,
      is_published_in_store,
      is_featured,
      is_bestseller,
      image_urls,
      affiliate_url,
      description,
      short_description,
      digital_delivery_type,
      digital_benefits,
      digital_instructions,
      weight_grams,
      height_cm,
      width_cm,
      length_cm,
    } = body;

    if (!name || typeof price_cents !== "number") {
      return jsonError(400, "invalid_input", "Nome e preço em centavos são obrigatórios.");
    }

    const cleanSlug = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) + `-${Math.floor(100 + Math.random() * 900)}`;

    const serviceClient = createServiceClient() || ctx.supabase;

    const newProduct = {
      organization_id: ctx.workspace.organizationId,
      name: String(name).trim(),
      slug: cleanSlug,
      sku: sku ? String(sku).trim() : null,
      source: fulfillment_mode === "external_affiliate" ? "shopee" : "smkon_store",
      type: fulfillment_mode === "internal_digital" ? "digital" : "physical",
      revenue_domain: "ecommerce",
      price_cents,
      compare_at_price_cents: compare_at_price_cents || null,
      currency: "BRL",
      category: category || "Geral",
      subcategory: subcategory || null,
      description: description || null,
      short_description: short_description || null,
      fulfillment_mode: fulfillment_mode || "internal_physical",
      is_published_in_store: Boolean(is_published_in_store ?? true),
      is_featured: Boolean(is_featured),
      is_bestseller: Boolean(is_bestseller),
      stock_quantity: Number(stock_quantity ?? 0),
      track_inventory: Boolean(track_inventory ?? true),
      image_urls: Array.isArray(image_urls) ? image_urls : [],
      affiliate_url: affiliate_url || null,
      digital_delivery_type: digital_delivery_type || null,
      digital_benefits: Array.isArray(digital_benefits) ? digital_benefits : [],
      digital_instructions: digital_instructions || null,
      weight_grams: weight_grams ? Number(weight_grams) : null,
      height_cm: height_cm ? Number(height_cm) : null,
      width_cm: width_cm ? Number(width_cm) : null,
      length_cm: length_cm ? Number(length_cm) : null,
      status: "active",
      score: 9.0, // Score base de aprovação do painel
      score_reasons: ["Verificado pela curadoria oficial SMKON"],
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await serviceClient
      .from("products")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(newProduct as any)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ product: data });
  } catch (err) {
    return toErrorResponse("api.admin.store.products.post", err, "Falha ao cadastrar produto na loja.");
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await authContext();
    if ("response" in ctx) return ctx.response;

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) return jsonError(400, "missing_id", "ID do produto é obrigatório.");

    const serviceClient = createServiceClient() || ctx.supabase;

    const { data, error } = await serviceClient
      .from("products")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .eq("id", id)
      .eq("organization_id", ctx.workspace.organizationId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ product: data });
  } catch (err) {
    return toErrorResponse("api.admin.store.products.patch", err, "Falha ao atualizar produto.");
  }
}
