/**
 * S14 — contratos do executor real dos agentes (Planner → Executor → Verifier).
 *
 * O executor é um loop determinístico em volta de interfaces injetadas: o modelo só propõe plano e texto,
 * o banco (via AgentStore → agent_record_step / agent_finish_run / agent_fail_run) continua sendo a
 * fronteira de confiança. Nada aqui publica ou aprova conteúdo.
 */
import type { AgentKind, AgentTool, RunStatus } from "../types.ts";

export type Phase = "plan" | "execute" | "verify";

/** Dados da execução. organizationId e grantedTools vêm do banco, nunca do modelo. */
export interface RunContext {
  runId: string;
  organizationId: string;
  agent: AgentKind;
  goal: string;
  maxSteps: number;
  grantedTools: readonly AgentTool[];
  createdBy: string;
}

export type JsonObject = Record<string, unknown>;

/** Chamada de ferramenta proposta pelo Planner. `tool` é texto livre: o executor valida. */
export interface PlannedCall {
  tool: string;
  input: JsonObject;
}

/** Afirmação do resultado final. Afirmações sobre produto exigem evidência verificada. */
export interface Claim {
  text: string;
  productId?: string;
  evidenceIds: string[];
}

/** Resultado observado de um passo do Executor (entrada do Summarizer e do Verifier). */
export interface Observation {
  seq: number | null;
  tool: string;
  status: "ok" | "error" | "rejected";
  /** Entrada enviada à ferramenta (já validada quanto ao tamanho). */
  input?: JsonObject;
  output: JsonObject;
}

export interface Summary {
  text: string;
  claims: Claim[];
}

export interface AgentModel {
  plan(input: { goal: string; agent: AgentKind; tools: readonly AgentTool[]; maxCalls: number }, signal: AbortSignal): Promise<unknown>;
  summarize(input: { goal: string; agent: AgentKind; observations: readonly Observation[] }, signal: AbortSignal): Promise<unknown>;
}

export interface StepRecord {
  runId: string;
  phase: Phase;
  tool: string | null;
  input: JsonObject;
  output: JsonObject;
  status: "ok" | "error";
  detail?: string | null;
}

/** Resultado de agent_record_step: seq null + runStatus "failed" quando o banco aplicou step_limit. */
export interface StepResult {
  seq: number | null;
  runStatus: RunStatus;
}

export interface AgentStore {
  currentStatus(runId: string): Promise<RunStatus>;
  recordStep(step: StepRecord): Promise<StepResult>;
  finish(runId: string, outcome: JsonObject): Promise<void>;
  fail(runId: string, code: ExecutorErrorCode): Promise<void>;
}

export type ToolOutput = JsonObject;
export type ToolHandler = (ctx: RunContext, input: JsonObject, signal: AbortSignal) => Promise<ToolOutput>;
export type ToolRegistry = Partial<Record<AgentTool, ToolHandler>>;

export interface VerifyResult {
  ok: boolean;
  code?: ExecutorErrorCode;
  reasons: string[];
}
export type Verifier = (ctx: RunContext, observations: readonly Observation[], summary: Summary) => VerifyResult;

export interface ExecutorLimits {
  /** Tempo máximo de cada chamada ao modelo ou ferramenta. */
  stepTimeoutMs: number;
  /** Tamanho máximo (bytes UTF-8 do JSON) de entrada/saída de passo e do outcome; igual ao banco. */
  maxPayloadBytes: number;
  /**
   * Prazo total da execução (plan + execute + verify). Estourado, a execução falha com worker_timeout em vez de
   * ser cortada pela plataforma no meio. Cada passo usa o menor entre stepTimeoutMs e o tempo restante.
   */
  maxRunMs: number;
}

export const DEFAULT_LIMITS: ExecutorLimits = { stepTimeoutMs: 20_000, maxPayloadBytes: 65_536, maxRunMs: 240_000 };

/** Códigos gravados por agent_fail_run (formato ^[a-z][a-z0-9_]{2,63}$). */
export const EXECUTOR_ERROR_CODES = [
  "model_not_configured",
  "model_error",
  "step_timeout",
  "payload_too_large",
  "invalid_plan",
  "invalid_summary",
  "tool_error",
  "verify_failed",
  "evidence_missing",
  "worker_timeout",
  "internal_error",
] as const;
export type ExecutorErrorCode = (typeof EXECUTOR_ERROR_CODES)[number];

/**
 * Resultado de runAgent:
 * - succeeded: agent_finish_run gravado;
 * - failed: agent_fail_run gravado pelo executor, ou step_limit gravado pelo banco;
 * - stopped: a execução deixou de estar ativa (kill switch, cancelamento) — o executor parou sem novas escritas.
 */
export type RunResult =
  | { status: "succeeded"; steps: number }
  | { status: "failed"; code: ExecutorErrorCode | "step_limit"; steps: number }
  | { status: "stopped"; runStatus: RunStatus | "unknown"; steps: number };
