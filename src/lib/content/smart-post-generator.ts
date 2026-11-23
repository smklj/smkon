/**
 * SMKON Smart Post & Carousel Generator
 * Motor autônomo de criação de posts de Feed, Carrosséis (multi-slide),
 * Batalhas/Enquetes e Caixinhas de Perguntas com legendas e hashtags de alta conversão.
 */

import { renderPageSvg } from "../scene/render.ts";
import { postSlideToScene } from "../scene/templates/smkon-post.ts";
import type { MascotExpression } from "../media/brand-system.ts";

export type PostKind =
  | "carousel-tips"       // Carrossel educativo de 5 slides (Gancho, Problema, Solução, Benefício, CTA)
  | "feed-single"         // Post estático de alta conversão (1:1 ou 4:5)
  | "battle-poll"         // Batalha/Comparativo A vs B para pico de comentários
  | "question-box"        // Pergunta da Comunidade / Caixinha de Dúvidas
  | "offer-alert";        // Post de Oferta Relâmpago com Cupom & Preço

export interface PostSlide {
  slideNumber: number;
  totalSlides: number;
  badge: string;
  headline: string;
  highlightText?: string;
  bodyText: string;
  bulletPoints?: string[];
  mascotExpression: MascotExpression;
  accentColor: string;
  secondaryColor: string;
  callToAction?: string;
  itemImagePlaceholder?: string;
}

export interface SmartPostPackage {
  id: string;
  kind: PostKind;
  title: string;
  topic: string;
  aspectRatio: "1:1" | "4:5";
  slides: PostSlide[];
  caption: string;
  cta: string;
  hashtags: string;
  suggestedChannels: ("Instagram" | "TikTok" | "YouTube")[];
}

/**
 * Catálogo de Presets de Posts Autônomos Oficiais SMKON
 */
