/**
 * Modelos de Banners Promocionais & Stickers Interativos (Engenharia Reversa Canva)
 * Gera overlays de conversão, enquetes simuladas para Stories e carrosséis 1:1 e 9:16.
 */

export type BannerFormat = "feed-square" | "story-vertical";

export type ConversionBadgeType = "free-shipping" | "discount-tag" | "best-seller" | "limited-stock" | "verified-stars";

export type InteractiveStorySticker =
  | { type: "poll"; question: string; optionA: string; optionB: string }
  | { type: "question"; prompt: string; buttonText: string }
  | { type: "rating-slider"; emoji: string; text: string };

export type PromotionalBannerConfig = {
  id: string;
  format: BannerFormat;
  headline: string;
  subheadline: string;
  badge: ConversionBadgeType;
  badgeCustomText?: string;
  originalPrice?: string;
  salePrice: string;
  installments?: string;
  interactiveSticker?: InteractiveStorySticker;
  productImageUrl?: string;
  brandTag: string;
};

export const CONVERSION_BADGE_PRESETS: Record<ConversionBadgeType, { label: string; bg: string; text: string }> = {
  "free-shipping": {
    label: "🚚 FRETE GRÁTIS HOJE",
    bg: "#10B981",
    text: "#000000",
  },
  "discount-tag": {
    label: "🏷️ ATÉ 70% OFF",
    bg: "#EF4444",
    text: "#FFFFFF",
  },
  "best-seller": {
    label: "🔥 Nº 1 MAIS VENDIDO",
    bg: "#F59E0B",
    text: "#000000",
  },
  "limited-stock": {
    label: "⚡ RESTAM POUCAS UNIDADES",
    bg: "#DC2626",
    text: "#FFFFFF",
  },
  "verified-stars": {
    label: "⭐ NOTA 4.9/5.0 (2.4k avaliações)",
    bg: "#3B82F6",
    text: "#FFFFFF",
  },
};

export function createDefaultBannerConfig(
  headline: string,
  salePrice: string,
  format: BannerFormat = "feed-square"
): PromotionalBannerConfig {
  return {
    id: `banner_${Date.now()}`,
    format,
    headline: headline || "Achadinho Exclusivo",
    subheadline: "[Destaque verificado do produto]",
    badge: "best-seller",
    badgeCustomText: "🔥 ACHADINHO VIRAL",
    salePrice: salePrice || "R$ 49,90",
    originalPrice: "R$ 97,00",
    installments: "em até 3x sem juros",
    brandTag: "SMKON · OFICIAL",
    interactiveSticker:
      format === "story-vertical"
        ? {
            type: "poll",
            question: "Qual você compraria primeiro?",
            optionA: "Cor Preta Elegante",
            optionB: "Cor Branca Clean",
          }
        : undefined,
  };
}
