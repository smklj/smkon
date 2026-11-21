/**
 * Tenancy · service: workspace ativo, permissões por papel e gestão de membros (S4).
 *
 * Combina as regras puras de members.ts com o repository. A preferência de
 * workspace nunca concede acesso: só escolhe entre memberships existentes, e o
 * banco confere papel em cada RPC.
 *
 * Imports relativos com `.ts`: carregável em `node --test` (testado com cliente falso).
 */
import { errorFields, log } from "../observability/log.ts";
import {
  isMemberRole,
  isMissingSchemaObject,
  resolveActiveWorkspace,
  type MemberRole,
  type MemberRow,
  type WorkspaceMembership,
} from "./members.ts";
import {
  rpcChangeMemberRole,
  rpcEnsureWorkspace,
  rpcListWorkspaceMembers,
  rpcRemoveMember,
  rpcSetActiveWorkspace,
  selectMemberships,
  selectPreferredWorkspace,
  type SupabaseClient,
} from "./repository.ts";

export type { MemberRole, WorkspaceMembership } from "./members.ts";
export type { SupabaseClient } from "./repository.ts";

export type Workspace = {
  organizationId: string;
  role: MemberRole;
};

// ---------------------------------------------------------------------------
// Permissões por papel
// ---------------------------------------------------------------------------

/** Quem cria, edita e aprova conteúdo, mídia e calendário: owner e admin. */
export function canEditContent(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}

/** Quem cria, lista e revoga convites: owner e admin. */
export function canManageInvitations(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}

// ---------------------------------------------------------------------------
// Workspace ativo
// ---------------------------------------------------------------------------

/** Todas as memberships do usuário (sob RLS: cada um só lê as próprias), da mais antiga à mais nova. */
export async function listWorkspaces(supabase: SupabaseClient, userId: string): Promise<WorkspaceMembership[]> {
  const rows = await selectMemberships(supabase, userId);
  return rows
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
  const { organizationId, error } = await selectPreferredWorkspace(supabase, userId);
  if (error) {
    if (!isMissingSchemaObject(error)) log("warn", "tenancy.active_workspace", errorFields(error));
    return null;
  }
  return organizationId;
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
  const row = await rpcEnsureWorkspace(supabase);
  if (!row?.workspace_id) throw new Error("ensure_workspace returned no workspace");

  const { data: auth } = await supabase.auth.getUser();
  const active = auth.user ? await findWorkspace(supabase, auth.user.id) : null;
  return active ?? { organizationId: row.workspace_id, role: row.member_role as MemberRole };
}

/** Grava o workspace ativo no servidor. O banco confere a membership; o cliente só sugere o id. */
export async function setActiveWorkspace(supabase: SupabaseClient, organizationId: string): Promise<void> {
  await rpcSetActiveWorkspace(supabase, organizationId);
}

// ---------------------------------------------------------------------------
// Membros
// ---------------------------------------------------------------------------

export type MembersResult =
  | { state: "ok"; members: MemberRow[] }
  | { state: "forbidden" }
  | { state: "unavailable" };

/**
 * Membros do workspace (owner/admin), com e-mail lido no banco por public.list_workspace_members.
 * `unavailable`: a migration S5.1 ainda não foi aplicada neste ambiente.
 */
export async function listMembers(supabase: SupabaseClient, organizationId: string): Promise<MembersResult> {
  const { rows, error } = await rpcListWorkspaceMembers(supabase, organizationId);
  if (error) {
    if (isMissingSchemaObject(error)) return { state: "unavailable" };
    if (error.message?.trim() === "forbidden" || error.code === "42501") return { state: "forbidden" };
    throw error;
  }
  const members = rows
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
  return rpcChangeMemberRole(supabase, organizationId, userId, role);
}

export async function removeMember(supabase: SupabaseClient, organizationId: string, userId: string): Promise<void> {
  await rpcRemoveMember(supabase, organizationId, userId);
}
