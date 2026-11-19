import type { createClient } from "@/lib/supabase/server";
import { isMemberRole, isMissingSchemaObject, type MemberRole, type MemberRow } from "./members";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type MembersResult =
  | { state: "ok"; members: MemberRow[] }
  | { state: "forbidden" }
  | { state: "unavailable" };

/**
 * Membros do workspace (owner/admin), com e-mail lido no banco por public.list_workspace_members.
 * `unavailable`: a migration S5.1 ainda não foi aplicada neste ambiente.
 */
export async function listMembers(supabase: SupabaseClient, organizationId: string): Promise<MembersResult> {
  const { data, error } = await supabase.rpc("list_workspace_members", { p_organization_id: organizationId });
  if (error) {
    if (isMissingSchemaObject(error)) return { state: "unavailable" };
    if (error.message?.trim() === "forbidden" || error.code === "42501") return { state: "forbidden" };
    throw error;
  }
  const members = (data ?? [])
    .filter((row) => isMemberRole(row.member_role))
    .map((row) => ({
      userId: row.user_id,
      email: row.email ?? null,
      role: row.member_role as MemberRole,
      joinedAt: row.joined_at,
    }));
  return { state: "ok", members };
}

/** Altera o papel (somente owner; o banco protege o último owner). Retorna se houve mudança. */
export async function changeMemberRole(
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

export async function removeMember(supabase: SupabaseClient, organizationId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc("remove_member", { p_organization_id: organizationId, p_user_id: userId });
  if (error) throw error;
}

/** Grava o workspace ativo no servidor. O banco confere a membership; o cliente só sugere o id. */
export async function setActiveWorkspace(supabase: SupabaseClient, organizationId: string): Promise<void> {
  const { error } = await supabase.rpc("set_active_workspace", { p_organization_id: organizationId });
  if (error) throw error;
}
