/**
 * Rotas de máquina: autenticadas pela própria rota (segredo em tempo constante), não por sessão de usuário.
 * O proxy não lê nem renova cookies nelas.
 * - Worker dos agentes (S14): /api/agents/worker
 * - Webhooks externos (S18+): /api/webhooks/*
 */
const MACHINE_API_PATHS = new Set(["/api/agents/worker"]);

export function isMachineRoute(pathname: string): boolean {
  return MACHINE_API_PATHS.has(pathname) || pathname.startsWith("/api/webhooks/");
}
