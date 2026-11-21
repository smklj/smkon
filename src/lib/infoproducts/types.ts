/**
 * Tipos e Estrutura da Fábrica de Infoprodutos Digitais (Frente E · S25)
 * Modela blueprints, capítulos, guias de conteúdo, precificação e compilação para venda direta.
 */

export type InfoproductNiche = "ecommerce-afiliados" | "shein-moda" | "ia-produtividade" | "organizacao-casa";

export type PricingTier = "impulse" | "front-end" | "premium" | "bump";

export type InfoproductChapter = {
  number: number;
  title: string;
  hookSummary: string;
  contentParagraphs: string[];
  actionChecklist: string[];
  proTip?: string;
};

export type InfoproductBlueprint = {
  id: string;
  niche: InfoproductNiche;
  title: string;
  subtitle: string;
  authorOrBrand: string;
  targetAudience: string;
  recommendedPriceBrl: number;
  pricingTier: PricingTier;
  chapters: InfoproductChapter[];
  bonusPromptsOrTemplates?: string[];
  salesCopySummary: string;
  checkoutCta: string;
};
