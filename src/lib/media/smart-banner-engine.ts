/**
 * SMKON Smart Banner Engine
 * Motor inteligente e padronizado de criação de capas e banners da marca SMKON.
 * Baseado no Brand Guidelines oficial (Paleta, Tipografia Sora/Inter, Mascote SMK 3D, Archetypes e HUDs).
 */

import { applySvgTypography } from "./svg-typography.ts";
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

/**
 * Dimensões canônicas em pixels por proporção de aspecto
 */
export function getBannerDimensions(ratio: BannerAspectRatio): { width: number; height: number } {
  switch (ratio) {
    case "16:9":
      return { width: 1280, height: 720 };
    case "9:16":
      return { width: 720, height: 1280 };
    case "1:1":
      return { width: 1080, height: 1080 };
  }
}

/**
 * Gera código SVG vetorial completo, pronto para renderização ou download em alta definição
 */
export function generateSmartBannerSvg(config: SmartBannerConfig): string {
  const { width, height } = getBannerDimensions(config.aspectRatio);
  const isVertical = config.aspectRatio === "9:16";
  const isSquare = config.aspectRatio === "1:1";

  // Posicionamento dinâmico conforme aspect ratio
  const mascotX = isVertical ? width * 0.5 : width * 0.78;
  const mascotY = isVertical ? height * 0.65 : height * 0.58;
  const mascotScale = isVertical ? 1.35 : isSquare ? 1.15 : 1.0;

  const contentX = isVertical ? 60 : 70;
  const contentY = isVertical ? 160 : 200;

  // Olhos do mascote conforme expressão
  let eyesSvg = "";
  switch (config.mascotExpression) {
    case "feliz":
    case "confirmado":
      // Olhos curvados felizes ^ ^
      eyesSvg = `
        <path d="M-28 -8 Q-20 -20 -12 -8" stroke="#11161F" stroke-width="7" stroke-linecap="round" fill="none" />
        <path d="M12 -8 Q20 -20 28 -8" stroke="#11161F" stroke-width="7" stroke-linecap="round" fill="none" />
      `;
      break;
    case "pensativo":
      // Olho esquerdo normal, olho direito semicerrado
      eyesSvg = `
        <rect x="-30" y="-14" width="16" height="24" rx="8" fill="#11161F" />
        <line x1="12" y1="-2" x2="28" y2="-2" stroke="#11161F" stroke-width="7" stroke-linecap="round" />
      `;
      break;
    case "surpreso":
      // Olhos bem arregalados ovais
      eyesSvg = `
        <circle cx="-20" cy="-6" r="12" fill="#11161F" />
        <circle cx="-17" cy="-9" r="4" fill="#FFFFFF" />
        <circle cx="20" cy="-6" r="12" fill="#11161F" />
        <circle cx="23" cy="-9" r="4" fill="#FFFFFF" />
      `;
      break;
    case "oferta":
      // Olhos curvados piscando
      eyesSvg = `
        <path d="M-28 -8 Q-20 -20 -12 -8" stroke="#11161F" stroke-width="7" stroke-linecap="round" fill="none" />
        <circle cx="20" cy="-6" r="10" fill="#11161F" />
        <circle cx="23" cy="-9" r="3.5" fill="#FFFFFF" />
      `;
      break;
    default:
      // Padrão: dois ovais pretos clássicos SMK
      eyesSvg = `
        <rect x="-30" y="-15" width="18" height="26" rx="9" fill="#11161F" />
        <rect x="12" y="-15" width="18" height="26" rx="9" fill="#11161F" />
      `;
      break;
  }

  // Acessório / HUD flutuante
  let accessorySvg = "";
  if (config.showHolographicHud) {
    const hudX = isVertical ? 150 : -140;
    const hudY = isVertical ? -80 : -70;

    let iconGraphic = "";
    if (config.hudContent === "headphone") {
      iconGraphic = `
        <path d="M-14 4 A14 14 0 0 1 14 4" stroke="${config.accentColor}" stroke-width="3" fill="none" stroke-linecap="round" />
        <rect x="-18" y="2" width="6" height="12" rx="3" fill="${config.accentColor}" />
        <rect x="12" y="2" width="6" height="12" rx="3" fill="${config.accentColor}" />
      `;
    } else if (config.hudContent === "verified") {
      iconGraphic = `
        <polygon points="0,-14 5,-9 12,-11 10,-4 15,2 9,6 8,13 2,10 -3,14 -6,8 -13,6 -10,0 -14,-6 -7,-8" fill="${config.accentColor}" />
        <path d="M-4 0 L-1 3 L5 -3" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      `;
    } else if (config.hudContent === "discount") {
      iconGraphic = `
        <circle cx="0" cy="0" r="13" fill="${config.accentColor}" />
        <text x="0" y="5" font-family="Sora, sans-serif" font-weight="800" font-size="13" fill="#FFFFFF" text-anchor="middle">%</text>
      `;
    } else {
      // Tech HUD
      iconGraphic = `
        <rect x="-12" y="-10" width="24" height="16" rx="2" stroke="${config.accentColor}" stroke-width="2.5" fill="none" />
        <line x1="-5" y1="9" x2="5" y2="9" stroke="${config.accentColor}" stroke-width="2" />
        <line x1="0" y1="6" x2="0" y2="9" stroke="${config.accentColor}" stroke-width="2" />
      `;
    }

    accessorySvg = `
      <g transform="translate(${hudX}, ${hudY})">
        <!-- Painel Holográfico Translúcido -->
        <rect x="-42" y="-35" width="84" height="70" rx="10" fill="#090B0F" fill-opacity="0.75" stroke="${config.accentColor}" stroke-width="1.8" />
        <!-- Cantoneiras Neon -->
        <path d="M-36 -31 L-40 -31 L-40 -27" stroke="${config.accentColor}" stroke-width="2" fill="none" />
        <path d="M36 -31 L40 -31 L40 -27" stroke="${config.accentColor}" stroke-width="2" fill="none" />
        <path d="M-36 31 L-40 31 L-40 27" stroke="${config.accentColor}" stroke-width="2" fill="none" />
        <path d="M36 31 L40 31 L40 27" stroke="${config.accentColor}" stroke-width="2" fill="none" />
        ${iconGraphic}
      </g>
    `;
  }

  return applySvgTypography(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      <defs>
        <!-- Gradientes Oficiais SMKON -->
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#080D12" />
          <stop offset="50%" stop-color="#0E141C" />
          <stop offset="100%" stop-color="#06090D" />
        </linearGradient>

        <radialGradient id="neonHalo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${config.accentColor}" stop-opacity="0.32" />
          <stop offset="60%" stop-color="${config.secondaryColor}" stop-opacity="0.14" />
          <stop offset="100%" stop-color="#080D12" stop-opacity="0" />
        </radialGradient>

        <linearGradient id="logoSwooshGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#2563FF" />
          <stop offset="60%" stop-color="#00F0FF" />
          <stop offset="100%" stop-color="#FFFFFF" />
        </linearGradient>

        <linearGradient id="hoodGrad" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stop-color="#2C3440" />
          <stop offset="45%" stop-color="#141922" />
          <stop offset="100%" stop-color="#080A0E" />
        </linearGradient>

        <linearGradient id="faceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFFFFF" />
          <stop offset="100%" stop-color="#E2E8F0" />
        </linearGradient>

        <linearGradient id="sashGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFFFFF" />
          <stop offset="100%" stop-color="#CBD5E1" />
        </linearGradient>

        <filter id="glowDrop" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <!-- 1. Fundo Tecnológico Cósmico -->
      <rect width="${width}" height="${height}" fill="url(#bgGrad)" />

      <!-- Grade Tecnológica Sutil -->
      <g stroke="#2563FF" stroke-opacity="0.05" stroke-width="1">
        ${Array.from({ length: 9 })
          .map((_, i) => `<line x1="0" y1="${(height / 8) * i}" x2="${width}" y2="${(height / 8) * i}" />`)
          .join("\n")}
        ${Array.from({ length: 13 })
          .map((_, i) => `<line x1="${(width / 12) * i}" y1="0" x2="${(width / 12) * i}" y2="${height}" />`)
          .join("\n")}
      </g>

      <!-- Halo de Iluminação Traseira do Mascote -->
      <circle cx="${mascotX}" cy="${mascotY}" r="${isVertical ? 420 : 380}" fill="url(#neonHalo)" />

      <!-- 2. Logo Oficial SMKON (Topo) -->
      <g transform="translate(${contentX}, 60)">
        <!-- Letras SMK (Brancas) e ON (Azul Elétrico) -->
        <text class="sora-title" x="0" y="32" font-size="34" fill="#FFFFFF">SMK<tspan fill="#287BFF">ON</tspan></text>
        <!-- Swoosh Curvo Cósmico com Estrela -->
        <path d="M-6 40 C 45 42, 90 20, 118 6" stroke="url(#logoSwooshGrad)" stroke-width="3.5" fill="none" stroke-linecap="round" />
        <!-- Estrela de 8 pontas no topo do swoosh -->
        <g transform="translate(122, 5)">
          <path d="M0 -6 L1.5 -1.5 L6 0 L1.5 1.5 L0 6 L-1.5 1.5 L-6 0 L-1.5 -1.5 Z" fill="#00F0FF" />
          <circle cx="0" cy="0" r="1.5" fill="#FFFFFF" />
        </g>
        <!-- Slogan Oficial -->
        <text class="inter-body" x="0" y="52" font-size="12" font-weight="600" fill="#94A3B8" letter-spacing="0.02em">
          ${SMKON_BRAND_TOKENS.slogan}
        </text>
      </g>

      <!-- 3. Mascote SMK 3D (Renderizado Vetorial) -->
      <g transform="translate(${mascotX}, ${mascotY}) scale(${mascotScale})">
        <!-- Corpo / Capuz Traseiro -->
        <path d="M-75 140 C-75 40 -60 10 0 10 C60 10 75 40 75 140 Z" fill="url(#hoodGrad)" />

        <!-- Faixa Diagonal Branca no Peito (Sash Oficial) -->
        <path d="M-60 140 L-20 65 L8 70 L-30 140 Z" fill="url(#sashGrad)" />
        <!-- LED Azul no Peito -->
        <circle cx="-12" cy="74" r="5" fill="#00F0FF" filter="url(#glowDrop)" />
        <circle cx="-12" cy="74" r="2.5" fill="#FFFFFF" />

        <!-- Cabeça / Capuz Principal -->
        <path d="M-65 -40 C-65 -95 -45 -115 0 -115 C45 -115 65 -95 65 -40 C65 25 45 45 0 45 C-45 45 -65 25 -65 -40 Z" fill="url(#hoodGrad)" />
        <!-- Aba Superior do Capuz (Dobra estilizada) -->
        <path d="M-60 -70 C-30 -110 30 -110 60 -70 C40 -95 -40 -95 -60 -70 Z" fill="#3B4656" />

        <!-- Face Branca Lisa (Display) -->
        <rect x="-46" y="-55" width="92" height="82" rx="36" fill="url(#faceGrad)" />

        <!-- Olhos Expressivos -->
        ${eyesSvg}

        <!-- Headphones com LED Cyan/Blue e Letra S -->
        <!-- Fone Esquerdo -->
        <g transform="translate(-70, -25)">
          <rect x="-14" y="-30" width="22" height="58" rx="11" fill="#141922" stroke="${config.accentColor}" stroke-width="2.5" />
          <circle cx="-3" cy="-1" r="7" fill="#080D12" />
          <text class="sora-title" x="-3" y="2.5" font-size="8" fill="${config.accentColor}" text-anchor="middle">S</text>
        </g>
        <!-- Fone Direito -->
        <g transform="translate(70, -25)">
          <rect x="-8" y="-30" width="22" height="58" rx="11" fill="#141922" stroke="${config.accentColor}" stroke-width="2.5" />
          <circle cx="3" cy="-1" r="7" fill="#080D12" />
          <text class="sora-title" x="3" y="2.5" font-size="8" fill="${config.accentColor}" text-anchor="middle">S</text>
        </g>
        <!-- Arco do Fone -->
        <path d="M-70 -35 C-70 -115 70 -115 70 -35" stroke="#1A202C" stroke-width="8" fill="none" stroke-linecap="round" />

        <!-- Mão / Gesto Joinha (se confirmado) -->
        ${
          config.mascotExpression === "confirmado"
            ? `
          <g transform="translate(-85, 40)">
            <ellipse cx="0" cy="0" rx="16" ry="14" fill="#1E2633" />
            <!-- Dedo polegar para cima -->
            <rect x="-4" y="-22" width="10" height="18" rx="5" fill="#2A3445" />
            <circle cx="1" cy="-20" r="5" fill="#2A3445" />
          </g>
          `
            : ""
        }

        <!-- Acessório / Holograma Flutuante -->
        ${accessorySvg}
      </g>

      <!-- 4. Conteúdo Textual e Destaques (Sora & Inter) -->
      <g transform="translate(${contentX}, ${contentY})">
        <!-- Badge Superior do Archetype -->
        <g>
          <rect x="0" y="0" width="${Math.max(160, config.badgeText.length * 11 + 30)}" height="34" rx="8" fill="${config.accentColor}" />
          <text class="sora-badge" x="14" y="22" font-size="13" font-weight="800" fill="#080D12">
            ${config.badgeText}
          </text>
        </g>

        <!-- Título Principal (Sora ExtraBold 900) -->
        <text class="sora-title" x="0" y="${isVertical ? 85 : 80}" font-size="${isVertical ? 46 : 56}" fill="#FFFFFF">
          ${config.headline}
        </text>

        <!-- Palavra de Destaque / Caixa Colorida -->
        ${
          config.highlightWord
            ? `
          <g transform="translate(0, ${isVertical ? 115 : 105})">
            <rect x="0" y="0" width="${Math.max(180, config.highlightWord.length * 28 + 24)}" height="${isVertical ? 58 : 68}" rx="12" fill="${config.secondaryColor}" />
            <text class="sora-title" x="14" y="${isVertical ? 42 : 50}" font-size="${isVertical ? 38 : 46}" fill="#FFFFFF">
              ${config.highlightWord}
            </text>
          </g>
          `
            : ""
        }

        <!-- Subtítulo Explicativo -->
        <text class="inter-body" x="0" y="${isVertical ? (config.highlightWord ? 215 : 145) : config.highlightWord ? 215 : 135}" font-size="${isVertical ? 18 : 20}" font-weight="600" fill="#94A3B8">
          ${config.subheadline || ""}
        </text>

        <!-- Etiqueta de Preço / Oferta em Destaque -->
        ${
          config.priceTag
            ? `
          <g transform="translate(0, ${isVertical ? (config.highlightWord ? 255 : 185) : config.highlightWord ? 250 : 170})">
            <rect x="0" y="0" width="${Math.max(150, config.priceTag.length * 16 + 32)}" height="46" rx="10" fill="#11161F" stroke="${config.accentColor}" stroke-width="2" />
            <text class="sora-title" x="16" y="30" font-size="20" fill="${config.accentColor}">
              ${config.priceTag}
            </text>
          </g>
          `
            : ""
        }
      </g>

      <!-- 5. Rodapé / Canal & Categoria Oficial -->
      <g transform="translate(${contentX}, ${height - 40})">
        <text class="inter-body" x="0" y="0" font-size="13" font-weight="700" fill="#64748B" letter-spacing="0.05em">
          ${config.categoryTag?.toUpperCase()} · SMKON CURADORIA INTELIGENTE
        </text>
      </g>
    </svg>
  `);
}
