export type SoftwareProjectType =
  | "landing_page"
  | "institutional_site"
  | "ecommerce_store"
  | "saas_system"
  | "api_integration"
  | "bot_automation";

export type SoftwareAddonId =
  | "auth_rbac"
  | "pix_checkout"
  | "admin_dashboard"
  | "ai_bot"
  | "deploy_domain"
  | "seo_analytics";

export type SoftwareUrgency = "standard" | "priority" | "express";

export type SoftwareQuoteInput = {
  projectType: SoftwareProjectType;
  addons: SoftwareAddonId[];
  urgency: SoftwareUrgency;
  pagesOrEndpoints?: number;
};

export type SoftwareQuoteResult = {
  projectType: SoftwareProjectType;
  projectLabel: string;
  basePriceCents: number;
  addonsPriceCents: number;
  urgencyMultiplier: number;
  minEstimateCents: number;
  maxEstimateCents: number;
  estimatedDays: number;
  deliverables: string[];
  recommendedStack: string[];
};

const PROJECT_CATALOG: Record<
  SoftwareProjectType,
  {
    label: string;
    baseCents: number;
    baseDays: number;
    deliverables: string[];
    stack: string[];
  }
> = {
  landing_page: {
    label: "Landing Page de Alta Conversão",
    baseCents: 120000, // R$ 1.200
    baseDays: 5,
    deliverables: [
      "Design responsivo mobile-first exclusivo",
      "Seções estratégicas de oferta, prova social e FAQ",
      "Formulário de captura + botão direto de WhatsApp",
      "Otimização de performance e SEO técnico básico",
    ],
    stack: ["Next.js", "TypeScript", "Tailwind / CSS Moderno", "Vercel"],
  },
  institutional_site: {
    label: "Site Institucional Corporativo",
    baseCents: 220000, // R$ 2.200
    baseDays: 10,
    deliverables: [
      "Arquitetura multipáginas (Home, Sobre, Serviços, Contato)",
      "Identidade visual corporativa e animações fluidas",
      "SEO avançado com metadados e OpenGraph",
      "Integração com formulário e canais de atendimento",
    ],
    stack: ["Next.js App Router", "TypeScript", "Vercel Edge"],
  },
  ecommerce_store: {
    label: "Loja Virtual Completa (PIX, Frete & Painel)",
    baseCents: 450000, // R$ 4.500
    baseDays: 18,
    deliverables: [
      "Vitrine pública, carrinho lateral, cupons e checkout",
      "Integração com Mercado Pago (PIX/Cartão) + Webhooks",
      "Cálculo de frete automático (Correios/Melhor Envio)",
      "Painel administrativo para produtos, pedidos e estoque",
    ],
    stack: ["Next.js", "Supabase Postgres + RLS", "Mercado Pago", "Melhor Envio"],
  },
  saas_system: {
    label: "Sistema Web / Painel SaaS Sob Medida",
    baseCents: 650000, // R$ 6.500
    baseDays: 25,
    deliverables: [
      "Banco de dados relacional multi-tenant com RLS",
      "Autenticação segura e controle de permissões",
      "Dashboards operacionais, relatórios e fluxos de negócio",
      "APIs REST/RPC documentadas e testes automatizados",
    ],
    stack: ["Next.js", "TypeScript", "Supabase / Postgres", "Tests"],
  },
  api_integration: {
    label: "API REST, Webhooks & Integração de Sistemas",
    baseCents: 180000, // R$ 1.800
    baseDays: 7,
    deliverables: [
      "Endpoints tipados com validação estrita e rate limiting",
      "Assinatura criptográfica (HMAC) e idempotência em webhooks",
      "Sincronização automática entre ERP, pagamentos ou marketplaces",
      "Logs estruturados e tratamento de falhas",
    ],
    stack: ["Node.js / TypeScript", "Next.js Route Handlers", "Postgres"],
  },
  bot_automation: {
    label: "Bot de Atendimento, IA & Automação",
    baseCents: 240000, // R$ 2.400
    baseDays: 8,
    deliverables: [
      "Assistente inteligente integrado ao site ou WhatsApp",
      "Fluxos de triagem, consulta de pedidos e suporte 24h",
      "Base de conhecimento dinâmica conectada ao banco",
      "Fallback determinístico e proteção contra abuso",
    ],
    stack: ["TypeScript", "AI SDK / Gemini", "Webhooks", "Supabase"],
  },
};

const ADDONS_CATALOG: Record<SoftwareAddonId, { label: string; cents: number; days: number }> = {
  auth_rbac: { label: "Login + Permissões por Perfil (RBAC)", cents: 65000, days: 3 },
  pix_checkout: { label: "Pagamento PIX + Cartão com Webhook", cents: 85000, days: 4 },
  admin_dashboard: { label: "Painel Administrativo Gerenciável", cents: 110000, days: 5 },
  ai_bot: { label: "Bot de Suporte Inteligente no Site", cents: 75000, days: 3 },
  deploy_domain: { label: "Deploy em Produção + Domínio & SSL", cents: 35000, days: 1 },
  seo_analytics: { label: "SEO Técnico + Métricas de Conversão", cents: 40000, days: 2 },
};

export function listSoftwareOptions() {
  return {
    projects: Object.entries(PROJECT_CATALOG).map(([id, item]) => ({
      id: id as SoftwareProjectType,
      label: item.label,
      baseCents: item.baseCents,
      baseDays: item.baseDays,
    })),
    addons: Object.entries(ADDONS_CATALOG).map(([id, item]) => ({
      id: id as SoftwareAddonId,
      label: item.label,
      cents: item.cents,
      days: item.days,
    })),
  };
}

export function calculateSoftwareQuote(input: SoftwareQuoteInput): SoftwareQuoteResult {
  const project = PROJECT_CATALOG[input.projectType] ?? PROJECT_CATALOG.institutional_site;
  const uniqueAddons = Array.from(new Set(input.addons)).filter((a) => a in ADDONS_CATALOG);

  let addonsPriceCents = 0;
  let extraDays = 0;
  const deliverables = [...project.deliverables];

  for (const addonId of uniqueAddons) {
    const addon = ADDONS_CATALOG[addonId];
    addonsPriceCents += addon.cents;
    extraDays += addon.days;
    deliverables.push(`Módulo adicional: ${addon.label}`);
  }

  const extraVolume = Math.max(0, Number(input.pagesOrEndpoints || 0) - 5);
  const volumeCents = extraVolume * 15000; // R$ 150 por página/endpoint extra acima de 5

  const urgencyMultiplier =
    input.urgency === "express" ? 1.35 : input.urgency === "priority" ? 1.15 : 1.0;

  const rawTotal = Math.round((project.baseCents + addonsPriceCents + volumeCents) * urgencyMultiplier);
  const minEstimateCents = Math.round(rawTotal * 0.92);
  const maxEstimateCents = Math.round(rawTotal * 1.12);

  const rawDays = project.baseDays + extraDays + Math.ceil(extraVolume / 3);
  const estimatedDays =
    input.urgency === "express"
      ? Math.max(2, Math.ceil(rawDays * 0.6))
      : input.urgency === "priority"
      ? Math.max(3, Math.ceil(rawDays * 0.8))
      : rawDays;

  return {
    projectType: input.projectType,
    projectLabel: project.label,
    basePriceCents: project.baseCents,
    addonsPriceCents: addonsPriceCents + volumeCents,
    urgencyMultiplier,
    minEstimateCents,
    maxEstimateCents,
    estimatedDays,
    deliverables,
    recommendedStack: project.stack,
  };
}
