/** Stub de geração de conteúdo a partir de um produto (Creative). */

import type { ProductPayload } from "./types";

export type GeneratedContent = {
  title: string;
  script: string;
  caption: string;
  cta: string;
  hashtags: string;
  disclosure: string;
};

export function generateContentFromProduct(product: ProductPayload): GeneratedContent {
  const name = product.name.trim();
  const source = product.source;
  const isAffiliate = product.revenueDomain !== "own_sales";

  const disclosure = isAffiliate
    ? "\n\n⚠️ Divulgação: este conteúdo contém link de afiliado. Posso receber comissão se você comprar."
    : "";

  return {
    title: `Descubra ${name} — vale a pena?`,
    script: `Hook: Você já ouviu falar de ${name}?\n\nProblema: Muita gente perde tempo com produtos que não entregam resultado.\n\nSolução: ${name} é um produto ${product.type ?? "digital"} disponível na ${source}.\n\nProva: [inserir evidência ou depoimento]\n\nCTA: Clique no link e confira os detalhes.`,
    caption: `${name} — análise rápida para quem quer resultado real no digital.\n\nFonte: ${source}${disclosure}`,
    cta: isAffiliate ? "Link na bio / clique aqui" : "Compre agora na loja",
    hashtags: `#${name.replace(/\s+/g, "")} #infoproduto #digital #${source} #smkon`,
    disclosure,
  };
}
