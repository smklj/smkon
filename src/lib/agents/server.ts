import type { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_AGENT_SETTINGS,
  isAgentTool,
  isRunStatus,
  type AgentKind,
  type AgentTool,
  type RunStatus,
} from "./types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type AgentSettings = {
  kill_switch: boolean;
  kill_reason: string | null;
  kill_changed_at: string | null;
  max_runs_per_day: number;
  max_steps_per_run: number;
};

export type AgentStep = {
  seq: number;
  phase: "plan" | "execute" | "verify";
  tool: string | null;
  status: "ok" | "error" | "rejected";
  detail: string | null;
  created_at: string;
};

export type AgentRun = {
  id: string;
  agent: string;
  goal: string;
  status: RunStatus;
  max_steps: number;
  step_count: number;
  created_at: string;
  finished_at: string | null;
  error_code: string | null;
  cancel_reason: string | null;
  steps: AgentStep[];
};

export type AgentOverview = {
  settings: AgentSettings;
  grants: AgentTool[];
  runs: AgentRun[];
  runsLast24h: number;
};

/** Estado de agentes do workspace (sob RLS: qualquer membro lê). */
export async function loadAgents(supabase: SupabaseClient, organizationId: string): Promise<AgentOverview> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [settings, grants, runs, recent] = await Promise.all([
    supabase
      .from("agent_settings")
      .select("kill_switch,kill_reason,kill_changed_at,max_runs_per_day,max_steps_per_run")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase.from("agent_tool_grants").select("tool").eq("organization_id", organizationId),
    supabase
      .from("agent_runs")
      .select("id,agent,goal,status,max_steps,step_count,created_at,finished_at,error_code,cancel_reason")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("agent_runs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gt("created_at", since),
  ]);
  if (settings.error) throw settings.error;
  if (grants.error) throw grants.error;
  if (runs.error) throw runs.error;
  if (recent.error) throw recent.error;

  const runRows = runs.data ?? [];
  const steps = new Map<string, AgentStep[]>();
  if (runRows.length) {
    const stepRows = await supabase
      .from("agent_steps")
      .select("run_id,seq,phase,tool,status,detail,created_at")
      .in("run_id", runRows.map((row) => row.id))
      .order("seq", { ascending: true })
      .limit(1000);
    if (stepRows.error) throw stepRows.error;
    for (const row of stepRows.data ?? []) {
      const list = steps.get(row.run_id) ?? [];
      list.push({
        seq: row.seq,
        phase: row.phase as AgentStep["phase"],
        tool: row.tool,
        status: row.status as AgentStep["status"],
        detail: row.detail,
        created_at: row.created_at,
      });
      steps.set(row.run_id, list);
    }
  }

  return {
    settings: settings.data ?? { ...DEFAULT_AGENT_SETTINGS, kill_changed_at: null },
    grants: (grants.data ?? []).map((row) => row.tool).filter(isAgentTool),
    runs: runRows.map((row) => ({
      ...row,
      status: isRunStatus(row.status) ? row.status : "failed",
      steps: steps.get(row.id) ?? [],
    })),
    runsLast24h: recent.count ?? 0,
  };
}

export async function startRun(supabase: SupabaseClient, organizationId: string, agent: AgentKind, goal: string, maxSteps: number) {
  const { data, error } = await supabase.rpc("agent_start_run", {
    p_organization_id: organizationId,
    p_agent: agent,
    p_goal: goal,
    p_max_steps: maxSteps,
  });
  if (error) throw error;
  return data;
}

export async function cancelRun(supabase: SupabaseClient, runId: string, reason: string) {
  const { error } = await supabase.rpc("agent_cancel_run", { p_run_id: runId, p_reason: reason });
  if (error) throw error;
}

export async function setKillSwitch(supabase: SupabaseClient, organizationId: string, on: boolean, reason?: string) {
  const { data, error } = await supabase.rpc("agent_set_kill_switch", {
    p_organization_id: organizationId,
    p_on: on,
    ...(reason ? { p_reason: reason } : {}),
  });
  if (error) throw error;
  return data ?? 0;
}

export async function setTool(supabase: SupabaseClient, organizationId: string, tool: AgentTool, enabled: boolean) {
  const { error } = await supabase.rpc("agent_set_tool", { p_organization_id: organizationId, p_tool: tool, p_enabled: enabled });
  if (error) throw error;
}

export async function updateLimits(supabase: SupabaseClient, organizationId: string, maxRunsPerDay: number, maxStepsPerRun: number) {
  const { error } = await supabase.rpc("agent_update_limits", {
    p_organization_id: organizationId,
    p_max_runs_per_day: maxRunsPerDay,
    p_max_steps_per_run: maxStepsPerRun,
  });
  if (error) throw error;
}
