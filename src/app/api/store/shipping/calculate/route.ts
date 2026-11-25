import { NextResponse, type NextRequest } from "next/server";
import { calculateShipping } from "@/lib/integrations/melhor-envio/client";
import { getStoreSettings } from "@/lib/store/repository";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { destinationPostalCode, items } = body;

    if (!destinationPostalCode || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "CEP de destino e itens são obrigatórios.", code: "invalid_input" },
        { status: 400 },
      );
    }

    const cleanDest = String(destinationPostalCode).replace(/\D/g, "");
    if (cleanDest.length !== 8) {
      return NextResponse.json(
        { error: "CEP de destino inválido.", code: "invalid_postal_code" },
        { status: 400 },
      );
    }

    // Apenas produtos físicos exigem frete
    type ShippingItem = { fulfillmentMode?: string; productId?: string; id?: string; dimensions?: { width?: number; height?: number; length?: number }; width?: number; height?: number; length?: number; weightGrams?: number; weight?: number; priceCents?: number; price?: number; quantity?: number };
    const typedItems = items as ShippingItem[];
    const physicalItems = typedItems.filter(
      (item) => !item.fulfillmentMode || item.fulfillmentMode === "internal_physical",
    );

    if (physicalItems.length === 0) {
      return NextResponse.json({
        options: [
          {
            serviceId: "digital-free",
            serviceName: "Entrega Digital Instantânea",
            carrierName: "SMKON Digital",
            priceCents: 0,
            deliveryDays: 0,
            currency: "BRL",
            description: "Envio automático por e-mail e download na página do pedido.",
          },
        ],
      });
    }

    const settings = await getStoreSettings();
    const originPostalCode = settings.shipping_origin_cep || "01001000";

    const quotes = await calculateShipping({
      originPostalCode,
      destinationPostalCode: cleanDest,
      items: physicalItems.map((item) => ({
        id: String(item.productId || item.id),
        width: Number(item.dimensions?.width || item.width || 15),
        height: Number(item.dimensions?.height || item.height || 5),
        length: Number(item.dimensions?.length || item.length || 20),
        weight: Number((item.weightGrams ? item.weightGrams / 1000 : item.weight) || 0.3),
        insurance_value: Number((item.priceCents ? item.priceCents / 100 : item.price) || 10),
        quantity: Number(item.quantity || 1),
      })),
    });

    // Verifica se atinge frete grátis configurado
    const subtotalCents = typedItems.reduce(
      (acc, item) => acc + Number(item.priceCents || 0) * Number(item.quantity || 1),
      0,
    );

    if (settings.free_shipping_min_cents && subtotalCents >= settings.free_shipping_min_cents) {
      quotes.unshift({
        serviceId: "free-shipping-promo",
        serviceName: "Frete Grátis Promocional",
        carrierName: "SMKON",
        priceCents: 0,
        deliveryDays: 5,
        currency: "BRL",
        description: "Benefício de frete grátis aplicado!",
      });
    }

    return NextResponse.json({ options: quotes });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao calcular frete.", code: "shipping_error" },
      { status: 500 },
    );
  }
}
