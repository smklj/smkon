"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cancelRun, setKillSwitch, setTool, startRun, updateLimits } from "@/lib/agents/server";
import { isAgentTool, parseLimits, parseRunInput } from "@/lib/agents/types";
import { isUuid } from "@/lib/content/server";
import { dbErrorMessage } from "@/lib/http/errors";
import { errorFields, log } from "@/lib/observability/log";
import { createClient } from "@/lib/supabase/server";
import { findWorkspace, type MemberRole } from "@/lib/tenancy/workspace";

export type AgentState = { error?: string; ok?: string; at?: number } | null;

async function context(roles: MemberRole[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/agentes");
  const workspace = await findWorkspace(supabase, user.id);
  return { supabase, workspace, allowed: Boolean(workspace && roles.includes(workspace.role)) };
}

function done(ok: string): AgentState {
  revalidatePath("/agentes");
  return { ok, at: Date.now() };
}

export async function startRunAction(_prev: AgentState, formData: FormData): Promise<AgentState> {
  const { supabase, workspace, allowed } = await context(["owner", "admin"]);
  if (!allowed || !workspace) return { error: "Apenas owner ou admin iniciam execuções." };
  const limit = Number(formData.get("limit") ?? 12);
  let input: ReturnType<typeof parseRunInput>;
  try {
    input = parseRunInput(
      String(formData.get("agent") ?? ""),
      String(formData.get("goal") ?? ""),
      String(formData.get("max_steps") ?? ""),
      Number.isInteger(limit) && limit >= 3 && limit <= 50 ? limit : 12,
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Dados inválidos." };
  }
  try {
    await startRun(supabase, workspace.organizationId, input.agent, input.goal, input.maxSteps);
  } catch (error) {
    log("warn", "agents.start", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível criar a execução.") };
  }
  return done("Execução criada na fila. Ela só avança quando o executor do servidor estiver ativo.");
}

export async function cancelRunAction(_prev: AgentState, formData: FormData): Promise<AgentState> {
  const runId = String(formData.get("run_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!isUuid(runId)) return { error: "Execução inválida." };
  if (reason.length < 3) return { error: "Informe o motivo do cancelamento." };
  const { supabase, allowed } = await context(["owner", "admin"]);
  if (!allowed) return { error: "Apenas owner ou admin cancelam execuções." };
  try {
    await cancelRun(supabase, runId, reason);
  } catch (error) {
    log("warn", "agents.cancel", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível cancelar.") };
  }
  return done("Execução cancelada.");
}

export async function killSwitchAction(_prev: AgentState, formData: FormData): Promise<AgentState> {
  const on = formData.get("on") === "true";
  const reason = String(formData.get("reason") ?? "").trim();
  if (on && reason.length < 3) return { error: "Informe o motivo para ligar o kill switch." };
  const { supabase, workspace, allowed } = await context(["owner"]);
  if (!allowed || !workspace) return { error: "Apenas o owner controla o kill switch." };
  try {
    const killed = await setKillSwitch(supabase, workspace.organizationId, on, on ? reason : undefined);
    return done(on ? `Kill switch ligado. ${killed} execução(ões) ativa(s) interrompida(s).` : "Kill switch desligado.");
  } catch (error) {
    log("warn", "agents.kill_switch", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível alterar o kill switch.") };
  }
}

export async function toolAction(_prev: AgentState, formData: FormData): Promise<AgentState> {
  const tool = String(formData.get("tool") ?? "");
  const enabled = formData.get("enabled") === "true";
  if (!isAgentTool(tool)) return { error: "Ferramenta fora da allowlist." };
  const { supabase, workspace, allowed } = await context(["owner", "admin"]);
  if (!allowed || !workspace) return { error: "Apenas owner ou admin liberam ferramentas." };
  try {
    await setTool(supabase, workspace.organizationId, tool, enabled);
  } catch (error) {
    log("warn", "agents.tool", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível alterar a ferramenta.") };
  }
  return done(enabled ? "Ferramenta liberada." : "Ferramenta bloqueada.");
}

export async function limitsAction(_prev: AgentState, formData: FormData): Promise<AgentState> {
  let limits: { maxRunsPerDay: number; maxStepsPerRun: number };
  try {
    limits = parseLimits(String(formData.get("max_runs") ?? ""), String(formData.get("max_steps") ?? ""));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Limites inválidos." };
  }
  const { supabase, workspace, allowed } = await context(["owner"]);
  if (!allowed || !workspace) return { error: "Apenas o owner altera os limites." };
  try {
    await updateLimits(supabase, workspace.organizationId, limits.maxRunsPerDay, limits.maxStepsPerRun);
  } catch (error) {
    log("warn", "agents.limits", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível salvar os limites.") };
  }
  return done("Limites salvos.");
}
