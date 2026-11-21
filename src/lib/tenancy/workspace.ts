/**
 * Fachada de compatibilidade (S4, etapa 2e).
 *
 * O domínio de tenancy agora vive em schema.ts / repository.ts / service.ts.
 * Este arquivo só reexporta o service para chamadores de outra frente
 * (integração Mercado Livre); todos os módulos do S4 já importam do service.
 * Código novo importa de `@/lib/tenancy/service`.
 */
export {
  canEditContent,
  ensureWorkspace,
  findWorkspace,
  listWorkspaces,
  loadWorkspaceContext,
  type MemberRole,
  type Workspace,
  type WorkspaceContext,
  type WorkspaceMembership,
} from "./service";
