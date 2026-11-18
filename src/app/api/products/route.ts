import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ProductPayload, ProductSource } from "@/lib/products/types";
import { calculateProductScore } from "@/lib/products/scoring";
import { generateContentFromProduct } from "@/lib/products/content-stub";

const ALLOWED_SOURCES = new Set<ProductSource>([
  "kiwify",
  "hotmart",
  "shopify",
  "amazon",
  "manual",
  "other",
]);

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    return NextResponse.json({
      items: [],
      note: "Product Intelligence MVP — stub. Migration draft ainda não aplicada. Scoring e geração de conteúdo disponíveis via POST.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao listar produtos.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const payload = (await request.json()) as ProductPayload;
    if (!payload.name || typeof payload.name !== "string" || !payload.name.trim()) {
      return NextResponse.json(
        { error: "Nome do produto é obrigatório." },
        { status: 400 },
      );
    }
    if (!ALLOWED_SOURCES.has(payload.source)) {
      return NextResponse.json({ error: "Fonte inválida." }, { status: 400 });
    }

    const scoreResult = calculateProductScore(payload);
    const contentPreview = generateContentFromProduct(payload);

    return NextResponse.json(
      {
        ok: true,
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
        note: "Stub — persistência será ativada após migration aprovada. Conteúdo gerado é preview e exige aprovação humana + disclosure antes de qualquer uso.",
      },
      { status: 202 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao processar produto.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
