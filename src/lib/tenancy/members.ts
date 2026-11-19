/**
 * Regras puras de membership (sem React, sem Supabase): testáveis com node:test.
 * A autorização de verdade fica no banco (RLS e funções security definer);
 * aqui só decidimos o que a interface oferece e qual workspace está ativo.
 */

export type MemberRole = "owner" | "admin" | "analyst" | "viewer";

export const MEMBER_ROLES: readonly MemberRole[] = ["owner", "admin", "analyst", "viewer"];

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  analyst: "Analista",
  viewer: "Leitura",
};

export function isMemberRole(value: unknown): value is MemberRole {
  return typeof value === "string" && (MEMBER_ROLES as readonly string[]).includes(value);
}

export type WorkspaceMembership = {
  organizationId: string;
  role: MemberRole;
  name: string;
  joinedAt: string;
};

/**
 * Workspace ativo: a preferência salva no servidor, se o usuário ainda for membro;
 * senão, a membership mais antiga (comportamento anterior ao seletor).
 * A preferência nunca concede acesso: só escolhe entre memberships existentes.
 */
export function resolveActiveWorkspace(
  memberships: readonly WorkspaceMembership[],
  preferredId: string | null,
): WorkspaceMembership | null {
  if (memberships.length === 0) return null;
  if (preferredId) {
    const preferred = memberships.find((item) => item.organizationId === preferredId);
    if (preferred) return preferred;
  }
  return [...memberships].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0];
}

/** Quem vê a lista de membros (e-mails): owner e admin. */
export function canViewMembers(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}

/** Quem altera papéis e remove membros: somente owner. */
export function canManageMembers(role: MemberRole): boolean {
  return role === "owner";
}

export type MemberRow = { userId: string; email: string | null; role: MemberRole; joinedAt: string };

/**
 * Controles oferecidos para uma linha. O banco aplica as mesmas regras (e mais:
 * serialização e contagem atual de owners); isto só evita botões que falhariam.
 */
export function memberControls(
  viewerRole: MemberRole,
  member: MemberRow,
  ownerCount: number,
): { canChangeRole: boolean; canRemove: boolean } {
  if (!canManageMembers(viewerRole)) return { canChangeRole: false, canRemove: false };
  const lastOwner = member.role === "owner" && ownerCount <= 1;
  return { canChangeRole: !lastOwner, canRemove: !lastOwner };
}

/**
 * Objeto do banco ainda não existe (código publicado antes da migration).
 * PostgREST: PGRST202 (função) e PGRST205 (tabela); Postgres direto: 42883 e 42P01.
 */
export function isMissingSchemaObject(error: { code?: string } | null | undefined): boolean {
  const code = error?.code;
  return code === "PGRST202" || code === "PGRST205" || code === "42883" || code === "42P01";
}
