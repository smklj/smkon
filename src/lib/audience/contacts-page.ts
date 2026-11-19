/**
 * S16 — paginação por cursor da lista de contatos de /audiencia.
 * Mais recentes primeiro, desempate por id (created_at tem empates).
 * Índice: o existente contacts_org_created_idx (organization_id, created_at desc) serve —
 * medido em docs/S16_PROGRESS.md (30 mil contatos no workspace, sob RLS): 1ª página e página
 * funda em ~0,15 ms com Incremental Sort só nos empates. Por isso não há índice novo.
 */
import { applyKeyset, type KeysetQuery, type KeysetSpec } from "../pagination/keyset.ts";

export const CONTACTS_KEYSET: KeysetSpec = {
  id: "contacts",
  direction: "desc",
  keys: [
    { column: "created_at", type: "timestamp" },
    { column: "id", type: "uuid" },
  ],
};

export const CONTACT_PAGE_SIZE = 50;

/** O mínimo do query builder usado pela lista (facilita testar a URL sem rede). */
export interface ContactsQuery<Q> extends KeysetQuery<Q> {
  eq(column: string, value: string): Q;
  is(column: string, value: null): Q;
}

/**
 * Filtros da lista de contatos + paginação. Busca e cursor viram dois parâmetros `or`
 * independentes; o PostgREST combina os filtros de primeiro nível com AND
 * (casa com a busca E vem depois do cursor). O termo já chega saneado (sanitizeSearch).
 */
export function contactsListQuery<Q extends ContactsQuery<Q>>(
  query: Q,
  options: { organizationId: string; term: string; includeAnonymized: boolean; after: readonly string[] | null; pageSize: number },
): Q {
  let next = query.eq("organization_id", options.organizationId);
  if (!options.includeAnonymized) next = next.is("anonymized_at", null);
  if (options.term) {
    const t = options.term;
    next = next.or(`display_name.ilike."*${t}*",email.ilike."*${t}*",phone.ilike."*${t}*"`);
  }
  return applyKeyset(next, CONTACTS_KEYSET, options.after, options.pageSize);
}
