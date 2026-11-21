/**
 * Tipos e Interfaces do Conector de Afiliados Shopee (Frente E · S23)
 */

export type ShopeeAffiliateSubIds = {
  subId1?: string; // ex: id do post / conteúdo
  subId2?: string; // ex: canal (instagram_reels, tiktok, youtube_shorts)
  subId3?: string; // ex: campanha (achadinhos_semana_47)
  subId4?: string; // ex: criador / operador
  subId5?: string; // ex: workspace_id
};

export type ShopeeAffiliateLinkOptions = {
  originalProductUrl: string;
  appId?: string;
  subIds?: ShopeeAffiliateSubIds;
};

export type ShopeeProductItem = {
  itemId: string;
  shopId: string;
  name: string;
  priceBrl: number;
  originalPriceBrl?: number;
  commissionRatePercent: number; // ex: 12%
  imageUrl?: string;
  ratingStars?: number;
  soldCount?: number;
};
