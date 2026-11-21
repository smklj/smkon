/**
 * Financeiro · service: casos de uso de leitura (S4).
 * Hoje o módulo só lê comissões de afiliado; vendas próprias e mídia paga são
 * domínios separados e entram em splits próprios, nunca somados aqui.
 *
 * Imports relativos com `.ts`: carregável em `node --test` (testado com cliente falso).
 */
import { listCommissionSummaries, listRecentCommissionChanges, type SupabaseClient } from "./repository.ts";
import type { CommissionHistoryRow, CommissionSummary } from "./types.ts";

export type CommissionOverview = { summaries: CommissionSummary[]; history: CommissionHistoryRow[] };

/**
 * Resumo por moeda e últimas mudanças de estado, consultados em paralelo. Se as duas
 * consultas falharem, o erro do resumo é o propagado (mesma ordem de antes).
 */
export async function loadCommissionOverview(supabase: SupabaseClient, organizationId: string): Promise<CommissionOverview> {
  const [summaries, history] = await Promise.allSettled([
    listCommissionSummaries(supabase, organizationId),
    listRecentCommissionChanges(supabase, organizationId),
  ]);
  if (summaries.status === "rejected") throw summaries.reason;
  if (history.status === "rejected") throw history.reason;
  return { summaries: summaries.value, history: history.value };
}
