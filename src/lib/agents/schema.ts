/**
 * Agentes · schema: tipos de entrada e validação dos formulários (S4).
 * Funções puras que lançam ValidationError (subclasse de Error) com mensagem
 * segura para a tela, sobre as primitivas de src/lib/validation/fields.ts.
 * Imports relativos com `.ts` para rodar em `node --test`.
 *
 * As mensagens e as faixas são as mesmas de antes (faixas = constraints do banco).
 */
import { ValidationError } from "../http/errors.ts";
import { isUuid } from "../validation/fields.ts";
import { isAgentKind, isAgentTool, isMissionScheduleKind, type AgentKind, type AgentTool } from "./types.ts";

export type RunInput = { agent: AgentKind; goal: string; maxSteps: number };
export type LimitsInput = { maxRunsPerDay: number; maxStepsPerRun: number };
export type CancelInput = { runId: string; reason: string };
export type KillSwitchInput = { on: boolean; reason: string };
export type ToolInput = { tool: AgentTool; enabled: boolean };

/** Teto de passos usado quando o formulário não traz um limite válido (padrão do banco). */
export const DEFAULT_STEP_LIMIT = 12;

/** Valida o formulário de nova execução. */
export function parseRunInput(agent: string, goal: string, maxSteps: string, limit: number): RunInput {
  if (!isAgentKind(agent)) throw new ValidationError("Escolha um agente da lista.");
  const trimmed = goal.trim();
  if (trimmed.length < 3 || trimmed.length > 2000) throw new ValidationError("Descreva o objetivo em 3 a 2000 caracteres.");
  const steps = Number(maxSteps);
  if (!Number.isInteger(steps) || steps < 3 || steps > limit) throw new ValidationError(`Passos por execução: de 3 a ${limit}.`);
  return { agent, goal: trimmed, maxSteps: steps };
}

/** Valida os limites do workspace (mesmas faixas das constraints do banco). */
export function parseLimits(maxRuns: string, maxSteps: string): LimitsInput {
  const runs = Number(maxRuns);
  const steps = Number(maxSteps);
  if (!Number.isInteger(runs) || runs < 1 || runs > 500) throw new ValidationError("Execuções por dia: de 1 a 500.");
  if (!Number.isInteger(steps) || steps < 3 || steps > 50) throw new ValidationError("Passos por execução: de 3 a 50.");
  return { maxRunsPerDay: runs, maxStepsPerRun: steps };
}

/**
 * Teto de passos enviado pelo formulário (campo oculto `limit`, o limite do workspace).
 * Fora de 3–50 ou não inteiro → padrão de 12. Ausente → 12.
 */
export function stepLimitFromForm(value: FormDataEntryValue | null): number {
  const limit = Number(value ?? DEFAULT_STEP_LIMIT);
  return Number.isInteger(limit) && limit >= 3 && limit <= 50 ? limit : DEFAULT_STEP_LIMIT;
}

/** Formulário de nova execução: agente, objetivo e passos, com o teto do workspace. */
export function parseRunForm(formData: FormData): RunInput {
  return parseRunInput(
    String(formData.get("agent") ?? ""),
    String(formData.get("goal") ?? ""),
    String(formData.get("max_steps") ?? ""),
    stepLimitFromForm(formData.get("limit")),
  );
}

/** Formulário de limites do workspace. */
export function parseLimitsForm(formData: FormData): LimitsInput {
  return parseLimits(String(formData.get("max_runs") ?? ""), String(formData.get("max_steps") ?? ""));
}

