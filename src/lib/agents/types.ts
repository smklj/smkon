/**
 * S13 — execuções de agentes (Planner → Executor → Verifier). Espelha a migration
 * 20261119020000_agent_runs: o banco é a fonte da verdade; aqui ficam tipos, listas fechadas e rótulos.
 */

export const AGENT_KINDS = ["product_research", "content_drafting", "operations_review"] as const;
export type AgentKind = (typeof AGENT_KINDS)[number];

export const AGENT_LABEL: Record<AgentKind, string> = {
  product_research: "Pesquisa de produtos",
  content_drafting: "Rascunho de conteúdo",
  operations_review: "Revisão da operação",
};

export const AGENT_TOOLS = [
  "read_products",
  "read_product_evidence",
  "read_content",
  "read_publication_queue",
  "read_finance_summary",
  "draft_content",
] as const;
export type AgentTool = (typeof AGENT_TOOLS)[number];

export const AGENT_TOOL_LABEL: Record<AgentTool, string> = {
  read_products: "Ler produtos",
  read_product_evidence: "Ler evidências",
  read_content: "Ler conteúdos",
  read_publication_queue: "Ler fila de publicação",
  read_finance_summary: "Ler totais financeiros",
  draft_content: "Propor rascunho",
};

export const RUN_STATUSES = ["queued", "planning", "executing", "verifying", "succeeded", "failed", "cancelled", "killed"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  queued: "Na fila",
  planning: "Planejando",
  executing: "Executando",
  verifying: "Verificando",
  succeeded: "Concluída",
  failed: "Falhou",
  cancelled: "Cancelada",
  killed: "Interrompida",
};

export const RUN_STATUS_TONE: Record<RunStatus, "neutral" | "info" | "ok" | "warn" | "danger"> = {
  queued: "neutral",
  planning: "info",
  executing: "info",
  verifying: "info",
  succeeded: "ok",
  failed: "danger",
  cancelled: "neutral",
  killed: "warn",
};

export const STEP_PHASE_LABEL: Record<"plan" | "execute" | "verify", string> = {
  plan: "Planner",
  execute: "Executor",
  verify: "Verifier",
};

export const ACTIVE_STATUSES: readonly RunStatus[] = ["queued", "planning", "executing", "verifying"];

export function isAgentKind(value: string): value is AgentKind {
  return (AGENT_KINDS as readonly string[]).includes(value);
}

export function isAgentTool(value: string): value is AgentTool {
  return (AGENT_TOOLS as readonly string[]).includes(value);
}

export function isRunStatus(value: string): value is RunStatus {
  return (RUN_STATUSES as readonly string[]).includes(value);
}

export function isActive(status: RunStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/**
 * Validação dos formulários: vive em schema.ts (S4). Reexportada aqui porque
 * tests/unit/agents.test.ts importa de types.ts (testes não são editados).
 */
export { parseLimits, parseRunInput } from "./schema.ts";

export const DEFAULT_AGENT_SETTINGS = { kill_switch: false, kill_reason: null, max_runs_per_day: 20, max_steps_per_run: 12 } as const;

// ---------------------------------------------------------------------------------------------------------------
// S24 — missões (execuções recorrentes por agenda). Espelha a migration 20261124100000_agent_missions.
// ---------------------------------------------------------------------------------------------------------------

export const MISSION_SCHEDULE_KINDS = ["daily", "weekly", "interval"] as const;
export type MissionScheduleKind = (typeof MISSION_SCHEDULE_KINDS)[number];

export const MISSION_SCHEDULE_LABEL: Record<MissionScheduleKind, string> = {
  daily: "Todo dia",
  weekly: "Toda semana",
  interval: "A cada N horas",
};

/** 0 = domingo, como `extract(dow ...)` no PostgreSQL. */
export const WEEKDAY_LABEL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;

/** Teto de missões ativas (não arquivadas) por workspace, igual ao banco. */
export const MAX_ACTIVE_MISSIONS = 20;

/** Motivos que o worker registra quando uma missão vencida não vira execução. */
export const MISSION_SKIP_REASON_LABEL: Record<string, string> = {
  kill_switch: "kill switch ligado",
  previous_run_active: "a execução anterior ainda estava ativa",
  run_limit_reached: "limite de execuções em 24 h atingido",
  max_steps_above_limit: "passos acima do limite atual do workspace",
  owner_not_allowed: "o responsável deixou de ser owner ou admin; retome para assumir",
};

export function isMissionScheduleKind(value: string): value is MissionScheduleKind {
  return (MISSION_SCHEDULE_KINDS as readonly string[]).includes(value);
}

export function missionSkipReason(code: string | null): string | null {
  if (!code) return null;
  return MISSION_SKIP_REASON_LABEL[code] ?? code;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Descrição curta da agenda ("Toda segunda às 08:00", "A cada 6 h"). */
export function describeSchedule(schedule: {
  schedule_kind: string;
  run_hour: number | null;
  run_minute: number | null;
  run_weekday: number | null;
  interval_hours: number | null;
}): string {
  const time = schedule.run_hour !== null && schedule.run_minute !== null ? `${pad(schedule.run_hour)}:${pad(schedule.run_minute)}` : "";
  if (schedule.schedule_kind === "daily" && time) return `Todo dia às ${time}`;
  if (schedule.schedule_kind === "weekly" && time && schedule.run_weekday !== null) {
    const day = WEEKDAY_LABEL[schedule.run_weekday] ?? "?";
    return `${schedule.run_weekday === 0 || schedule.run_weekday === 6 ? "Todo" : "Toda"} ${day} às ${time}`;
  }
  if (schedule.schedule_kind === "interval" && schedule.interval_hours !== null) {
    return schedule.interval_hours === 1 ? "A cada hora" : `A cada ${schedule.interval_hours} h`;
  }
  return "Agenda inválida";
}
