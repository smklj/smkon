/**
 * S14 — resolução do modelo do executor.
 *
 * Etapa 6: nenhum provedor está ligado, então sempre devolve null e o worker responde model_not_configured
 * sem reservar execuções. A etapa 7 adiciona o adaptador (Vercel AI Gateway ou Anthropic) e só o ativa com
 * credencial configurada pelo Owner. Nenhuma chamada paga acontece aqui.
 */
import type { AgentModel } from "./types.ts";
import type { WorkerEnv } from "../worker/auth.ts";

export function resolveAgentModel(env: WorkerEnv): AgentModel | null {
  void env;
  return null;
}
