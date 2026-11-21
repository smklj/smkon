/**
 * Motor de Geração Autônoma de Conteúdo (Frente D & E)
 * Unifica ganchos virais, roteiros 9:16, legendas karaokê e links de afiliados para aprovação com 1 clique.
 */

import { VIRAL_HOOKS, type ViralHook } from "../media/video-composition.ts";
import { generateShopeeTrackedLink } from "../integrations/shopee/index.ts";
import { generateSheinTrackedLink } from "../integrations/shein/index.ts";
import { getBlueprintByNiche } from "../infoproducts/index.ts";
import type { ContentChannel } from "./types.ts";

export type ContentPresetType = "shopee-viral" | "shein-fashion" | "digital-infoproduct" | "hotmart-course";

export type AutonomousDraftResult = {
  title: string;
  product: string;
  sourceUrl?: string;
  assetUrl?: string;
  script: string;
  caption: string;
  cta: string;
  hashtags: string;
  channels: ContentChannel[];
  hook: ViralHook;
  promoCode?: string;
};

export function generateAutonomousDraft(
  preset: ContentPresetType,
  productName: string,
  options?: {
    customPromoCode?: string;
    productUrl?: string;
  }
): AutonomousDraftResult {
  const code = options?.customPromoCode || (preset === "shein-fashion" ? "SHEIN15" : "SMKON10");

  switch (preset) {
    case "shopee-viral": {
      const hook = VIRAL_HOOKS.find((h) => h.category === "shopee") || VIRAL_HOOKS[1];
      const targetUrl = options?.productUrl || "https://shopee.com.br/item-exemplo";
      const trackedLink = generateShopeeTrackedLink({
        originalProductUrl: targetUrl,
        subIds: { subId1: "reels_auto", subId2: "instagram" },
      });

      return {
        title: `Achadinho Shopee: ${productName}`,
        product: productName,
        assetUrl: trackedLink,
        hook,
        promoCode: code,
        script: `[HOOK 0-3s]: ${hook.text}\n\n[DEMONSTRAÇÃO 3-10s]\nOlha a qualidade e praticidade desse ${productName}. Ele resolve exatamente aquele problema diário sem custar caro.\n\n[FECHAMENTO 10-15s]\nO link com frete grátis e cupom de desconto exclusivo está salvo nos comentários e no link da bio!`,
        caption: `Você teria coragem de pagar o preço normal depois de ver isso? 😱\n\nGaranta o seu ${productName} com o cupom ${code} no link da bio!`,
        cta: `Comente "EU QUERO" para receber o link com desconto no direct ⚡`,
        hashtags: "#achadinhos #shopee #viral #review #utilidades #desconto #smkon",
        channels: ["Instagram", "TikTok", "YouTube"],
      };
    }

    case "shein-fashion": {
      const hook = VIRAL_HOOKS.find((h) => h.category === "shein") || VIRAL_HOOKS[0];
      const targetUrl = options?.productUrl || "https://br.shein.com/item-exemplo";
      const trackedLink = generateSheinTrackedLink({
        goodsUrl: targetUrl,
        couponCode: code,
        campaignTag: "reels_moda",
      });

      return {
        title: `Look Inteligente Shein: ${productName}`,
        product: productName,
        assetUrl: trackedLink,
        hook,
        promoCode: code,
        script: `[HOOK 0-3s]: ${hook.text}\n\n[DETALHES DO LOOK 3-10s]\nEssa peça em ${productName} veste perfeitamente e tem acabamento de grife importada. O caimento é surreal de lindo.\n\n[PROVA & CUPOM 10-15s]\nUsei o cupom secreto ${code} para sair por menos de R$ 35 com frete grátis! Link direto na bio.`,
        caption: `Achadinho de ouro da Shein que parece de marca cara! ✨\n\nCupom ativo: ${code}. Link nos comentários e na bio.`,
        cta: "Link direto com cupom aplicado na bio 🛍️",
        hashtags: "#shein #lookshein #achadinhoshein #modafeminina #cupomshein #smkon",
        channels: ["Instagram", "TikTok"],
      };
    }

    case "digital-infoproduct": {
      const blueprint = getBlueprintByNiche("ecommerce-afiliados");
      const hook = VIRAL_HOOKS.find((h) => h.category === "infoproduto") || VIRAL_HOOKS[3];

      return {
        title: `Lançamento: ${blueprint.title}`,
        product: blueprint.title,
        assetUrl: "https://pay.kiwify.com.br/checkout-exemplo",
        hook,
        promoCode: "PIX10",
        script: `[HOOK 0-3s]: ${hook.text}\n\n[METODOLOGIA 3-10s]\nO método exato que utilizamos para faturar com produtos virais sem investir em anúncios caros e sem precisar aparecer.\n\n[CALL TO ACTION 10-15s]\nO material completo com checklists práticos e prompts de IA está disponível por apenas R$ ${blueprint.recommendedPriceBrl.toFixed(2)}! Clique no link da bio.`,
        caption: `${blueprint.subtitle}\n\n${blueprint.salesCopySummary}\n\nGaranta seu acesso imediato no link da bio!`,
        cta: blueprint.checkoutCta,
        hashtags: "#rendaextra #afiliados #marketingdigital #kiwify #infoprodutos #smkon",
        channels: ["Instagram", "TikTok", "YouTube"],
      };
    }

    case "hotmart-course":
    default: {
      const hook = VIRAL_HOOKS[2];
      return {
        title: `Review Exclusiva: ${productName}`,
        product: productName,
        assetUrl: options?.productUrl || "https://hotmart.com/item-exemplo",
        hook,
        promoCode: code,
        script: `[HOOK 0-3s]: ${hook.text}\n\n[ANÁLISE SINCERA 3-10s]\nTestei na prática e avaliei todos os pontos positivos e negativos para você não perder dinheiro.\n\n[CONCLUSÃO 10-15s]\nVale cada centavo se você aplicar o método correto. Link oficial com garantia total na bio!`,
        caption: `Minha avaliação honesta sobre o ${productName}. Confira todos os detalhes no link da bio!`,
        cta: "Acesse a condição oficial com garantia no link da bio ⚡",
        hashtags: "#review #curso #hotmart #educacao #afiliados #smkon",
        channels: ["Instagram", "YouTube"],
      };
    }
  }
}
