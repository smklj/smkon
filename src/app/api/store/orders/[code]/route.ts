import { NextResponse, type NextRequest } from "next/server";
import { getStoreOrderByCode } from "@/lib/store/repository";

type RouteContext = {
  params: Promise<{ code: string }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { code } = await params;
  const customerEmail = request.nextUrl.searchParams.get("email") || undefined;

  if (!code) {
    return NextResponse.json({ error: "Código do pedido é obrigatório.", code: "missing_code" }, { status: 400 });
  }

  const order = await getStoreOrderByCode(code, customerEmail);
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado.", code: "order_not_found" }, { status: 404 });
  }

  return NextResponse.json({ order });
}