export const OFFICIAL_POST_PRESETS: Record<string, SmartPostPackage> = {
  "carrossel-5-achados": {
    id: "carrossel-5-achados",
    kind: "carousel-tips",
    title: "5 Achados da Shopee que Valem Cada Centavo",
    topic: "Achadinhos & Periféricos",
    aspectRatio: "1:1",
    slides: [
      {
        slideNumber: 1,
        totalSlides: 5,
        badge: "🔥 CURADORIA SMKON",
        headline: "5 ACHADOS DA SHOPEE",
        highlightText: "QUE VALEM CADA CENTAVO",
        bodyText: "Testamos centenas de produtos e separamos os que realmente entregam qualidade profissional gastando pouco.",
        mascotExpression: "confirmado",
        accentColor: "#F59E0B",
        secondaryColor: "#2563FF",
        callToAction: "Deslize para o lado ➔",
      },
      {
        slideNumber: 2,
        totalSlides: 5,
        badge: "⚠️ O ERRO COMUM",
        headline: "VOCÊ AINDA PAGA CARO?",
        highlightText: "NÃO CAIA NESSA",
        bodyText: "A maioria das pessoas gasta R$ 200 em lojas tradicionais por produtos genéricos sem garantia e com acabamento ruim.",
        bulletPoints: [
          "Preços superfaturados em shopping",
          "Promessas falsas de durabilidade",
          "Falta de curadoria e testes reais",
        ],
        mascotExpression: "pensativo",
        accentColor: "#EF4444",
        secondaryColor: "#171B22",
      },
      {
        slideNumber: 3,
        totalSlides: 5,
        badge: "🏆 O CAMPEÃO DE VENDAS",
        headline: "MINI TECLADO MECÂNICO",
        highlightText: "R$ 69,90 NA PROMOÇÃO",
        bodyText: "Switches azuis responsivos, cabo USB-C removível e iluminação RGB com 12 modos. Construtivo em alumínio fosco.",
        bulletPoints: [
          "Nota 4.9 com mais de 3.200 avaliações",
          "Frete grátis com cupom de primeira compra",
          "Compatível com PC, Mac e consoles",
        ],
        mascotExpression: "feliz",
        accentColor: "#00F0FF",
        secondaryColor: "#2563FF",
      },
      {
        slideNumber: 4,
        totalSlides: 5,
        badge: "⚡ DICA DE OURO",
        headline: "SUPORTE ARTICULADO",
        highlightText: "LIBERE ESPAÇO NA MESA",
        bodyText: "Aguenta monitores de até 32 polegadas com regulagem de altura e pistão a gás. Organização de cabos integrada.",
        bulletPoints: [
          "Acaba com as dores no pescoço",
          "Instalação rápida por morsa",
          "Preço histórico na Shopee",
        ],
        mascotExpression: "confirmado",
        accentColor: "#22C55E",
        secondaryColor: "#2563FF",
      },
      {
        slideNumber: 5,
        totalSlides: 5,
        badge: "🎁 RESGATE SEU CUPOM",
        headline: "COMO GARANTIR O SEU?",
        highlightText: "COMENTE 'QUERO'",
        bodyText: "[Diga onde está o link e quais condições estão valendo.]",
        bulletPoints: [
          "Link seguro direto do vendedor oficial",
          "Cupons com até 40% OFF ativos hoje",
          "Salve este post para não perder",
        ],
        mascotExpression: "oferta",
        accentColor: "#F59E0B",
        secondaryColor: "#287BFF",
        callToAction: "Comente QUERO ou clique no link da bio!",
      },
    ],
    caption: `Você teria coragem de continuar pagando preço de shopping? 😱

Separamos os 5 achadinhos que todo mundo precisa ter no setup ou no dia a dia gastando menos de R$ 80.

Todos foram testados e aprovados pela curadoria oficial da SMKON!

👉 Deslize para ver todos os detalhes e notas de teste.

💬 Comente "QUERO" que te envio o link direto de cada um com frete grátis no seu direct agora mesmo!`,
    cta: `Comente "QUERO" para receber os links no direct ⚡`,
    hashtags: "#achadinhos #shopee #setup #tecnologia #dicas #compras #carrossel #smkon",
    suggestedChannels: ["Instagram", "TikTok"],
  },

  "batalha-setup": {
    id: "batalha-setup",
    kind: "battle-poll",
    title: "Batalha de Periféricos: Headset Sem Fio vs Earbuds",
    topic: "Setup & Áudio",
    aspectRatio: "1:1",
    slides: [
      {
        slideNumber: 1,
        totalSlides: 1,
        badge: "⚔️ BATALHA SMKON",
        headline: "QUAL VOCÊ ESCOLHE?",
        highlightText: "HEADSET VS EARBUDS",
        bodyText: "De um lado: Imersão total com isolamento acústico e microfone boom. Do outro: Leveza absoluta para usar o dia todo sem cansar.",
        bulletPoints: [
          "Opção A: Headset Gamer Over-Ear (R$ 149)",
          "Opção B: Earbuds Bluetooth ANC (R$ 89)",
        ],
        mascotExpression: "pensativo",
        accentColor: "#2563FF",
        secondaryColor: "#7C3AED",
        callToAction: "Vote nos comentários: A ou B? 👇",
      },
    ],
    caption: `Dúvida cruel que divide a comunidade! 🤔

Se você só pudesse escolher UM para usar no seu dia a dia e nos jogos, qual seria?

🎧 Opção A: Headset Over-Ear (Bateria monstra + imersão total)
⚡ Opção B: Earbuds Sem Fio (Leve, cabe no bolso e vai pra academia)

Deixe seu voto nos comentários e diga o motivo! O link com desconto dos dois campeões está na nossa bio.`,
    cta: "Deixe seu voto nos comentários: A ou B? 👇",
    hashtags: "#batalha #setup #headset #gamer #tecnologia #enquete #smkon",
    suggestedChannels: ["Instagram", "TikTok"],
  },

  "pergunta-comunidade": {
    id: "pergunta-comunidade",
    kind: "question-box",
    title: "Caixinha da Comunidade: Maior Arrependimento de Compra",
    topic: "Comunidade & Engajamento",
    aspectRatio: "1:1",
    slides: [
      {
        slideNumber: 1,
        totalSlides: 1,
        badge: "💬 CAIXINHA SMKON",
        headline: "QUAL SEU MAIOR ARREPENDIMENTO?",
        highlightText: "DE COMPRA EM 2026",
        bodyText: "Aquele produto que você viu no anúncio, comprou na empolgação e hoje só serve de enfeite juntando poeira na estante.",
        mascotExpression: "surpreso",
        accentColor: "#EF4444",
        secondaryColor: "#171B22",
        callToAction: "Desabafa aqui nos comentários 👇",
      },
    ],
    caption: `Hora da verdade sem filtro! 😅

Todo mundo já comprou alguma coisa achando que ia mudar de vida e no final foi só decepção.

Qual foi o seu maior arrependimento de compra tecnológica ou achadinho?

Os melhores comentários vão virar review sincerão da SMKON para ninguém mais cair na mesma cilada!`,
    cta: "Desabafa aqui embaixo nos comentários 👇",
    hashtags: "#comunidade #arrependimento #achados #sincerao #review #smkon",
    suggestedChannels: ["Instagram", "TikTok"],
  },
};

