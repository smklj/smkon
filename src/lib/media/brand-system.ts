/**
 * SMKON Brand Design System & Tokens
 * Guia oficial de identidade visual, paleta de cores, tipografia e mascote SMK.
 */

export const SMKON_BRAND_TOKENS = {
  colors: {
    bgDark: "#080D12",
    surface: "#11161F",
    card: "#1F2733",
    secondaryDark: "#2A2F3A",
    primaryBlue: "#2563FF",
    electricBlue: "#287BFF",
    accentCyan: "#00F0FF",
    secondaryPurple: "#7C3AED",
    successGreen: "#22C55E",
    alertRed: "#EF4444",
    offerOrange: "#F59E0B",
    textWhite: "#FFFFFF",
    textLight: "#F5F7FA",
    textMuted: "#A1A1AA",
  },
  typography: {
    titleFont: "Sora, -apple-system, BlinkMacSystemFont, sans-serif",
    bodyFont: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
  },
  slogan: "Achados inteligentes. Escolhas melhores.",
  brandName: "SMKON",
} as const;

export type MascotExpression =
  | "padrao"      // Neutro / Confiante
  | "feliz"       // Sorrindo / Olhos curvados
  | "pensativo"   // Mão no queixo / Dúvida "Vale a pena?"
  | "surpreso"    // Olhos arregalados / Espanto
  | "confirmado"  // Joinha 👍 / Selo de verificado
  | "oferta";     // Segurando sacola Shopee / Badge de desconto %

export type BannerTemplateArchetype =
  | "top-list"         // TOP 5 ACHADOS DA SHOPEE
  | "review-verdict"   // VALE A PENA? / REVIEW SINCERO
  | "cost-benefit"     // SETUP CUSTO-BENEFÍCIO 2026
  | "offer-blast"      // ACHADO DO DIA / PREÇO BAIXO
  | "smart-recommend"; // 3 ITENS PARA SEU SETUP

export type BannerAspectRatio = "16:9" | "1:1" | "9:16";

export const MASCOT_EXPRESSIONS: Record<
  MascotExpression,
  { label: string; description: string; eyeShape: "round" | "happy" | "thinking" | "surprised"; accessory: string }
> = {
  padrao: {
    label: "Padrão",
    description: "Postura neutra e confiante",
    eyeShape: "round",
    accessory: "fone-glow",
  },
  feliz: {
    label: "Feliz / Animado",
    description: "Olhos curvados em arco, empolgação",
    eyeShape: "happy",
    accessory: "fone-glow",
  },
  pensativo: {
    label: "Pensativo / Dúvida",
    description: "Mão no queixo avaliando o produto",
    eyeShape: "thinking",
    accessory: "balao-duvida",
  },
  surpreso: {
    label: "Surpreso / Chocado",
    description: "Olhos brilhantes diante de um achado absurdo",
    eyeShape: "surprised",
    accessory: "raios-luz",
  },
  confirmado: {
    label: "Aprovado / Joinha",
    description: "Selo de verificado ou polegar levantado",
    eyeShape: "happy",
    accessory: "selo-verificado",
  },
  oferta: {
    label: "Oferta / Desconto",
    description: "Segurando porcentagem ou achadinho Shopee",
    eyeShape: "happy",
    accessory: "badge-desconto",
  },
};

export const BANNER_ARCHETYPES: Record<
  BannerTemplateArchetype,
  {
    name: string;
    defaultHeadline: string;
    badgeText: string;
    recommendedMascot: MascotExpression;
    accentColor: string;
    secondaryColor: string;
  }
> = {
  "top-list": {
    name: "Top Lista / Achadinhos",
    defaultHeadline: "TOP 5 ACHADOS DA SHOPEE",
    badgeText: "🔥 ACHADINHOS VIRAIS",
    recommendedMascot: "oferta",
    accentColor: "#F59E0B",
    secondaryColor: "#2563FF",
  },
  "review-verdict": {
    name: "Review & Veredito",
    defaultHeadline: "VALE A PENA?",
    badgeText: "⚡ REVIEW COMPLETO",
    recommendedMascot: "pensativo",
    accentColor: "#2563FF",
    secondaryColor: "#7C3AED",
  },
  "cost-benefit": {
    name: "Setup Custo-Benefício",
    defaultHeadline: "SETUP CUSTO-BENEFÍCIO 2026",
    badgeText: "💻 RECOMENDAÇÃO OFICIAL",
    recommendedMascot: "confirmado",
    accentColor: "#00F0FF",
    secondaryColor: "#2563FF",
  },
  "offer-blast": {
    name: "Oferta Relâmpago",
    defaultHeadline: "ACHADO DE HOJE",
    badgeText: "🏷️ PREÇO HISTÓRICO",
    recommendedMascot: "surpreso",
    accentColor: "#EF4444",
    secondaryColor: "#F59E0B",
  },
  "smart-recommend": {
    name: "3 Itens para seu Setup",
    defaultHeadline: "3 ITENS INDISPENSÁVEIS",
    badgeText: "⭐ MELHOR ESCOLHA",
    recommendedMascot: "padrao",
    accentColor: "#22C55E",
    secondaryColor: "#2563FF",
  },
};
