import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ProductPayload, ProductSource } from "@/lib/products/types";

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

    // Stub: retorna lista vazia até migration aplicada e workspace validado.
    // Implementação completa virá após fundação estável.
    return NextResponse.json({
      items: [],
      note: "Product Intelligence MVP — stub. Migration draft ainda não aplicada.",
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

    // Stub: não persiste ainda. Retorna eco validado.
    return NextResponse.json(
      {
        ok: true,
        received: {
          name: payload.name.trim(),
          source: payload.source,
          type: payload.type ?? "unknown",
          revenueDomain: payload.revenueDomain ?? "affiliate",
        },
        note: "Stub — persistência será ativada após migration aprovada e aplicada.",
      },
      { status: 202 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao criar produto.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
