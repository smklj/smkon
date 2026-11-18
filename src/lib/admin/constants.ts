/** Shared constants for Admin Panel and Control Center (read-only status). */

export type Area = {
  id: string;
  name: string;
  type: string;
  description: string;
  scope: string[];
};

export type RevenueDomain = {
  id: string;
  name: string;
  type: string;
  description: string;
  sources: string[];
  metric: string;
};

export const AREAS: Area[] = [
  { id: "01", name: "Estratégia e gestão", type: "DIREÇÃO", description: "Metas, prioridades, roadmap, indicadores executivos e decisões do Owner.", scope: ["OKRs", "Roadmap", "Decisões"] },
  { id: "02", name: "Inteligência de produtos", type: "PESQUISA", description: "Descoberta, comparação e avaliação de produtos, ofertas, vendedores, preço e potencial de conteúdo.", scope: ["Catálogo", "Ofertas", "Scoring"] },
  { id: "03", name: "Conteúdo e distribuição", type: "MÍDIA PRÓPRIA", description: "Pautas, roteiros, ativos, direitos, versões, aprovação, calendário e publicação permitida.", scope: ["Conteúdo", "Direitos", "Canais"] },
  { id: "04", name: "IA e agentes", type: "AUTOMAÇÃO CONTROLADA", description: "Agentes, tarefas, ferramentas allowlist, execução verificável, limites, logs e aprovação humana.", scope: ["Planner", "Executor", "Verifier"] },
  { id: "05", name: "Financeiro", type: "CONTROLE FINANCEIRO", description: "Conciliação, ledger, custos, receita, comissões, caixa e relatórios por domínio e consolidados.", scope: ["Ledger", "Conciliação", "Relatórios"] },
  { id: "06", name: "Jurídico e conformidade", type: "GOVERNANÇA", description: "Regras de plataforma, contratos, direitos de uso, disclosure, privacidade e obrigações fiscais.", scope: ["Licenças", "Disclosure", "Políticas"] },
  { id: "07", name: "Audiência e relacionamento", type: "CRESCIMENTO ORGÂNICO", description: "Comunidade, relacionamento, feedback, atendimento, parcerias e análise de audiência.", scope: ["Audiência", "Feedback", "CRM"] },
  { id: "08", name: "Segurança e infraestrutura", type: "PLATAFORMA", description: "Identidade, permissões, RLS, integrações, segredos, observabilidade, backup e kill switch.", scope: ["Supabase", "Vercel", "RLS"] },
];

export const REVENUE_DOMAINS: RevenueDomain[] = [
  { id: "R1", name: "Mídia e anúncios", type: "CUSTO DE AQUISIÇÃO", description: "Investimento e desempenho de campanhas. Gasto é custo, não receita.", sources: ["Meta Ads", "Google Ads", "GA4"], metric: "Spend · CPC · CPM · CPA · ROAS" },
  { id: "R2", name: "Vendas próprias", type: "RECEITA DE OPERAÇÃO", description: "Pedidos em que a SMKON é a vendedora, com taxas, frete, reembolsos e liquidação.", sources: ["Mercado Livre", "TikTok Shop Seller", "Shopify"], metric: "Pedidos · líquido · margem" },
  { id: "R3", name: "Afiliados e comissões", type: "RECEITA DE PARCERIA", description: "Cliques, conversões atribuídas e comissões pendentes, aprovadas, revertidas e pagas.", sources: ["Shopee", "Amazon Associados", "TikTok Shop Affiliate"], metric: "Cliques · conversão · comissão · EPC" },
];

export const INTEGRATION_PLACEHOLDERS = [
  {
    name: "Metricool",
    detail: "Placeholder — publicação e analytics. Ainda não validado. Nenhum conteúdo será publicado daqui. OAuth real pendente.",
    state: "PLACEHOLDER",
  },
  {
    name: "Instagram",
    detail: "Placeholder — métricas orgânicas e insights. Autenticação parcial via Supermetrics; leitura não operacional. Sem OAuth direto ainda.",
    state: "PLACEHOLDER",
  },
  {
    name: "TikTok",
    detail: "Placeholder — TikTok Organic e Shop. Escopos não totalmente validados. Sem publicação. OAuth real pendente.",
    state: "PLACEHOLDER",
  },
];
