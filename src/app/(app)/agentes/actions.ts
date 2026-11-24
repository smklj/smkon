"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  parseCancelForm,
  parseKillSwitchForm,
  parseLimitsForm,
  parseMissionArchiveForm,
  parseMissionForm,
  parseMissionToggleForm,
  parseRunForm,
  parseToolForm,
  type CancelInput,
  type KillSwitchInput,
  type LimitsInput,
  type MissionArchiveInput,
  type MissionInput,
  type MissionToggleInput,
  type RunInput,
  type ToolInput,
} from "@/lib/agents/schema";
import {
  addMission,
  cancelAgentRun,
  canControlAgents,
  canManageMissions,
  canManageTools,
  canOperateRuns,
  queueRun,
  retireMission,
  saveLimits,
  setToolGrant,
  switchAgents,
  toggleMission,
} from "@/lib/agents/service";
import { dbErrorMessage } from "@/lib/http/errors";
import { errorFields, log } from "@/lib/observability/log";
import { createClient } from "@/lib/supabase/server";
import { findWorkspace, type MemberRole } from "@/lib/tenancy/service";

export type AgentState = { error?: string; ok?: string; at?: number } | null;

async function context(can: (role: MemberRole) => boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/agentes");
  const workspace = await findWorkspace(supabase, user.id);
  return { supabase, workspace, allowed: Boolean(workspace && can(workspace.role)) };
}

/** Erro de validação vira a mensagem da tela, como antes (validação antes da autenticação). */
function invalid(error: unknown, fallback: string): AgentState {
  return { error: error instanceof Error ? error.message : fallback };
}

function done(ok: string): AgentState {
  // "layout" inclui o detalhe /agentes/[id], que também mostra o estado e o botão de cancelar.
  revalidatePath("/agentes", "layout");
  return { ok, at: Date.now() };
}

export async function startRunAction(_prev: AgentState, formData: FormData): Promise<AgentState> {
  const { supabase, workspace, allowed } = await context(canOperateRuns);
  if (!allowed || !workspace) return { error: "Apenas owner ou admin iniciam execuções." };
  let input: RunInput;
  try {
    input = parseRunForm(formData);
  } catch (error) {
    return invalid(error, "Dados inválidos.");
  }
  try {
    await queueRun(supabase, workspace.organizationId, input);
  } catch (error) {
    log("warn", "agents.start", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível criar a execução.") };
  }
  return done("Execução criada na fila. Ela só avança quando o executor do servidor estiver ativo.");
}

export async function cancelRunAction(_prev: AgentState, formData: FormData): Promise<AgentState> {
  let input: CancelInput;
  try {
    input = parseCancelForm(formData);
  } catch (error) {
    return invalid(error, "Execução inválida.");
  }
  const { supabase, allowed } = await context(canOperateRuns);
  if (!allowed) return { error: "Apenas owner ou admin cancelam execuções." };
  try {
    await cancelAgentRun(supabase, input);
  } catch (error) {
    log("warn", "agents.cancel", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível cancelar.") };
  }
  return done("Execução cancelada.");
}

export async function killSwitchAction(_prev: AgentState, formData: FormData): Promise<AgentState> {
  let input: KillSwitchInput;
  try {
    input = parseKillSwitchForm(formData);
  } catch (error) {
    return invalid(error, "Informe o motivo para ligar o kill switch.");
  }
  const { supabase, workspace, allowed } = await context(canControlAgents);
  if (!allowed || !workspace) return { error: "Apenas o owner controla o kill switch." };
  try {
    const killed = await switchAgents(supabase, workspace.organizationId, input);
    return done(input.on ? `Kill switch ligado. ${killed} execução(ões) ativa(s) interrompida(s).` : "Kill switch desligado.");
  } catch (error) {
    log("warn", "agents.kill_switch", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível alterar o kill switch.") };
  }
}

export async function toolAction(_prev: AgentState, formData: FormData): Promise<AgentState> {
  let input: ToolInput;
  try {
    input = parseToolForm(formData);
  } catch (error) {
    return invalid(error, "Ferramenta fora da allowlist.");
  }
  const { supabase, workspace, allowed } = await context(canManageTools);
  if (!allowed || !workspace) return { error: "Apenas owner ou admin liberam ferramentas." };
  try {
    await setToolGrant(supabase, workspace.organizationId, input);
  } catch (error) {
    log("warn", "agents.tool", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível alterar a ferramenta.") };
  }
  return done(input.enabled ? "Ferramenta liberada." : "Ferramenta bloqueada.");
}

export async function limitsAction(_prev: AgentState, formData: FormData): Promise<AgentState> {
  let limits: LimitsInput;
  try {
    limits = parseLimitsForm(formData);
  } catch (error) {
    return invalid(error, "Limites inválidos.");
  }
  const { supabase, workspace, allowed } = await context(canControlAgents);
  if (!allowed || !workspace) return { error: "Apenas o owner altera os limites." };
  try {
    await saveLimits(supabase, workspace.organizationId, limits);
  } catch (error) {
    log("warn", "agents.limits", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível salvar os limites.") };
  }
  return done("Limites salvos.");
}

// ---------------------------------------------------------------------------------------------------------------
// S24 — missões
// ---------------------------------------------------------------------------------------------------------------

export async function createMissionAction(_prev: AgentState, formData: FormData): Promise<AgentState> {
  let input: MissionInput;
  try {
    input = parseMissionForm(formData);
  } catch (error) {
    return invalid(error, "Dados inválidos.");
  }
  const { supabase, workspace, allowed } = await context(canManageMissions);
  if (!allowed || !workspace) return { error: "Apenas owner ou admin criam missões." };
  try {
    await addMission(supabase, workspace.organizationId, input);
  } catch (error) {
    log("warn", "agents.mission.create", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível criar a missão.") };
  }
  return done("Missão criada. Na próxima hora agendada, o worker coloca uma execução na fila.");
}

export async function toggleMissionAction(_prev: AgentState, formData: FormData): Promise<AgentState> {
  let input: MissionToggleInput;
  try {
    input = parseMissionToggleForm(formData);
  } catch (error) {
    return invalid(error, "Missão inválida.");
  }
  const { supabase, allowed } = await context(canManageMissions);
  if (!allowed) return { error: "Apenas owner ou admin pausam ou retomam missões." };
  try {
    await toggleMission(supabase, input);
  } catch (error) {
    log("warn", "agents.mission.toggle", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível alterar a missão.") };
  }
  return done(input.enabled ? "Missão retomada. Você passa a ser o responsável por ela." : "Missão pausada.");
}

export async function archiveMissionAction(_prev: AgentState, formData: FormData): Promise<AgentState> {
  let input: MissionArchiveInput;
  try {
    input = parseMissionArchiveForm(formData);
  } catch (error) {
    return invalid(error, "Missão inválida.");
  }
  const { supabase, allowed } = await context(canManageMissions);
  if (!allowed) return { error: "Apenas owner ou admin arquivam missões." };
  try {
    await retireMission(supabase, input);
  } catch (error) {
    log("warn", "agents.mission.archive", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível arquivar a missão.") };
  }
  return done("Missão arquivada. As execuções que ela criou continuam no histórico.");
}
