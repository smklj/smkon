/**
 * Modelos de composição de vídeo 9:16 (Reels / TikTok / Shorts)
 * Injeção de marca d'água SMKON, biblioteca de ganchos virais e cards de CTA.
 */

import type { SubtitleSegment, SubtitleStyle } from "./subtitles";

export type WatermarkPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "bottom-center";

export type WatermarkConfig = {
  brandName: string;
  badgeText?: string;
  position: WatermarkPosition;
  opacity: number;
  showCtaOutro: boolean;
  outroCtaText: string;
  outroDurationSeconds: number;
};

export const DEFAULT_WATERMARK_CONFIG: WatermarkConfig = {
  brandName: "SMKON",
  badgeText: "SMKON · OFICIAL",
  position: "top-right",
  opacity: 0.85,
  showCtaOutro: true,
  outroCtaText: "Link e Cupom Exclusivo nos Comentários / Bio ⚡",
  outroDurationSeconds: 3,
};

export type ViralHook = {
  id: string;
  category: "shein" | "shopee" | "curiosidade" | "urgencia" | "infoproduto";
  text: string;
  badge: string;
};

export const VIRAL_HOOKS: ViralHook[] = [
  {
    id: "shein_secret",
    category: "shein",
    text: "O segredo da SHEIN que as blogueiras não contam para você pagar menos de R$ 30...",
    badge: "🔥 HACK SHEIN",
  },
  {
    id: "shopee_finds",
    category: "shopee",
    text: "3 achadinhos da Shopee que parecem de luxo mas custam menos de R$ 25!",
    badge: "📦 ACHADINHO SHOPEE",
  },
  {
    id: "stop_buying",
    category: "curiosidade",
    text: "PARE de gastar dinheiro com isso antes de ver essa solução em ação!",
    badge: "⚠️ ALERTA",
  },
  {
    id: "digital_method",
    category: "infoproduto",
    text: "Como destravar essa habilidade em 7 dias sem sair de casa (guia completo no link)!",
    badge: "🚀 MÉTODO 10X",
  },
  {
    id: "luxury_dupe",
    category: "curiosidade",
    text: "Achei o produto idêntico ao importado de R$ 400 por apenas R$ 49!",
    badge: "✨ DICA DE OURO",
  },
];

export type VideoComposition = {
  id: string;
  title: string;
  sourceVideoUrl?: string;
  aspectRatio: "9:16";
  durationSeconds: number;
  hook: ViralHook;
  script: string;
  subtitles: SubtitleSegment[];
  subtitleStyle: SubtitleStyle;
  watermark: WatermarkConfig;
  affiliateTag?: string;
  promoCode?: string;
};

/**
 * Cria uma composição inicial padrão para a peça de conteúdo.
 */
export function createDefaultComposition(
  title: string,
  script: string,
  productName?: string,
): VideoComposition {
  return {
    id: `comp_${Date.now()}`,
    title: title || "Vídeo Reels SMKON",
    aspectRatio: "9:16",
    durationSeconds: 15,
    hook: VIRAL_HOOKS[0],
    script: script || "Confira este produto incrível que acabou de chegar. O link com desconto exclusivo está disponível agora na bio e nos comentários!",
    subtitles: [],
    subtitleStyle: "hormozi",
    watermark: DEFAULT_WATERMARK_CONFIG,
    affiliateTag: productName ? `smkon-${productName.toLowerCase().replace(/[^\w]/g, "")}` : "smkon-vip",
    promoCode: "SMKON10",
  };
}
