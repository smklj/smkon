/**
 * Serviço de Afiliados Shein (Frente E · S23)
 * Geração de deep-links com cupons integrados e cálculo de descontos e comissões.
 */

import type { SheinAffiliateLinkOptions } from "./types.ts";

const SHEIN_AFFILIATE_DOMAIN = "https://shein.top";

export function generateSheinTrackedLink(options: SheinAffiliateLinkOptions): string {
  const { goodsUrl, affiliateId = "smkon_creator", couponCode, campaignTag = "organic_reels", creatorTag } = options;

  if (!goodsUrl || typeof goodsUrl !== "string") {
    throw new Error("URL do produto Shein é obrigatória.");
  }

  const cleanUrl = goodsUrl.trim();
  const urlParams = new URLSearchParams();

  urlParams.set("aff_id", affiliateId);
  urlParams.set("url_from", "affiliate");
  urlParams.set("cid", campaignTag);

  if (creatorTag) {
    urlParams.set("subid", creatorTag.replace(/[^a-zA-Z0-9_-]/g, ""));
  }

  if (couponCode) {
    urlParams.set("coupon", couponCode.trim().toUpperCase());
  }

  const encodedTarget = encodeURIComponent(cleanUrl);
  return `${SHEIN_AFFILIATE_DOMAIN}/m?target=${encodedTarget}&${urlParams.toString()}`;
}

export function calculateSheinPricingAndCommission(
  retailPriceBrl: number,
  couponDiscountPercent: number = 15,
  commissionRatePercent: number = 12
): {
  retailPrice: number;
  finalCustomerPriceBrl: number;
  customerSavingsBrl: number;
  estimatedCommissionBrl: number;
} {
  const price = Math.max(0, retailPriceBrl);
  const discountRate = Math.max(0, Math.min(90, couponDiscountPercent));
  const commRate = Math.max(0, Math.min(50, commissionRatePercent));

  const savings = Math.round((price * (discountRate / 100)) * 100) / 100;
  const finalPrice = Math.round((price - savings) * 100) / 100;
  const commission = Math.round((finalPrice * (commRate / 100)) * 100) / 100;

  return {
    retailPrice: price,
    finalCustomerPriceBrl: finalPrice,
    customerSavingsBrl: savings,
    estimatedCommissionBrl: commission,
  };
}
