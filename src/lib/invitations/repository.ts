/**
 * Convites · repository: acesso a organization_invitations e às RPCs (S4).
 * O token nunca passa por aqui: só o hash SHA-256. `token_hash` nem é legível
 * pela API, por isso fica fora das colunas. O workspace sempre vem da sessão.
 *
 * Imports relativos com `.ts` (e o cliente só como tipo): carregável em `node --test`.
 */
import type { createClient } from "../supabase/server.ts";
import type { InvitableRole } from "./token.ts";

export type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Sem token_hash: a coluna nem é legível pela API.
export const INVITATION_COLUMNS = "id,email,role,created_at,expires_at,accepted_at,revoked_at";
/** Quantos convites a API lista (mais recentes primeiro). */
export const INVITATION_LIST_LIMIT = 100;

export type InvitationRow = {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

export async function listInvitations(supabase: SupabaseClient, organizationId: string): Promise<InvitationRow[]> {
  const { data, error } = await supabase
    .from("organization_invitations")
    .select(INVITATION_COLUMNS)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(INVITATION_LIST_LIMIT);
  if (error) throw error;
  return (data ?? []) as InvitationRow[];
}

export type CreateInvitationRow = { invitation_id: string; created: boolean; invitation_expires_at: string };

/** Idempotente no banco: convite pendente para o mesmo e-mail devolve created=false. */
export async function rpcCreateInvitation(
  supabase: SupabaseClient,
  input: { organizationId: string; email: string; role: InvitableRole; tokenHash: string },
): Promise<CreateInvitationRow | null> {
  const { data, error } = await supabase.rpc("create_invitation", {
    p_organization_id: input.organizationId,
    p_email: input.email,
    p_role: input.role,
    p_token_hash: input.tokenHash,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as CreateInvitationRow | null;
}

export async function rpcRevokeInvitation(supabase: SupabaseClient, invitationId: string): Promise<void> {
  const { error } = await supabase.rpc("revoke_invitation", { p_invitation_id: invitationId });
  if (error) throw error;
}

/** Aceite pelo hash do token. Devolve o erro: o chamador traduz a mensagem de negócio. */
export async function rpcAcceptInvitation(
  supabase: SupabaseClient,
  tokenHash: string,
): Promise<{ workspaceId: string | null; error: { code?: string; message?: string } | null }> {
  const { data, error } = await supabase.rpc("accept_invitation", { p_token_hash: tokenHash });
  if (error) return { workspaceId: null, error };
  const row = Array.isArray(data) ? data[0] : data;
  return { workspaceId: row?.workspace_id ?? null, error: null };
}