/**
 * Gera automaticamente um pacote completo de post (slides + legenda persuasiva + hashtags)
 * a partir do tipo de post, nome do produto/tópico e opções.
 */
export function generateAutonomousPost(
  kind: PostKind,
  topicOrProduct: string,
  options?: {
    customPrice?: string;
    promoCode?: string;
    affiliateUrl?: string;
  }
): SmartPostPackage {
  const code = options?.promoCode || "SMKON10";
  const price = options?.customPrice || "R$ 49,90";

  if (kind === "carousel-tips") {
    return {
      id: `post-${Date.now()}`,
      kind: "carousel-tips",
      title: `Carrossel Completo: ${topicOrProduct}`,
      topic: topicOrProduct,
      aspectRatio: "1:1",
      slides: [
        {
          slideNumber: 1,
          totalSlides: 5,
          badge: "🔥 CURADORIA SMKON",
          headline: topicOrProduct.toUpperCase(),
          highlightText: "TUDO QUE VOCÊ PRECISA SABER",
          bodyText: `Guia completo e sem enrolação sobre ${topicOrProduct}. Descubra os segredos e as melhores recomendações testadas.`,
          mascotExpression: "confirmado",
          accentColor: "#2563FF",
          secondaryColor: "#00F0FF",
          callToAction: "Deslize para ver ➔",
        },
        {
          slideNumber: 2,
          totalSlides: 5,
          badge: "❌ O PROBLEMA",
          headline: "POR QUE A MAIORIA ERRA?",
          highlightText: "CUIDADO COM ISSO",
          bodyText: "Comprar sem olhar especificações técnicas ou cair em promoções falsas faz você gastar o dobro.",
          bulletPoints: [
            "Materiais de baixa durabilidade",
            "Falta de suporte do fabricante",
            "Pagar caro por marca sem qualidade real",
          ],
          mascotExpression: "pensativo",
          accentColor: "#EF4444",
          secondaryColor: "#171B22",
        },
        {
          slideNumber: 3,
          totalSlides: 5,
          badge: "⭐ A SOLUÇÃO INTELIGENTE",
          headline: "NOSSA RECOMENDAÇÃO",
          highlightText: `${price} COM CUPOM`,
          bodyText: `Selecionamos o modelo que entrega máxima performance sem pesar no bolso. Testado por mais de 30 dias.`,
          bulletPoints: [
            "Excelente custo-benefício em 2026",
            "[Avaliação e número de vendas conferidos na loja]",
            "Garantia e envio rápido com rastreio",
          ],
          mascotExpression: "feliz",
          accentColor: "#00F0FF",
          secondaryColor: "#2563FF",
        },
        {
          slideNumber: 4,
          totalSlides: 5,
          badge: "💡 3 MOTIVOS PARA ESCOLHER",
          headline: "VALE A PENA?",
          highlightText: "TESTADO E APROVADO",
          bodyText: "Critérios essenciais verificados pela curadoria oficial:",
          bulletPoints: [
            "Economia comprovada de até 40%",
            "Design moderno e alta durabilidade",
            "Suporte nativo e fácil utilização",
          ],
          mascotExpression: "confirmado",
          accentColor: "#22C55E",
          secondaryColor: "#2563FF",
        },
        {
          slideNumber: 5,
          totalSlides: 5,
          badge: "🎁 OFERTA EXCLUSIVA",
          headline: "GARANTA O SEU",
          highlightText: `CUPOM: ${code}`,
          bodyText: `[Condições vigentes de frete e cupom, conferidas na loja.]`,
          bulletPoints: [
            "Comente QUERO para receber no direct",
            "Ou clique no link da nossa bio",
            "Salve este post para consultar depois",
          ],
          mascotExpression: "oferta",
          accentColor: "#F59E0B",
          secondaryColor: "#2563FF",
          callToAction: "Comente 'QUERO' que te envio o link!",
        },
      ],
      caption: `Você já conhecia todos esses detalhes sobre ${topicOrProduct}? 🚀\n\nMontamos este carrossel completo para você economizar tempo e dinheiro com quem realmente entende do assunto.\n\n👉 Deslize para ver todos os slides.\n\n💬 Comente "QUERO" para receber o link com desconto e frete grátis no seu direct!`,
      cta: `Comente "QUERO" para receber o link exclusivo ⚡`,
      hashtags: "#carrossel #dicas #tecnologia #achadinhos #review #economia #smkon",
      suggestedChannels: ["Instagram", "TikTok"],
    };
  }

  if (kind === "battle-poll") {
    return {
      id: `post-${Date.now()}`,
      kind: "battle-poll",
      title: `Batalha: ${topicOrProduct}`,
      topic: topicOrProduct,
      aspectRatio: "1:1",
      slides: [
        {
          slideNumber: 1,
          totalSlides: 1,
          badge: "⚔️ BATALHA SMKON",
          headline: "QUAL O SEU FAVORITO?",
          highlightText: topicOrProduct.toUpperCase(),
          bodyText: "Colocamos as duas opções frente a frente. Qual delas você levaria para casa hoje?",
          bulletPoints: [
            "Opção 1: Máximo custo-benefício e praticidade",
            "Opção 2: Recursos premium e alta durabilidade",
          ],
          mascotExpression: "pensativo",
          accentColor: "#2563FF",
          secondaryColor: "#7C3AED",
          callToAction: "Vote nos comentários: 1 ou 2? 👇",
        },
      ],
      caption: `Chegou a hora de decidir! ⚔️\n\nEntre essas duas opções de ${topicOrProduct}, qual tem mais a sua cara?\n\nDeixe seu voto nos comentários e marque aquele amigo que precisa ver isso!\n\nOs links oficiais de ambas com desconto estão na nossa bio.`,
      cta: "Vote nos comentários: 1 ou 2? 👇",
      hashtags: "#batalha #enquete #comparativo #tecnologia #achados #smkon",
      suggestedChannels: ["Instagram", "TikTok"],
    };
  }

  if (kind === "question-box") {
    return {
      id: `post-${Date.now()}`,
      kind: "question-box",
      title: `Pergunta: ${topicOrProduct}`,
      topic: topicOrProduct,
      aspectRatio: "1:1",
      slides: [
        {
          slideNumber: 1,
          totalSlides: 1,
          badge: "💬 CAIXINHA SMKON",
          headline: "QUEREMOS SABER!",
          highlightText: topicOrProduct.toUpperCase(),
          bodyText: "A comunidade quer ouvir a sua experiência real e sem filtros.",
          mascotExpression: "pensativo",
          accentColor: "#00F0FF",
          secondaryColor: "#2563FF",
          callToAction: "Responda aqui embaixo 👇",
        },
      ],
      caption: `Conta pra gente aqui embaixo! 👇\n\nQueremos saber sua opinião sincera sobre: ${topicOrProduct}.\n\nOs comentários mais votados serão selecionados pela curadoria da SMKON!`,
      cta: "Responda nos comentários 👇",
      hashtags: "#comunidade #pergunta #opiniao #achadinhos #smkon",
      suggestedChannels: ["Instagram", "TikTok"],
    };
  }

  // feed-single ou offer-alert
  return {
    id: `post-${Date.now()}`,
    kind: "feed-single",
    title: `Post de Feed: ${topicOrProduct}`,
    topic: topicOrProduct,
    aspectRatio: "1:1",
    slides: [
      {
        slideNumber: 1,
        totalSlides: 1,
        badge: "🏷️ ACHADO DO DIA",
        headline: topicOrProduct.toUpperCase(),
        highlightText: `${price} HOJE`,
        bodyText: "Encontramos o melhor valor histórico com estoque limitado. Qualidade garantida e testada pela SMKON.",
        bulletPoints: [
          `Cupom exclusivo: ${code}`,
          "Frete grátis para todo o Brasil",
          "Nota de aprovação 4.9/5",
        ],
        mascotExpression: "oferta",
        accentColor: "#F59E0B",
        secondaryColor: "#EF4444",
        callToAction: "Link na bio ou comente 'EU QUERO'",
      },
    ],
    caption: `Achadinho imperdível que acabou de entrar em promoção! 🏷️\n\n${topicOrProduct} por apenas ${price} usando o cupom ${code}!\n\nCorre porque o estoque promocional costuma esgotar rápido.\n\n💬 Comente "EU QUERO" que te mando o link direto no direct, ou acesse pelo link da bio!`,
    cta: `Comente "EU QUERO" para receber o link 🛍️`,
    hashtags: "#achadinho #promocao #desconto #shopee #oferta #smkon",
    suggestedChannels: ["Instagram", "TikTok"],
  };
}

/**
 * SVG de um slide, renderizado a partir do documento de cena (template "smkon-post").
 * O layout vive em scene/templates/smkon-post.ts; os desenhos da marca em scene/elements.ts.
 */
export function generatePostSlideSvg(slide: PostSlide, aspectRatio: "1:1" | "4:5" = "1:1"): string {
  return renderPageSvg(postSlideToScene(slide, aspectRatio));
}
