/**
 * Audiência / CRM · service: regras de negócio e casos de uso (S4).
 * Combina schema (validação) e repository (dados). As Server Actions e a rota de
 * exportação chamam o service; cada uma mantém a sua mensagem de permissão.
 *
 * Regras permanentes (LGPD): consentimento só com evidência, histórico imutável,
 * pedido do titular com prazo e exclusão por anonimização. Quem garante isso é o
 * banco (RPCs com checagem de papel e auditoria); aqui só se valida e encaminha.
 *
 * Imports relativos com `.ts`: carregável em `node --test` (testado com cliente falso).
 */
import type { Raw } from "../validation/fields.ts";
import {
  anonymizeContact,
  createContact,
  recordConsent,
  registerRequest,
  resolveRequest,
  revokeAllConsents,
  updateContact,
  type SupabaseClient,
} from "./repository.ts";
import {
  parseAnonymizeInput,
  parseConsentEvent,
  parseContactInput,
  parseContactUpdate,
  parseRequestInput,
  parseResolveInput,
  parseRevokeAll,
} from "./schema.ts";

/** Só owner e admin alteram cadastro, consentimento e pedidos; os demais papéis leem. */
export function canManageAudience(role: string): boolean {
  return role === "owner" || role === "admin";
}

/** Valida e cadastra o contato (com o consentimento inicial, se houver). Devolve o id. */
export async function registerContact(supabase: SupabaseClient, organizationId: string, raw: Raw, now: Date = new Date()): Promise<string> {
  return createContact(supabase, organizationId, parseContactInput(raw, now));
}

/** Corrige dados cadastrais; o histórico de consentimento não muda. */
export async function correctContact(supabase: SupabaseClient, raw: Raw): Promise<void> {
  await updateContact(supabase, parseContactUpdate(raw));
}

/** Registra opt-in (com evidência) ou opt-out. Devolve a ação registrada. */
export async function recordConsentEvent(supabase: SupabaseClient, raw: Raw, now: Date = new Date()): Promise<"opt_in" | "opt_out"> {
  const input = parseConsentEvent(raw, now);
  await recordConsent(supabase, input);
  return input.action;
}

/** Revoga todos os consentimentos ativos do contato. Devolve quantos foram revogados. */
export async function revokeAll(supabase: SupabaseClient, raw: Raw): Promise<number> {
  return revokeAllConsents(supabase, parseRevokeAll(raw));
}

/** Registra um pedido do titular (prazo calculado pelo banco). Devolve o id. */
export async function registerSubjectRequest(supabase: SupabaseClient, raw: Raw, now: Date = new Date()): Promise<string> {
  return registerRequest(supabase, parseRequestInput(raw, now));
}

/** Conclui ou recusa (com motivo) um pedido do titular. Devolve a decisão. */
export async function resolveSubjectRequest(supabase: SupabaseClient, raw: Raw): Promise<"completed" | "rejected"> {
  const input = parseResolveInput(raw);
  await resolveRequest(supabase, input);
  return input.status;
}

/** Exclusão direta: anonimiza o contato com confirmação e motivo. */
export async function eraseContact(supabase: SupabaseClient, raw: Raw): Promise<void> {
  await anonymizeContact(supabase, parseAnonymizeInput(raw));
}
