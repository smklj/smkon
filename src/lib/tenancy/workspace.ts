import type { createClient } from "@/lib/supabase/server";
import { errorFields, log } from "@/lib/observability/log";
import {
  isMemberRole,
  isMissingSchemaObject,
  resolveActiveWorkspace,
  type MemberRole,
  type WorkspaceMembership,
} from "./members";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type { MemberRole, WorkspaceMembership } from "./members";

export type Workspace = {
  organizationId: string;
  role: MemberRole;
};

/** Todas as memberships do usuário (sob RLS: cada um só lê as próprias), da mais antiga à mais nova. */
export async function listWorkspaces(supabase: SupabaseClient, userId: string): Promise<WorkspaceMembership[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role, created_at, organizations(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? [])
    .filter((row) => isMemberRole(row.role))
    .map((row) => ({
      organizationId: row.organization_id,
      role: row.role as MemberRole,
      name: row.organizations?.name?.trim() || "Workspace",
      joinedAt: row.created_at,
    }));
}

/**
 * Workspace escolhido no seletor, guardado no servidor (public.user_active_workspace).
 * Sem a migration S5.1 no ambiente, não há preferência: vale a membership mais antiga.
 */
async function preferredWorkspaceId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_active_workspace")
    .select("organization_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (!isMissingSchemaObject(error)) log("warn", "tenancy.active_workspace", errorFields(error));
    return null;
  }
  return data?.organization_id ?? null;
}

export type WorkspaceContext = { active: WorkspaceMembership | null; memberships: WorkspaceMembership[] };

/** Memberships e workspace ativo, para o shell (seletor) e para as páginas. */
export async function loadWorkspaceContext(supabase: SupabaseClient, userId: string): Promise<WorkspaceContext> {
  const [memberships, preferred] = await Promise.all([
    listWorkspaces(supabase, userId),
    preferredWorkspaceId(supabase, userId),
  ]);
  return { active: resolveActiveWorkspace(memberships, preferred), memberships };
}

/** Workspace ativo do usuário, sem efeito colateral. Retorna null se ainda não houver workspace. */
export async function findWorkspace(supabase: SupabaseClient, userId: string): Promise<Workspace | null> {
  const { active } = await loadWorkspaceContext(supabase, userId);
  return active ? { organizationId: active.organizationId, role: active.role } : null;
}

/**
 * Garante um workspace para o usuário autenticado e devolve o ativo.
 * A criação é atômica no banco (public.ensure_workspace), sem INSERT direto do cliente.
 */
export async function ensureWorkspace(supabase: SupabaseClient): Promise<Workspace> {
  const { data, error } = await supabase.rpc("ensure_workspace");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.workspace_id) throw new Error("ensure_workspace returned no workspace");

  const { data: auth } = await supabase.auth.getUser();
  const active = auth.user ? await findWorkspace(supabase, auth.user.id) : null;
  return active ?? { organizationId: row.workspace_id, role: row.member_role as MemberRole };
}

export function canEditContent(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}
