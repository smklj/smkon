/**
 * Serviço de Afiliados Shopee (Frente E · S23)
 * Geração de links rastreados com SubIDs para atribuição de comissão em 7 dias.
 */

import type { ShopeeAffiliateLinkOptions } from "./types.ts";

const SHOPEE_AFFILIATE_BASE_URL = "https://s.shopee.com.br";

export function generateShopeeTrackedLink(options: ShopeeAffiliateLinkOptions): string {
  const { originalProductUrl, appId = "smkon_affiliate", subIds = {} } = options;

  if (!originalProductUrl || typeof originalProductUrl !== "string") {
    throw new Error("URL original do produto Shopee é obrigatória.");
  }

  const cleanUrl = originalProductUrl.trim();
  const trackingParams = new URLSearchParams();

  // Atribuição de Afiliado Shopee
  trackingParams.set("utm_source", "an_smkon");
  trackingParams.set("utm_medium", "affiliates");
  trackingParams.set("smkon_app_id", appId);

  if (subIds.subId1) trackingParams.set("sub_id", sanitizeSubId(subIds.subId1));
  if (subIds.subId2) trackingParams.set("sub_id2", sanitizeSubId(subIds.subId2));
  if (subIds.subId3) trackingParams.set("sub_id3", sanitizeSubId(subIds.subId3));
  if (subIds.subId4) trackingParams.set("sub_id4", sanitizeSubId(subIds.subId4));
  if (subIds.subId5) trackingParams.set("sub_id5", sanitizeSubId(subIds.subId5));

  // Gera o link encurtado / deep link rastreado
  const encodedDestination = encodeURIComponent(cleanUrl);
  return `${SHOPEE_AFFILIATE_BASE_URL}/universal-link?origin=${encodedDestination}&${trackingParams.toString()}`;
}

export function calculateShopeeCommission(
  priceBrl: number,
  commissionRatePercent: number = 10
): {
  grossPrice: number;
  commissionRate: number;
  estimatedEarningsBrl: number;
} {
  const price = Math.max(0, priceBrl);
  const rate = Math.max(0, Math.min(100, commissionRatePercent));
  const estimated = Math.round((price * (rate / 100)) * 100) / 100;

  return {
    grossPrice: price,
    commissionRate: rate,
    estimatedEarningsBrl: estimated,
  };
}

function sanitizeSubId(subId: string): string {
  return subId.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 50);
}
