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
  archiveMission,
  cancelRun,
  createMission,
  loadAgents,
  loadMissions,
  loadRunDetail,
  setKillSwitch,
  setMissionEnabled,
  setTool,
  startRun,
  updateLimits,
  type SupabaseClient,
} from "./repository.ts";
import type {
  CancelInput,
  KillSwitchInput,
  LimitsInput,
  MissionArchiveInput,
  MissionInput,
  MissionToggleInput,
  RunInput,
  ToolInput,
} from "./schema.ts";
import type { MissionRpcArgs } from "./repository.ts";

export type {
  AgentMission,
  AgentOverview,
  AgentRun,
  AgentRunDetail,
  AgentSettings,
  AgentStep,
  AgentStepDetail,
  LoadAgentsOptions,
  MissionList,
  SupabaseClient,
} from "./repository.ts";
export { loadAgents, loadMissions, loadRunDetail };

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

/** Fuso das agendas de missão: o mesmo do calendário editorial (WORKSPACE_TIMEZONE). */
export const MISSION_TIMEZONE = "America/Sao_Paulo";

/** Missões: criar, pausar, retomar e arquivar são de owner ou admin (como iniciar execuções). */
export function canManageMissions(role: MemberRole): boolean {
  return RUN_OPERATOR_ROLES.includes(role);
}

/** Argumentos da RPC: só os campos da agenda escolhida vão ao banco. */
export function missionRpcArgs(organizationId: string, input: MissionInput): MissionRpcArgs {
  const base = {
    p_organization_id: organizationId,
    p_name: input.name,
    p_agent: input.agent,
    p_goal: input.goal,
    p_max_steps: input.maxSteps,
    p_schedule_kind: input.schedule.kind,
    p_timezone: MISSION_TIMEZONE,
  };
  switch (input.schedule.kind) {
    case "daily":
      return { ...base, p_run_hour: input.schedule.hour, p_run_minute: input.schedule.minute };
    case "weekly":
      return { ...base, p_run_hour: input.schedule.hour, p_run_minute: input.schedule.minute, p_run_weekday: input.schedule.weekday };
    case "interval":
      return { ...base, p_interval_hours: input.schedule.hours };
  }
}

/** Cria a missão (a RPC confere papel, limite de passos, teto de missões e calcula a próxima execução). */
export async function addMission(supabase: SupabaseClient, organizationId: string, input: MissionInput): Promise<string> {
  return createMission(supabase, missionRpcArgs(organizationId, input));
}

/** Pausa ou retoma; devolve a próxima execução (null ao pausar). */
export async function toggleMission(supabase: SupabaseClient, input: MissionToggleInput): Promise<string | null> {
  return setMissionEnabled(supabase, input.missionId, input.enabled);
}

/** Arquiva (sai da lista, fica no histórico e na auditoria). */
export async function retireMission(supabase: SupabaseClient, input: MissionArchiveInput): Promise<void> {
  await archiveMission(supabase, input.missionId);
}
