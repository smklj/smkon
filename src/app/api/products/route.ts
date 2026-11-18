import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ProductPayload, ProductSource, RevenueDomain } from "@/lib/products/types";
import { calculateProductScore } from "@/lib/products/scoring";
import { generateContentFromProduct } from "@/lib/products/content-stub";

const ALLOWED_REVENUE_DOMAINS = new Set<RevenueDomain>(["owned_sales", "affiliate", "paid_media"]);

const ALLOWED_SOURCES = new Set<ProductSource>([
  "kiwify", "hotmart", "shopify", "amazon", "manual", "other",
]);

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    return NextResponse.json({
      items: [],
      persistence: "disabled",
      note: "Product Intelligence MVP: catálogo ainda não persiste. A migration precisa ser validada e aplicada antes de habilitar armazenamento.",
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar produtos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const payload = (await request.json()) as ProductPayload;
    if (typeof payload.name !== "string" || !payload.name.trim() || payload.name.trim().length > 200) {
      return NextResponse.json({ error: "Nome do produto deve ter entre 1 e 200 caracteres." }, { status: 400 });
    }
    if (payload.revenueDomain !== undefined && !ALLOWED_REVENUE_DOMAINS.has(payload.revenueDomain)) {
      return NextResponse.json({ error: "Domínio de receita inválido." }, { status: 400 });
    }
    if (!ALLOWED_SOURCES.has(payload.source)) {
      return NextResponse.json({ error: "Fonte inválida." }, { status: 400 });
    }
    if (payload.commissionPercent !== undefined &&
      (!Number.isFinite(payload.commissionPercent) || payload.commissionPercent < 0 || payload.commissionPercent > 100)) {
      return NextResponse.json({ error: "Comissão deve estar entre 0 e 100%." }, { status: 400 });
    }
    if (payload.priceCents !== undefined &&
      (!Number.isInteger(payload.priceCents) || payload.priceCents < 0)) {
      return NextResponse.json({ error: "Preço inválido." }, { status: 400 });
    }

    const scoreResult = calculateProductScore(payload);
    const contentPreview = generateContentFromProduct(payload);
    return NextResponse.json({
      ok: true,
      persistence: "disabled",
      product: {
        name: payload.name.trim(),
        source: payload.source,
        type: payload.type ?? "unknown",
        revenueDomain: payload.revenueDomain ?? "affiliate",
        priceCents: payload.priceCents,
        commissionPercent: payload.commissionPercent,
        score: scoreResult.score,
        scoreReasons: scoreResult.reasons,
      },
      contentPreview,
      note: "Preview apenas: nenhum produto foi salvo e nenhum conteúdo foi publicado. Persistência depende da migration aprovada; publicação exige aprovação humana.",
    }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Payload inválido ou erro ao processar produto." }, { status: 400 });
  }
}
