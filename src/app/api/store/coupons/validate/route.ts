import { NextResponse, type NextRequest } from "next/server";
import { validateCoupon } from "@/lib/store/repository";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, subtotalCents, organizationId } = body;

    if (!code || typeof subtotalCents !== "number") {
      return NextResponse.json(
        { valid: false, reason: "Código e subtotal são obrigatórios." },
        { status: 400 },
      );
    }

    const result = await validateCoupon(
      organizationId || "00000000-0000-0000-0000-000000000000",
      code,
      subtotalCents,
    );

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { valid: false, reason: "Falha ao validar cupom." },
      { status: 500 },
    );
  }
}
