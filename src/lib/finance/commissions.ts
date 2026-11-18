/**
 * Ciclo de vida das comissões de afiliado (espelha a migration 20261118200000_commission_lifecycle).
 * O banco é a fonte da verdade; este módulo serve para rótulos e validação na interface.
 */

export const COMMISSION_STATUSES = ["pending", "approved", "settled", "paid", "cancelled", "reversed"] as const;
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];

export const COMMISSION_LABEL: Record<CommissionStatus, string> = {
  pending: "Prevista",
  approved: "Aprovada",
  settled: "Liquidada",
  paid: "Paga",
  cancelled: "Cancelada",
  reversed: "Estornada",
};

export const COMMISSION_DESCRIPTION: Record<CommissionStatus, string> = {
  pending: "Conversão registrada, ainda não validada pelo programa.",
  approved: "Validada pelo programa, ainda não disponível.",
  settled: "Disponível para saque ou pagamento.",
  paid: "Recebida.",
  cancelled: "Cancelada antes da aprovação.",
  reversed: "Estornada depois de aprovada, liquidada ou paga.",
};

const TRANSITIONS: Record<CommissionStatus, readonly CommissionStatus[]> = {
  pending: ["approved", "cancelled"],
  approved: ["settled", "reversed"],
  settled: ["paid", "reversed"],
  paid: ["reversed"],
  cancelled: [],
  reversed: [],
};

export function nextCommissionStatuses(from: CommissionStatus): readonly CommissionStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: CommissionStatus, to: CommissionStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

export function isFinal(status: CommissionStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** Valor do lançamento no ledger para a transição: negativo em cancelamento e estorno. */
export function ledgerAmount(status: CommissionStatus, commissionAmount: number): number {
  return status === "cancelled" || status === "reversed" ? -commissionAmount : commissionAmount;
}

export function formatMoney(value: number | null | undefined, currency: string): string {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(Number(value ?? 0));
  } catch {
    return `${currency} ${Number(value ?? 0).toFixed(2)}`;
  }
}
