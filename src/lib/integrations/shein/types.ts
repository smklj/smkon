/**
 * Tipos e Interfaces do Conector de Afiliados Shein (Frente E · S23)
 */

export type SheinAffiliateLinkOptions = {
  goodsUrl: string;
  affiliateId?: string;
  couponCode?: string;
  campaignTag?: string;
  creatorTag?: string;
};

export type SheinProductItem = {
  goodsId: string;
  goodsName: string;
  retailPriceBrl: number;
  salePriceBrl: number;
  commissionRatePercent: number; // ex: 10% a 15%
  couponCode?: string;
  couponDiscountPercent?: number; // ex: 15% de desconto extra
  category: "moda-feminina" | "beleza" | "casa" | "acessorios";
  imageUrl?: string;
};
