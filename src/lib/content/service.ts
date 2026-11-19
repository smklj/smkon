/**
 * Conteúdo (Studio) · service: regras de negócio e casos de uso (S4).
 * Combina schema (validação) e repository (dados). As rotas de API chamam o
 * service; cada uma mantém a sua mensagem de permissão.
 *
 * Regra permanente: a aprovação é humana e da versão exata (hash). Nenhum caminho
 * deste módulo grava status "approved" diretamente (ver schema.parseContentPayload).
 */
import { approveContentVersion, countByStatus, listContentPage, type StatusCounts, type SupabaseClient } from "./repository";
import { parseApproveInput } from "./schema";
import type { ContentStatusApi } from "./types";

/** Criar, editar, excluir conteúdo e operar o calendário: owner ou admin (definição em tenancy). */
export { canEditContent } from "@/lib/tenancy/workspace";

/**
 * Página da biblioteca. Na primeira página (sem cursor) também devolve as contagens
 * por status do workspace inteiro, em paralelo com a lista.
 */
export async function listLibrary(
  supabase: SupabaseClient,
  organizationId: string,
  status: ContentStatusApi | null,
  after: readonly string[] | null,
  pageSize: number,
) {
  const [page, counts] = await Promise.all([
    listContentPage(supabase, organizationId, status, after, pageSize),
    after ? Promise.resolve<StatusCounts | null>(null) : countByStatus(supabase, organizationId),
  ]);
  return { ...page, counts };
}

/** Valida o pedido e aprova a versão exata que o revisor viu (o banco confere hash e papel). */
export async function approveExactVersion(supabase: SupabaseClient, body: unknown) {
  const { id, contentHash, note } = parseApproveInput(body);
  return approveContentVersion(supabase, id, contentHash, note);
}
