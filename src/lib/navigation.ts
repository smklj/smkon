import type { IconName } from "@/components/ui/Icon";

export type ModuleStatus = "available" | "building" | "planned";

export type NavItem = {
  area: string;
  label: string;
  href: string | null;
  icon: IconName;
  status: ModuleStatus;
  /** Cor de destaque usada só no indicador do módulo (uso estratégico de cor). */
  accent: string;
  summary: string;
};

/**
 * Os oito domínios do SMKON e seu estado real de implementação.
 * Atualize o status somente quando a funcionalidade estiver validada.
 */
export const NAV_ITEMS: NavItem[] = [
  { area: "01", label: "Visão geral", href: "/painel", icon: "overview", status: "available", accent: "#FFFFFF", summary: "Indicadores e fila de aprovação do workspace." },
  { area: "02", label: "Produtos", href: "/produtos", icon: "products", status: "building", accent: "#6EA8FE", summary: "Catálogo persistente com evidências verificadas e score explicável. Sem coleta automática ainda." },
  { area: "03", label: "Content Studio", href: "/studio", icon: "content", status: "available", accent: "#C084FC", summary: "Roteiros, versões, aprovação humana da versão exata e calendário em dry-run." },
  { area: "04", label: "Agentes de IA", href: "/agentes", icon: "agents", status: "building", accent: "#5EEAD4", summary: "Execuções Planner → Executor → Verifier com limites, allowlist e kill switch. Executor do servidor ainda não ativo." },
  { area: "05", label: "Financeiro", href: "/financeiro", icon: "finance", status: "building", accent: "#3DDC97", summary: "Comissões de afiliado com ciclo de vida e ledger. Vendas próprias e mídia sem ingestão ainda." },
  { area: "06", label: "Jurídico", href: "/midia", icon: "legal", status: "building", accent: "#F5B547", summary: "Mídia privada e licenças de uso exigidas na publicação. Disclosure e LGPD a seguir." },
  { area: "07", label: "Audiência e CRM", href: "/audiencia", icon: "audience", status: "building", accent: "#FB923C", summary: "Contatos com base legal, consentimento com prova e pedidos do titular (LGPD). Sem envio de mensagens." },
  { area: "08", label: "Segurança e admin", href: "/admin", icon: "security", status: "available", accent: "#FF6B6B", summary: "Modelo operacional, papéis, auditoria e integrações." },
  { area: "09", label: "Loja Virtual", href: "/admin/loja", icon: "store", status: "available", accent: "#00F0FF", summary: "Gestão completa da loja: produtos físicos, digitais, Shopee, pedidos, frete e pagamentos." },
];

export const STATUS_LABEL: Record<ModuleStatus, string> = {
  available: "Disponível",
  building: "Em construção",
  planned: "Planejado",
};

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
