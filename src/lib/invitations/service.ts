/**
 * Convites · service: casos de uso de criação, revogação e aceite (S4).
 * O token é gerado aqui e devolvido só ao chamador que criou o convite; ao
 * banco vai apenas o hash. Nunca registrar o token em log.
 *
 * Imports relativos com `.ts`: carregável em `node --test` (testado com cliente falso).
 */
import { generateInviteToken, hashInviteToken } from "./token.ts";
import type { InvitationInput } from "./schema.ts";
import {
  listInvitations,
  rpcAcceptInvitation,
  rpcCreateInvitation,
  rpcRevokeInvitation,
  type SupabaseClient,
} from "./repository.ts";

export { listInvitations };

export type CreatedInvitation =
  | { created: true; id: string; expiresAt: string; token: string }
  | { created: false; id: string; expiresAt: string };

/**
 * Cria o convite no workspace da sessão. Se já houver convite pendente para o
 * e-mail, nenhum token novo é emitido (created=false, sem token).
 */
export async function createInvitation(
  supabase: SupabaseClient,
  organizationId: string,
  input: InvitationInput,
): Promise<CreatedInvitation> {
  const { token, tokenHash } = generateInviteToken();
  const row = await rpcCreateInvitation(supabase, { organizationId, email: input.email, role: input.role, tokenHash });
  if (!row?.invitation_id) throw new Error("create_invitation returned no row");
  if (!row.created) return { created: false, id: row.invitation_id, expiresAt: row.invitation_expires_at };
  return { created: true, id: row.invitation_id, expiresAt: row.invitation_expires_at, token };
}

export async function revokeInvitation(supabase: SupabaseClient, invitationId: string): Promise<void> {
  await rpcRevokeInvitation(supabase, invitationId);
}

/** Aceita pelo token do link (o banco confere hash, validade, e-mail e uso único). */
export async function acceptInvitation(supabase: SupabaseClient, token: string) {
  return rpcAcceptInvitation(supabase, hashInviteToken(token));
}
