import { log } from "../../observability/log.ts";
import type { MelhorEnvioCalculateParams, ShippingOption } from "./types";

export function getMelhorEnvioToken(override?: string): string | null {
  return override || process.env.MELHOR_ENVIO_TOKEN || null;
}

/**
 * Consulta de cotação de frete via Melhor Envio API v2 ou estimativa padrão de logística.
 */
export async function calculateShipping(
  params: MelhorEnvioCalculateParams,
): Promise<ShippingOption[]> {
  const token = getMelhorEnvioToken(params.accessToken);
  const cleanFrom = params.originPostalCode.replace(/\D/g, "");
  const cleanTo = params.destinationPostalCode.replace(/\D/g, "");

  if (cleanTo.length !== 8) {
    throw new Error("CEP de destino inválido.");
  }

  // Se não houver token configurado, fornece cálculo inteligente baseado em distância de faixas de CEP
  if (!token) {
    log("info", "melhor_envio.fallback_estimate", { from: cleanFrom, to: cleanTo });
    const isSameState = cleanFrom.substring(0, 1) === cleanTo.substring(0, 1);
    const isCapital = cleanTo.endsWith("000") || cleanTo.substring(1, 3) === "00";

    const pacDays = isSameState ? (isCapital ? 3 : 5) : 7;
    const sedexDays = isSameState ? (isCapital ? 1 : 2) : 3;

    const baseWeightKg = params.items.reduce((acc, i) => acc + (i.weight || 0.3) * i.quantity, 0);
    const weightFactor = Math.max(1, Math.ceil(baseWeightKg));

    const pacPriceCents = (isSameState ? 1990 : 2990) + (weightFactor - 1) * 450;
    const sedexPriceCents = (isSameState ? 2890 : 4590) + (weightFactor - 1) * 700;

    return [
      {
        serviceId: "correios-pac",
        serviceName: "PAC Econômico",
        carrierName: "Correios",
        priceCents: pacPriceCents,
        deliveryDays: pacDays,
        currency: "BRL",
        description: "Opção econômica com rastreamento completo.",
      },
      {
        serviceId: "correios-sedex",
        serviceName: "SEDEX Expresso",
        carrierName: "Correios",
        priceCents: sedexPriceCents,
        deliveryDays: sedexDays,
        currency: "BRL",
        description: "Envio prioritário com entrega rápida.",
      },
      {
        serviceId: "jadlog-package",
        serviceName: "Jadlog Package",
        carrierName: "Jadlog",
        priceCents: Math.round(pacPriceCents * 0.95),
        deliveryDays: pacDays + 1,
        currency: "BRL",
        description: "Transportadora privada com seguro incluso.",
      },
    ];
  }

  const baseUrl = params.isSandbox
    ? "https://sandbox.melhorenvio.com.br"
    : "https://melhorenvio.com.br";

  const payload = {
    from: { postal_code: cleanFrom },
    to: { postal_code: cleanTo },
    products: params.items.map((item) => ({
      id: item.id,
      width: Math.max(11, item.width || 15),
      height: Math.max(2, item.height || 5),
      length: Math.max(16, item.length || 20),
      weight: Math.max(0.1, item.weight || 0.3),
      insurance_value: Math.max(1, item.insurance_value || 10),
      quantity: item.quantity,
    })),
  };

  try {
    const res = await fetch(`${baseUrl}/api/v2/me/shipment/calculate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "SMKON Commerce (contato@smkon.com.br)",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      log("error", "melhor_envio.calculate.failed", { status: res.status });
      throw new Error(`Falha ao calcular frete: ${res.statusText}`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const options: ShippingOption[] = [];

    for (const service of data) {
      if (service.error || !service.price) continue;

      const priceFloat = parseFloat(service.custom_price || service.price);
      options.push({
        serviceId: String(service.id),
        serviceName: service.name,
        carrierName: service.company?.name || "Transportadora",
        priceCents: Math.round(priceFloat * 100),
        deliveryDays: service.custom_delivery_time || service.delivery_time || 5,
        currency: "BRL",
        description: service.company?.name ? `Entrega por ${service.company.name}` : undefined,
      });
    }

    return options.sort((a, b) => a.priceCents - b.priceCents);
  } catch (err) {
    log("error", "melhor_envio.calculate.exception", { error: String(err) });
    throw err;
  }
}
