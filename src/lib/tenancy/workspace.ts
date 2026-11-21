/**
 * Fachada de compatibilidade (S4, etapa 2e).
 *
 * O domínio de tenancy agora vive em schema.ts / repository.ts / service.ts.
 * Este arquivo só reexporta o service para os chamadores de módulos que ainda
 * não passaram pela etapa do S4 (agentes) ou que pertencem a outra
 * frente (integração Mercado Livre). Código novo importa de `@/lib/tenancy/service`.
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
