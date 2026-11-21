/**
 * Tenancy · repository: acesso a dados de workspaces e membros (S4).
 *
 * Só consultas e RPCs, sem regra de negócio nem log. A autorização de verdade
 * fica no banco: RLS em organization_members/user_active_workspace (cada usuário
 * só lê as próprias linhas) e funções security definer que conferem papel e
 * protegem o último owner.
 *
 * Imports relativos com `.ts` (e o cliente só como tipo): carregável em
 * `node --test`, testado com um cliente falso.
 */
import type { createClient } from "../supabase/server.ts";
import type { MemberRole } from "./members.ts";

export type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export const MEMBERSHIP_COLUMNS = "organization_id, role, created_at, organizations(name)";

export type MembershipRow = {
  organization_id: string;
  role: string;
  created_at: string;
  organizations: { name: string | null } | null;
};

/** Memberships do usuário, da mais antiga à mais nova. */
export async function selectMemberships(supabase: SupabaseClient, userId: string): Promise<MembershipRow[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select(MEMBERSHIP_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MembershipRow[];
}

/**
 * Workspace preferido salvo no servidor. Devolve o erro em vez de lançar: quem
 * chama decide (sem a migration S5.1 a tabela não existe e isso não é falha).
 */
export async function selectPreferredWorkspace(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ organizationId: string | null; error: { code?: string; message?: string } | null }> {
  const { data, error } = await supabase
    .from("user_active_workspace")
    .select("organization_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { organizationId: null, error };
  return { organizationId: data?.organization_id ?? null, error: null };
}

export type EnsureWorkspaceRow = { workspace_id: string; member_role: string };

/** Cria (se preciso) o workspace do usuário autenticado, atomicamente no banco. */
export async function rpcEnsureWorkspace(supabase: SupabaseClient): Promise<EnsureWorkspaceRow | null> {
  const { data, error } = await supabase.rpc("ensure_workspace");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as EnsureWorkspaceRow | null;
}

export type WorkspaceMemberRow = { user_id: string; email: string | null; member_role: string; joined_at: string };

/** Membros com e-mail (public.list_workspace_members). Devolve o erro: quem chama o classifica. */
export async function rpcListWorkspaceMembers(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ rows: WorkspaceMemberRow[]; error: { code?: string; message?: string } | null }> {
  const { data, error } = await supabase.rpc("list_workspace_members", { p_organization_id: organizationId });
  if (error) return { rows: [], error };
  return { rows: (data ?? []) as WorkspaceMemberRow[], error: null };
}

/** Altera o papel; devolve se houve mudança. */
export async function rpcChangeMemberRole(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  role: MemberRole,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("change_member_role", {
    p_organization_id: organizationId,
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return Boolean(row?.changed);
}

export async function rpcRemoveMember(supabase: SupabaseClient, organizationId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc("remove_member", { p_organization_id: organizationId, p_user_id: userId });
  if (error) throw error;
}

export async function rpcSetActiveWorkspace(supabase: SupabaseClient, organizationId: string): Promise<void> {
  const { error } = await supabase.rpc("set_active_workspace", { p_organization_id: organizationId });
  if (error) throw error;
}
