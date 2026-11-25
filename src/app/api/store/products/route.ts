import { NextResponse, type NextRequest } from "next/server";
import { listStoreProducts } from "@/lib/store/repository";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const category = searchParams.get("categoria") || undefined;
  const search = searchParams.get("q") || undefined;
  const featured = searchParams.get("destaque") === "true";
  const bestseller = searchParams.get("mais_vendidos") === "true";
  const newArrival = searchParams.get("novidades") === "true";
  const tipo = searchParams.get("tipo");
  const sort = (searchParams.get("ordem") as "price_asc" | "price_desc" | "newest" | "score" | null) ?? "newest";
  const limit = Number(searchParams.get("limite") || 24);
  const offset = Number(searchParams.get("offset") || 0);

  const fulfillmentMode =
    tipo === "digital"
      ? "internal_digital"
      : tipo === "afiliado" || tipo === "shopee"
      ? "external_affiliate"
      : tipo === "fisico"
      ? "internal_physical"
      : undefined;

  const result = await listStoreProducts({
    category,
    search,
    featured,
    bestseller,
    newArrival,
    fulfillmentMode,
    sort,
    limit,
    offset,
  });

  return NextResponse.json(result);
}
