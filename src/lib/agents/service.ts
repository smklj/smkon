/**
 * Agentes · service: permissões por papel e casos de uso (S4).
 * Combina schema (validação) e repository (dados). As Server Actions chamam o
 * service; cada uma mantém a sua mensagem de permissão.
 *
 * Regras permanentes: Planner → Executor → Verifier no servidor; nenhum agente
 * publica (a ferramenta `draft_content` só propõe rascunho, que exige aprovação
 * humana da versão exata). Papel, kill switch e limites são conferidos de novo
 * no banco pelas RPCs; as checagens daqui só evitam a ida ao banco e dão a
 * mensagem certa na tela.
 *
 * Imports relativos com `.ts`: carregável em `node --test`.
 */
import type { MemberRole } from "../tenancy/members.ts";
import {
  cancelRun,
  loadAgents,
  loadRunDetail,
  setKillSwitch,
  setTool,
  startRun,
  updateLimits,
  type SupabaseClient,
} from "./repository.ts";
import type { CancelInput, KillSwitchInput, LimitsInput, RunInput, ToolInput } from "./schema.ts";

export type {
  AgentOverview,
  AgentRun,
  AgentRunDetail,
  AgentSettings,
  AgentStep,
  AgentStepDetail,
  LoadAgentsOptions,
  SupabaseClient,
} from "./repository.ts";
export { loadAgents, loadRunDetail };

/** Iniciar e cancelar execuções, liberar ferramentas: owner ou admin. */
export const RUN_OPERATOR_ROLES: readonly MemberRole[] = ["owner", "admin"];
/** Kill switch e limites do workspace: só owner. */
export const AGENT_OWNER_ROLES: readonly MemberRole[] = ["owner"];

export function canOperateRuns(role: MemberRole): boolean {
  return RUN_OPERATOR_ROLES.includes(role);
}

export function canManageTools(role: MemberRole): boolean {
  return RUN_OPERATOR_ROLES.includes(role);
}

export function canControlAgents(role: MemberRole): boolean {
  return AGENT_OWNER_ROLES.includes(role);
}

/** Cria a execução na fila (o executor do servidor é quem avança). */
export async function queueRun(supabase: SupabaseClient, organizationId: string, input: RunInput) {
  return startRun(supabase, organizationId, input.agent, input.goal, input.maxSteps);
}

/** Cancela uma execução ativa (a RPC confere o workspace e o papel). */
export async function cancelAgentRun(supabase: SupabaseClient, input: CancelInput): Promise<void> {
  await cancelRun(supabase, input.runId, input.reason);
}

/** Liga ou desliga o kill switch; devolve quantas execuções ativas foram interrompidas. */
export async function switchAgents(supabase: SupabaseClient, organizationId: string, input: KillSwitchInput): Promise<number> {
  return setKillSwitch(supabase, organizationId, input.on, input.on ? input.reason : undefined);
}

/** Libera ou bloqueia uma ferramenta da allowlist para o workspace. */
export async function setToolGrant(supabase: SupabaseClient, organizationId: string, input: ToolInput): Promise<void> {
  await setTool(supabase, organizationId, input.tool, input.enabled);
}

/** Salva os limites diários e de passos do workspace. */
export async function saveLimits(supabase: SupabaseClient, organizationId: string, input: LimitsInput): Promise<void> {
  await updateLimits(supabase, organizationId, input.maxRunsPerDay, input.maxStepsPerRun);
}