/** Cancelamento: id da execução (UUID estrito, como antes) e motivo com 3+ caracteres. */
export function parseCancelForm(formData: FormData): CancelInput {
  const runId = String(formData.get("run_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!isUuid(runId)) throw new ValidationError("Execução inválida.");
  if (reason.length < 3) throw new ValidationError("Informe o motivo do cancelamento.");
  return { runId, reason };
}

/** Kill switch: ligar exige motivo com 3+ caracteres; desligar não exige. */
export function parseKillSwitchForm(formData: FormData): KillSwitchInput {
  const on = formData.get("on") === "true";
  const reason = String(formData.get("reason") ?? "").trim();
  if (on && reason.length < 3) throw new ValidationError("Informe o motivo para ligar o kill switch.");
  return { on, reason };
}

/** Liberação de ferramenta: só a allowlist fechada. */
export function parseToolForm(formData: FormData): ToolInput {
  const tool = String(formData.get("tool") ?? "");
  const enabled = formData.get("enabled") === "true";
  if (!isAgentTool(tool)) throw new ValidationError("Ferramenta fora da allowlist.");
  return { tool, enabled };
}

// ---------------------------------------------------------------------------------------------------------------
// S24 — missões
// ---------------------------------------------------------------------------------------------------------------

export type MissionSchedule =
  | { kind: "daily"; hour: number; minute: number }
  | { kind: "weekly"; weekday: number; hour: number; minute: number }
  | { kind: "interval"; hours: number };

export type MissionInput = { name: string; agent: AgentKind; goal: string; maxSteps: number; schedule: MissionSchedule };
export type MissionToggleInput = { missionId: string; enabled: boolean };
export type MissionArchiveInput = { missionId: string };

/** "HH:MM" (input type=time) → hora e minuto. */
function parseTime(value: string): { hour: number; minute: number } {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  const hour = match ? Number(match[1]) : Number.NaN;
  const minute = match ? Number(match[2]) : Number.NaN;
  if (!match || hour > 23 || minute > 59) throw new ValidationError("Informe o horário no formato HH:MM.");
  return { hour, minute };
}

/** Valida a agenda: só os campos do tipo escolhido são lidos (os demais são descartados). */
export function parseMissionSchedule(kind: string, time: string, weekday: string, intervalHours: string): MissionSchedule {
  if (!isMissionScheduleKind(kind)) throw new ValidationError("Escolha a frequência da missão.");
  if (kind === "interval") {
    const hours = Number(intervalHours);
    if (!Number.isInteger(hours) || hours < 1 || hours > 168) throw new ValidationError("Intervalo: de 1 a 168 horas.");
    return { kind, hours };
  }
  const { hour, minute } = parseTime(time);
  if (kind === "daily") return { kind, hour, minute };
  const day = Number(weekday);
  if (weekday.trim() === "" || !Number.isInteger(day) || day < 0 || day > 6) throw new ValidationError("Escolha o dia da semana.");
  return { kind, weekday: day, hour, minute };
}

/** Formulário de nova missão: nome, agente, objetivo, passos (até o teto do workspace) e agenda. */
export function parseMissionForm(formData: FormData): MissionInput {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 3 || name.length > 120) throw new ValidationError("Dê um nome de 3 a 120 caracteres à missão.");
  const run = parseRunInput(
    String(formData.get("agent") ?? ""),
    String(formData.get("goal") ?? ""),
    String(formData.get("max_steps") ?? ""),
    stepLimitFromForm(formData.get("limit")),
  );
  const schedule = parseMissionSchedule(
    String(formData.get("schedule_kind") ?? ""),
    String(formData.get("time") ?? ""),
    String(formData.get("weekday") ?? ""),
    String(formData.get("interval_hours") ?? ""),
  );
  return { name, ...run, schedule };
}

/** Pausar/retomar: id (UUID estrito) e o estado desejado. */
export function parseMissionToggleForm(formData: FormData): MissionToggleInput {
  const missionId = String(formData.get("mission_id") ?? "");
  if (!isUuid(missionId)) throw new ValidationError("Missão inválida.");
  return { missionId, enabled: formData.get("enabled") === "true" };
}

/** Arquivar: id (UUID estrito). */
export function parseMissionArchiveForm(formData: FormData): MissionArchiveInput {
  const missionId = String(formData.get("mission_id") ?? "");
  if (!isUuid(missionId)) throw new ValidationError("Missão inválida.");
  return { missionId };
}
