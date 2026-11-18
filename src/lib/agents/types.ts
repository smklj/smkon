/**
 * S13 — execuções de agentes (Planner → Executor → Verifier). Espelha a migration
 * 20261119020000_agent_runs: o banco é a fonte da verdade; aqui ficam rótulos e validação de formulário.
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

/** Valida o formulário de nova execução. Lança Error com mensagem segura para a tela. */
export function parseRunInput(agent: string, goal: string, maxSteps: string, limit: number): { agent: AgentKind; goal: string; maxSteps: number } {
  if (!isAgentKind(agent)) throw new Error("Escolha um agente da lista.");
  const trimmed = goal.trim();
  if (trimmed.length < 3 || trimmed.length > 2000) throw new Error("Descreva o objetivo em 3 a 2000 caracteres.");
  const steps = Number(maxSteps);
  if (!Number.isInteger(steps) || steps < 3 || steps > limit) throw new Error(`Passos por execução: de 3 a ${limit}.`);
  return { agent, goal: trimmed, maxSteps: steps };
}

/** Valida os limites do workspace (mesmas faixas das constraints do banco). */
export function parseLimits(maxRuns: string, maxSteps: string): { maxRunsPerDay: number; maxStepsPerRun: number } {
  const runs = Number(maxRuns);
  const steps = Number(maxSteps);
  if (!Number.isInteger(runs) || runs < 1 || runs > 500) throw new Error("Execuções por dia: de 1 a 500.");
  if (!Number.isInteger(steps) || steps < 3 || steps > 50) throw new Error("Passos por execução: de 3 a 50.");
  return { maxRunsPerDay: runs, maxStepsPerRun: steps };
}

export const DEFAULT_AGENT_SETTINGS = { kill_switch: false, kill_reason: null, max_runs_per_day: 20, max_steps_per_run: 12 } as const;
