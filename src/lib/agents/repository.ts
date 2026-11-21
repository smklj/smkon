/**
 * Agentes · repository: acesso a dados (S4; antes server.ts, sem mudança de consulta).
 * Leituras sob RLS com filtro explícito por `organization_id`; escritas só por RPC
 * (agent_start_run, agent_cancel_run, agent_set_kill_switch, agent_set_tool,
 * agent_update_limits), que conferem papel, kill switch e limites no banco.
 * O executor/worker usa a sua própria interface (executor/rpc.ts), não este arquivo.
 *
 * Imports relativos com `.ts` e cliente só como tipo: carregável em `node --test`.
 */
import { applyKeyset, decodeCursor, toPage } from "../pagination/keyset.ts";
import type { createClient } from "../supabase/server.ts";
import { isMissingSchemaObject } from "../tenancy/members.ts";
import type { UsageRow } from "./detail.ts";
import { AGENT_RUNS_KEYSET, AGENT_RUNS_PAGE_SIZE } from "./runs-page.ts";
import {
  DEFAULT_AGENT_SETTINGS,
  isAgentTool,
  isRunStatus,
  type AgentKind,
  type AgentTool,
  type RunStatus,
} from "./types.ts";

export type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

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
  /** Cursor da próxima página de execuções (S16); null = não há mais. */
  nextCursor: string | null;
  runsLast24h: number;
};

export type LoadAgentsOptions = { cursor?: string | null; pageSize?: number };

/**
 * Estado de agentes do workspace (sob RLS: qualquer membro lê).
 * Cursor inválido → InvalidCursorError (a página volta ao início com aviso).
 */
export async function loadAgents(
  supabase: SupabaseClient,
  organizationId: string,
  { cursor = null, pageSize = AGENT_RUNS_PAGE_SIZE }: LoadAgentsOptions = {},
): Promise<AgentOverview> {
  const after = decodeCursor(AGENT_RUNS_KEYSET, cursor);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [settings, grants, runs, recent] = await Promise.all([
    supabase
      .from("agent_settings")
      .select("kill_switch,kill_reason,kill_changed_at,max_runs_per_day,max_steps_per_run")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase.from("agent_tool_grants").select("tool").eq("organization_id", organizationId),
    applyKeyset(
      supabase
        .from("agent_runs")
        .select("id,agent,goal,status,max_steps,step_count,created_at,finished_at,error_code,cancel_reason")
        .eq("organization_id", organizationId),
      AGENT_RUNS_KEYSET,
      after,
      pageSize,
    ),
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

  const page = toPage(AGENT_RUNS_KEYSET, runs.data ?? [], pageSize);
  const runRows = page.items;
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
    nextCursor: page.nextCursor,
    runsLast24h: recent.count ?? 0,
  };
}

export type AgentStepDetail = AgentStep & { input: unknown; output: unknown };

export type AgentRunDetail = Omit<AgentRun, "steps"> & {
  started_at: string | null;
  outcome: unknown;
  steps: AgentStepDetail[];
  /** unavailable = migration 20261119060000 (agent_model_usage) ainda não aplicada neste banco. */
  usage: { state: "ok"; rows: UsageRow[] } | { state: "unavailable" };
};

/**
 * Detalhe de uma execução (sob RLS: qualquer membro lê). Filtra pelo workspace do usuário além da RLS,
 * para que um id de outro workspace nunca apareça mesmo com a política mudando. null = não encontrada.
 */
export async function loadRunDetail(supabase: SupabaseClient, organizationId: string, runId: string): Promise<AgentRunDetail | null> {
  const run = await supabase
    .from("agent_runs")
    .select("id,agent,goal,status,max_steps,step_count,created_at,started_at,finished_at,outcome,error_code,cancel_reason")
    .eq("organization_id", organizationId)
    .eq("id", runId)
    .maybeSingle();
  if (run.error) throw run.error;
  if (!run.data) return null;

  const [steps, usage] = await Promise.all([
    supabase
      .from("agent_steps")
      .select("seq,phase,tool,status,detail,created_at,input,output")
      .eq("organization_id", organizationId)
      .eq("run_id", runId)
      .order("seq", { ascending: true })
      .limit(100),
    supabase
      .from("agent_model_usage")
      .select("phase,model,input_tokens,output_tokens,cost_usd,created_at")
      .eq("organization_id", organizationId)
      .eq("run_id", runId)
      .order("created_at", { ascending: true })
      .limit(200),
  ]);
  if (steps.error) throw steps.error;
  if (usage.error && !isMissingSchemaObject(usage.error)) throw usage.error;

  const { status, ...rest } = run.data;
  return {
    ...rest,
    status: isRunStatus(status) ? status : "failed",
    steps: (steps.data ?? []).map((row) => ({
      seq: row.seq,
      phase: row.phase as AgentStep["phase"],
      tool: row.tool,
      status: row.status as AgentStep["status"],
      detail: row.detail,
      created_at: row.created_at,
      input: row.input,
      output: row.output,
    })),
    usage: usage.error
      ? { state: "unavailable" }
      : {
          state: "ok",
          rows: (usage.data ?? []).map((row) => ({
            phase: row.phase === "verify" ? "verify" : "plan",
            model: row.model,
            input_tokens: row.input_tokens,
            output_tokens: row.output_tokens,
            cost_usd: row.cost_usd,
            created_at: row.created_at,
          })),
        },
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
