/**
 * SMKON Smart Banner Engine
 * Motor inteligente e padronizado de criação de capas e banners da marca SMKON.
 * Baseado no Brand Guidelines oficial (Paleta, Tipografia Sora/Inter, Mascote SMK 3D, Archetypes e HUDs).
 */

import { renderPageSvg } from "../scene/render.ts";
import { bannerConfigToScene } from "../scene/templates/smkon-banner.ts";
import {
  SMKON_BRAND_TOKENS,
  type BannerAspectRatio,
  type BannerTemplateArchetype,
  type MascotExpression,
  BANNER_ARCHETYPES,
} from "./brand-system.ts";

export interface SmartBannerConfig {
  id: string;
  archetype: BannerTemplateArchetype;
  aspectRatio: BannerAspectRatio;
  mascotExpression: MascotExpression;
  badgeText: string;
  headline: string;
  highlightWord?: string;
  subheadline?: string;
  priceTag?: string;
  categoryTag?: string;
  showHolographicHud: boolean;
  hudContent?: "headphone" | "speaker" | "verified" | "discount" | "tech";
  accentColor: string;
  secondaryColor: string;
  watermark: boolean;
  slogan: string;
}

export interface SmartBannerInput {
  title?: string;
  product?: string;
  category?: string;
  price?: string | number;
  format?: BannerAspectRatio;
}

/**
 * Catálogo de presets oficiais extraídos do Brand Guidelines SMKON
 */
export const OFFICIAL_SMKON_PRESETS: Record<string, SmartBannerConfig> = {
  "top-perifericos": {
    id: "top-perifericos",
    archetype: "top-list",
    aspectRatio: "16:9",
    mascotExpression: "confirmado",
    badgeText: "🔥 ACHADOS DA SHOPEE",
    headline: "TOP 5 PERIFÉRICOS",
    highlightWord: "ATÉ R$300",
    subheadline: "Os melhores do ano testados e aprovados",
    priceTag: "ATÉ R$ 300",
    categoryTag: "Tecnologia & Setup",
    showHolographicHud: true,
    hudContent: "headphone",
    accentColor: "#F59E0B",
    secondaryColor: "#2563FF",
    watermark: true,
    slogan: SMKON_BRAND_TOKENS.slogan,
  },
  "achado-shopee": {
    id: "achado-shopee",
    archetype: "offer-blast",
    aspectRatio: "16:9",
    mascotExpression: "oferta",
    badgeText: "🏷️ ACHADO DA SHOPEE",
    headline: "ACHADO DA SHOPEE",
    highlightWord: "R$ 79,90",
    subheadline: "Melhor custo-benefício de 2026",
    priceTag: "R$ 79,90",
    categoryTag: "Ofertas & Promoções",
    showHolographicHud: true,
    hudContent: "discount",
    accentColor: "#F59E0B",
    secondaryColor: "#EF4444",
    watermark: true,
    slogan: SMKON_BRAND_TOKENS.slogan,
  },
  "review-vale-a-pena": {
    id: "review-vale-a-pena",
    archetype: "review-verdict",
    aspectRatio: "16:9",
    mascotExpression: "pensativo",
    badgeText: "⚡ REVIEW COMPLETO",
    headline: "VALE A PENA?",
    highlightWord: "REVIEW SINCERO",
    subheadline: "Testamos por 30 dias sem filtro",
    priceTag: "VEREDITO FINAL",
    categoryTag: "Reviews & Testes",
    showHolographicHud: true,
    hudContent: "headphone",
    accentColor: "#2563FF",
    secondaryColor: "#7C3AED",
    watermark: true,
    slogan: SMKON_BRAND_TOKENS.slogan,
  },
  "setup-custo-beneficio": {
    id: "setup-custo-beneficio",
    archetype: "cost-benefit",
    aspectRatio: "16:9",
    mascotExpression: "confirmado",
    badgeText: "💻 RECOMENDAÇÃO OFICIAL",
    headline: "SETUP CUSTO-BENEFÍCIO",
    highlightWord: "2026",
    subheadline: "Como montar o seu gastando pouco",
    priceTag: "SETUP COMPLETO",
    categoryTag: "Setup & Games",
    showHolographicHud: true,
    hudContent: "tech",
    accentColor: "#00F0FF",
    secondaryColor: "#2563FF",
    watermark: true,
    slogan: SMKON_BRAND_TOKENS.slogan,
  },
  "shorts-achado-hoje": {
    id: "shorts-achado-hoje",
    archetype: "offer-blast",
    aspectRatio: "9:16",
    mascotExpression: "oferta",
    badgeText: "🔥 ACHADINHO",
    headline: "ACHADO DE HOJE",
    highlightWord: "SHOPEE",
    subheadline: "Corre antes que acabe o estoque",
    priceTag: "CUPOM ATIVO",
    categoryTag: "Achados",
    showHolographicHud: true,
    hudContent: "discount",
    accentColor: "#F59E0B",
    secondaryColor: "#2563FF",
    watermark: true,
    slogan: SMKON_BRAND_TOKENS.slogan,
  },
  "shorts-review-rapido": {
    id: "shorts-review-rapido",
    archetype: "review-verdict",
    aspectRatio: "9:16",
    mascotExpression: "pensativo",
    badgeText: "⚡ REVIEW RÁPIDO",
    headline: "REVIEW RÁPIDO",
    highlightWord: "SINCERO",
    subheadline: "Vale seu dinheiro em 2026?",
    priceTag: "NOTA 9.8",
    categoryTag: "Reviews",
    showHolographicHud: true,
    hudContent: "verified",
    accentColor: "#2563FF",
    secondaryColor: "#7C3AED",
    watermark: true,
    slogan: SMKON_BRAND_TOKENS.slogan,
  },
  "shorts-3-itens": {
    id: "shorts-3-itens",
    archetype: "smart-recommend",
    aspectRatio: "9:16",
    mascotExpression: "confirmado",
    badgeText: "⭐ DICA DE OURO",
    headline: "3 ITENS",
    highlightWord: "PARA SEU SETUP",
    subheadline: "Que você nem sabia que precisava",
    priceTag: "LINKS NA BIO",
    categoryTag: "Setup & Games",
    showHolographicHud: true,
    hudContent: "speaker",
    accentColor: "#00F0FF",
    secondaryColor: "#2563FF",
    watermark: true,
    slogan: SMKON_BRAND_TOKENS.slogan,
  },
};

