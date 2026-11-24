import { NextResponse } from "next/server";
import { jsonError, toErrorResponse, ValidationError } from "@/lib/http/errors";
import { getEvidenceByIds, getLatestVerifiedEvidence, getTemplateProducts } from "@/lib/products/repository";
import { createClient } from "@/lib/supabase/server";
import { findWorkspace } from "@/lib/tenancy/service";
import { isUuid } from "@/lib/validation/fields";

const MAX_IDS = 50;

/**
 * Dados verificados para peças (F3): nome e moeda dos produtos e o preço e a avaliação
 * verificados mais recentes de cada um. ?ids=uuid,uuid (até 50). ?evidence= acrescenta
 * evidências já ligadas a um design (o editor confere e atualiza a partir delas).
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return jsonError(401, "not_authenticated", "Não autenticado.");
    const params = new URL(request.url).searchParams;
    const list = (name: string) => [...new Set((params.get(name) ?? "").split(",").filter(Boolean))];
    const ids = list("ids");
    const evidenceIds = list("evidence");
    if (ids.length === 0 || ids.length > MAX_IDS || !ids.every(isUuid)) {
      throw new ValidationError(`Informe de 1 a ${MAX_IDS} produtos.`);
    }
    if (evidenceIds.length > MAX_IDS || !evidenceIds.every(isUuid)) throw new ValidationError("Evidências inválidas.");
    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return NextResponse.json({ products: {}, evidence: {}, latest: {} });
    const [products, verified, linked] = await Promise.all([
      getTemplateProducts(supabase, workspace.organizationId, ids),
      getLatestVerifiedEvidence(supabase, workspace.organizationId, ids),
      getEvidenceByIds(supabase, workspace.organizationId, evidenceIds),
    ]);
    return NextResponse.json(
      { products, evidence: { ...linked, ...verified.evidence }, latest: verified.latest },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return toErrorResponse("api.products.bindings", error, "Não foi possível carregar os dados dos produtos.");
  }
}
