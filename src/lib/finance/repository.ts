/**
 * Financeiro · repository: leitura das comissões de afiliado (S4).
 * Somente leitura: as mudanças de estado e os lançamentos no ledger são feitos
 * pelo banco (migration commission_lifecycle), com histórico imutável. O
 * isolamento por workspace é garantido pela RLS e reforçado pelo filtro
 * organization_id em cada consulta.
 *
 * Imports relativos com `.ts` (e o cliente só como tipo): o arquivo é carregável
 * em `node --test`, para testar o filtro por workspace com um cliente falso.
 */
import type { createClient } from "../supabase/server.ts";
import type { CommissionHistoryRow, CommissionSummary } from "./types.ts";

export type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export const COMMISSION_SUMMARY_COLUMNS =
  "currency,conversions,forecast_amount,approved_amount,settled_amount,paid_amount,cancelled_amount,reversed_amount";
export const COMMISSION_HISTORY_COLUMNS = "id,to_status,from_status,commission_amount,currency,changed_at";
/** Quantas mudanças de estado a página do financeiro mostra. */
export const COMMISSION_HISTORY_LIMIT = 10;

/** Resumo por moeda do workspace (view affiliate_commission_summary). */
export async function listCommissionSummaries(supabase: SupabaseClient, organizationId: string): Promise<CommissionSummary[]> {
  const { data, error } = await supabase
    .from("affiliate_commission_summary")
    .select(COMMISSION_SUMMARY_COLUMNS)
    .eq("organization_id", organizationId);
  if (error) throw error;
  return (data ?? []) as CommissionSummary[];
}

/** Mudanças de estado mais recentes primeiro. */
export async function listRecentCommissionChanges(
  supabase: SupabaseClient,
  organizationId: string,
  limit: number = COMMISSION_HISTORY_LIMIT,
): Promise<CommissionHistoryRow[]> {
  const { data, error } = await supabase
    .from("affiliate_commission_status_history")
    .select(COMMISSION_HISTORY_COLUMNS)
    .eq("organization_id", organizationId)
    .order("changed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as CommissionHistoryRow[];
}