/**
 * Heurística Inteligente: infere automaticamente a configuração visual padrão do SMKON
 * a partir do título, produto, categoria e preço fornecidos.
 */
export function inferSmartBannerConfig(input: SmartBannerInput): SmartBannerConfig {
  const textCorpus = `${input.title || ""} ${input.product || ""} ${input.category || ""}`.toLowerCase();
  const format = input.format || "16:9";

  let archetype: BannerTemplateArchetype = "smart-recommend";
  let mascot: MascotExpression = "confirmado";
  let hud: SmartBannerConfig["hudContent"] = "verified";

  // 1. Detecção por intenção de conteúdo (com ordem de especificidade)
  if (
    textCorpus.includes("curso") ||
    textCorpus.includes("infoproduto") ||
    textCorpus.includes("ebook") ||
    textCorpus.includes("guia") ||
    textCorpus.includes("manual") ||
    textCorpus.includes("método")
  ) {
    archetype = "smart-recommend";
    mascot = "feliz";
    hud = "verified";
  } else if (
    textCorpus.includes("top") ||
    textCorpus.includes("melhores") ||
    textCorpus.includes("lista") ||
    textCorpus.includes("seleção") ||
    textCorpus.includes("ranking")
  ) {
    archetype = "top-list";
    mascot = "confirmado";
    hud = "speaker";
  } else if (
    textCorpus.includes("review") ||
    textCorpus.includes("vale a pena") ||
    textCorpus.includes("teste") ||
    textCorpus.includes("analise") ||
    textCorpus.includes("análise") ||
    textCorpus.includes("comparativo") ||
    textCorpus.includes("sincero") ||
    textCorpus.includes("veredito")
  ) {
    archetype = "review-verdict";
    mascot = "pensativo";
    hud = "headphone";
  } else if (
    textCorpus.includes("setup") ||
    textCorpus.includes("gamer") ||
    textCorpus.includes("periférico") ||
    textCorpus.includes("periferico") ||
    textCorpus.includes("teclado") ||
    textCorpus.includes("mouse") ||
    textCorpus.includes("monitor") ||
    textCorpus.includes("custo-beneficio") ||
    textCorpus.includes("custo benefício")
  ) {
    archetype = "cost-benefit";
    mascot = "confirmado";
    hud = "tech";
  } else if (
    textCorpus.includes("shopee") ||
    textCorpus.includes("oferta") ||
    textCorpus.includes("desconto") ||
    textCorpus.includes("cupom") ||
    textCorpus.includes("barato") ||
    textCorpus.includes("promo") ||
    textCorpus.includes("achado") ||
    textCorpus.includes("achadinho")
  ) {
    archetype = "offer-blast";
    mascot = "oferta";
    hud = "discount";
  }

  const archetypeInfo = BANNER_ARCHETYPES[archetype];

  // 2. Formatação da headline principal e destaque
  let rawHeadline = input.title || input.product || archetypeInfo.defaultHeadline;
  rawHeadline = rawHeadline.replace(/\[HOOK\]:?/i, "").trim();

  // Dividir título longo para destacar a palavra-chave
  let headline = rawHeadline.toUpperCase();
  let highlightWord: string | undefined = undefined;

  if (headline.length > 28) {
    const words = headline.split(" ");
    headline = words.slice(0, 3).join(" ");
    highlightWord = words.slice(3, 7).join(" ");
  }

  // 3. Formatação de preço
  let priceTag = archetypeInfo.badgeText;
  if (input.price) {
    const rawPrice = String(input.price).trim();
    priceTag = rawPrice.startsWith("R$") ? rawPrice : `R$ ${rawPrice}`;
  }

  return {
    id: `smart-${Date.now()}`,
    archetype,
    aspectRatio: format,
    mascotExpression: mascot,
    badgeText: archetypeInfo.badgeText,
    headline,
    highlightWord,
    subheadline: input.product || "Recomendação oficial da curadoria SMKON",
    priceTag,
    categoryTag: input.category || "Achados Inteligentes",
    showHolographicHud: true,
    hudContent: hud,
    accentColor: archetypeInfo.accentColor,
    secondaryColor: archetypeInfo.secondaryColor,
    watermark: true,
    slogan: SMKON_BRAND_TOKENS.slogan,
  };
}

export { getBannerDimensions } from "../scene/templates/smkon-banner.ts";

/**
 * SVG da capa, renderizado a partir do documento de cena (template "smkon-banner").
 * O layout vive em scene/templates/smkon-banner.ts; os desenhos da marca em scene/elements.ts.
 */
export function generateSmartBannerSvg(config: SmartBannerConfig): string {
  return renderPageSvg(bannerConfigToScene(config));
}
