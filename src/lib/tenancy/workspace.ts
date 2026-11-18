import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type MemberRole = "owner" | "admin" | "analyst" | "viewer";

export type Workspace = {
  organizationId: string;
  role: MemberRole;
};

/** Membership atual do usuário, sem efeito colateral. Retorna null se ainda não houver workspace. */
export async function findWorkspace(supabase: SupabaseClient, userId: string): Promise<Workspace | null> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { organizationId: data.organization_id, role: data.role as MemberRole };
}

/**
 * Garante um workspace para o usuário autenticado.
 * A criação é atômica no banco (public.ensure_workspace), sem INSERT direto do cliente.
 */
export async function ensureWorkspace(supabase: SupabaseClient): Promise<Workspace> {
  const { data, error } = await supabase.rpc("ensure_workspace");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.workspace_id) throw new Error("ensure_workspace returned no workspace");
  return { organizationId: row.workspace_id, role: row.member_role as MemberRole };
}

export function canEditContent(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}
