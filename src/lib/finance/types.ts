/**
 * Financeiro · tipos de linha (S4).
 * Comissões de afiliado: domínio separado de vendas próprias e de mídia paga,
 * que entram em splits próprios. Estados de receita nunca se misturam: cada
 * coluna do resumo corresponde a um único estado (ver commissions.ts).
 */

/** Uma linha da view affiliate_commission_summary (uma por moeda do workspace). */
export type CommissionSummary = {
  currency: string | null;
  conversions: number | null;
  forecast_amount: number | null;
  approved_amount: number | null;
  settled_amount: number | null;
  paid_amount: number | null;
  cancelled_amount: number | null;
  reversed_amount: number | null;
};

/** Uma mudança de estado em affiliate_commission_status_history (somente leitura, imutável). */
export type CommissionHistoryRow = {
  id: number;
  to_status: string;
  from_status: string | null;
  commission_amount: number | null;
  currency: string;
  changed_at: string;
};
