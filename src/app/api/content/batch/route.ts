import { NextResponse } from "next/server";
import { jsonError, toErrorResponse } from "@/lib/http/errors";
import { insertContent } from "@/lib/content/repository";
import { readContentJson } from "@/lib/content/schema";
import { canEditContent } from "@/lib/content/service";
import { parseOfferBatchInput, planOfferBatch } from "@/lib/content/offer-batch";
import { getLatestVerifiedEvidence, getTemplateProducts } from "@/lib/products/repository";
import { createClient } from "@/lib/supabase/server";
import { findWorkspace } from "@/lib/tenancy/service";

/**
 * Lote de ofertas (F3): cria um rascunho por produto com o design do template
 * "smkon-oferta", montado do catálogo e das evidências verificadas. Produtos sem preço
 * verificado voltam em `skipped` com o motivo. Nada é aprovado nem publicado aqui.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return jsonError(401, "not_authenticated", "Não autenticado.");

    const input = parseOfferBatchInput(await readContentJson(request));
    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return jsonError(409, "no_workspace", "Workspace ainda não criado.");
    if (!canEditContent(workspace.role)) return jsonError(403, "forbidden", "Seu papel não permite criar conteúdo.");

    const [products, verified] = await Promise.all([
      getTemplateProducts(supabase, workspace.organizationId, input.productIds),
      getLatestVerifiedEvidence(supabase, workspace.organizationId, input.productIds),
    ]);
    const plan = planOfferBatch(input, products, verified.evidence, verified.latest);

    const created: { id: string; productId: string; title: string; version: number }[] = [];
    const skipped = [...plan.skipped];
    for (const item of plan.items) {
      try {
        const row = await insertContent(supabase, workspace.organizationId, user.id, { ...item.row, scene: item.scene });
        created.push({ id: row.id, productId: item.productId, title: row.title, version: row.version });
      } catch {
        skipped.push({ productId: item.productId, name: item.name, reason: "Não foi possível salvar o rascunho." });
      }
    }
    return NextResponse.json({ created, skipped }, { status: created.length > 0 ? 201 : 200 });
  } catch (error) {
    return toErrorResponse("api.content.batch", error, "Não foi possível gerar o lote.");
  }
}
