/**
 * S14 etapa 8 — apresentação do detalhe de uma execução de agente (/agentes/[id]).
 * Funções puras: resumo de entrada/saída dos passos, motivo de falha legível e consumo do modelo
 * (agent_model_usage, migration 20261119060000). Nada aqui escreve no banco nem permite publicar.
 */

/**
 * Motivos legíveis para os códigos gravados em agent_runs.error_code e agent_steps.detail.
 * Origem: executor (EXECUTOR_ERROR_CODES), banco (agent_record_step, fila, kill switch) e ferramentas.
 */
export const FAILURE_REASON: Readonly<Record<string, string>> = {
  model_not_configured: "O modelo de IA não está configurado neste ambiente; nenhuma chamada foi feita.",
  model_error: "O provedor do modelo de IA respondeu com erro ou ficou indisponível.",
  step_timeout: "Um passo passou do tempo máximo permitido e foi interrompido.",
  worker_timeout: "A execução passou do prazo total do executor e foi encerrada.",
  payload_too_large: "A entrada ou a saída de um passo passou do limite de 64 KB.",
  invalid_plan: "O plano devolvido pelo modelo não seguiu o formato exigido ou usou ferramenta não liberada.",
  invalid_summary: "O resumo final do modelo não seguiu o formato exigido.",
  tool_error: "Uma ferramenta falhou ao ler ou gravar dados.",
  verify_failed: "O Verifier reprovou o resultado: ele não cumpriu as regras de verificação.",
  evidence_missing: "O resultado afirmava algo sobre produto sem evidência verificada do mesmo workspace.",
  internal_error: "Erro interno do executor. Os detalhes técnicos ficam no log do servidor.",
  step_limit: "A execução atingiu o limite de passos definido para ela.",
  kill_switch: "O kill switch do workspace foi ligado e interrompeu a execução.",
  run_owner_not_allowed: "Quem criou a execução não tem mais permissão no workspace.",
  draft_failed: "O rascunho proposto não pôde ser gravado.",
  run_not_active: "A execução já não estava ativa (cancelada, interrompida ou encerrada).",
  unknown_tool: "O plano pediu uma ferramenta que não existe na allowlist.",
  forbidden: "Operação não permitida para este workspace.",
};

const CODE_PATTERN = /^[a-z][a-z0-9_]{2,63}$/;

/** Motivo legível de um código de falha. Código desconhecido não é escondido: aparece entre parênteses. */
export function failureReason(code: string | null | undefined): string | null {
  if (!code) return null;
  const known = FAILURE_REASON[code];
  if (known) return known;
  return CODE_PATTERN.test(code) ? `Falha registrada pelo executor (${code}).` : "Falha registrada pelo executor.";
}

/** `detail` de passo: se for um código conhecido, devolve o motivo legível; senão, o texto como está. */
export function stepDetailText(detail: string | null | undefined): string | null {
  if (!detail) return null;
  const trimmed = detail.trim();
  if (!trimmed) return null;
  return FAILURE_REASON[trimmed] ?? trimmed;
}

const MAX_DEPTH = 2;

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, Math.max(0, max - 1))}…` : clean;
}

function preview(value: unknown, depth: number, maxItems: number): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value.length ? `"${truncate(value, 80)}"` : '""';
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (depth >= MAX_DEPTH) return `${value.length} ${value.length === 1 ? "item" : "itens"}`;
    const shown = value.slice(0, maxItems).map((item) => preview(item, depth + 1, maxItems));
    const rest = value.length - shown.length;
    return `${value.length} ${value.length === 1 ? "item" : "itens"}: [${shown.join(", ")}${rest > 0 ? `, +${rest}` : ""}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    if (depth >= MAX_DEPTH) return `{${entries.length} campo${entries.length === 1 ? "" : "s"}}`;
    const shown = entries.slice(0, maxItems).map(([key, item]) => `${key}: ${preview(item, depth + 1, maxItems)}`);
    const rest = entries.length - shown.length;
    return `${depth === 0 ? "" : "{"}${shown.join(" · ")}${rest > 0 ? ` · +${rest} campo${rest === 1 ? "" : "s"}` : ""}${depth === 0 ? "" : "}"}`;
  }
  return "—";
}

/**
 * Resumo de uma entrada/saída JSON de passo em uma linha: campos de primeiro nível, listas viram contagem
 * com os primeiros itens, profundidade limitada. Nunca lança; vazio vira "—".
 */
export function summarizePayload(value: unknown, maxChars = 280, maxItems = 4): string {
  let text: string;
  try {
    text = preview(value, 0, maxItems);
  } catch {
    return "—";
  }
  if (text === "{}" || text === "[]") return "—";
  return truncate(text, maxChars);
}

/** JSON formatado para a área "ver completo", cortado para não pesar na página. */
export function prettyPayload(value: unknown, maxChars = 8000): { text: string; truncated: boolean } {
  let text: string;
  try {
    text = JSON.stringify(value ?? null, null, 2) ?? "null";
  } catch {
    return { text: "—", truncated: false };
  }
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: `${text.slice(0, maxChars)}\n…`, truncated: true };
}

export type UsageRow = {
  phase: "plan" | "verify";
  model: string;
  input_tokens: number;
  output_tokens: number;
  /** numeric do Postgres: o PostgREST pode devolver número ou texto. */
  cost_usd: number | string;
  created_at: string;
};

export type UsageTotals = { calls: number; inputTokens: number; outputTokens: number; costUsd: number; models: string[] };

function toNumber(value: number | string): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Soma o consumo de uma execução. Valores ilegíveis contam como zero (a tela mostra as linhas brutas). */
export function usageTotals(rows: readonly UsageRow[]): UsageTotals {
  const models = new Set<string>();
  let inputTokens = 0;
  let outputTokens = 0;
  let costMicros = 0;
  for (const row of rows) {
    models.add(row.model);
    inputTokens += toNumber(row.input_tokens);
    outputTokens += toNumber(row.output_tokens);
    // Soma em micro-dólares (numeric(12,6)) para não acumular erro de ponto flutuante.
    costMicros += Math.round(toNumber(row.cost_usd) * 1_000_000);
  }
  return { calls: rows.length, inputTokens, outputTokens, costUsd: costMicros / 1_000_000, models: [...models].sort() };
}

const usdSmall = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 4, maximumFractionDigits: 6 });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Custo em dólar: centavos abaixo de US$ 1 são mostrados com 4–6 casas, para não virar "US$ 0,00". */
export function formatUsd(value: number | string): string {
  const n = toNumber(value);
  if (n === 0) return usd.format(0);
  return Math.abs(n) < 1 ? usdSmall.format(n) : usd.format(n);
}

export function formatTokens(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Rascunho criado por draft_content num passo bem-sucedido. Só aceita status "draft": qualquer outro valor
 * não é exibido como rascunho (agentes nunca aprovam nem publicam).
 */
export function draftFromStep(step: { tool: string | null; status: string; output: unknown }): { contentId: string; version: number | null } | null {
  if (step.tool !== "draft_content" || step.status !== "ok") return null;
  const output = step.output;
  if (!output || typeof output !== "object" || Array.isArray(output)) return null;
  const record = output as Record<string, unknown>;
  if (typeof record.content_id !== "string" || !UUID.test(record.content_id)) return null;
  if (record.content_status !== "draft") return null;
  const version = typeof record.content_version === "number" && Number.isInteger(record.content_version) ? record.content_version : null;
  return { contentId: record.content_id, version };
}

export type OutcomeClaim = { text: string; productId: string | null; evidenceIds: string[] };

/** Resumo final gravado por agent_finish_run ({ summary, claims, steps }). Formato inesperado → null. */
export function parseOutcome(outcome: unknown): { summary: string; claims: OutcomeClaim[] } | null {
  if (!outcome || typeof outcome !== "object" || Array.isArray(outcome)) return null;
  const record = outcome as Record<string, unknown>;
  if (typeof record.summary !== "string") return null;
  const claims: OutcomeClaim[] = [];
  if (Array.isArray(record.claims)) {
    for (const item of record.claims) {
      if (!item || typeof item !== "object") continue;
      const claim = item as Record<string, unknown>;
      if (typeof claim.text !== "string") continue;
      claims.push({
        text: claim.text,
        productId: typeof claim.productId === "string" && UUID.test(claim.productId) ? claim.productId : null,
        evidenceIds: Array.isArray(claim.evidenceIds) ? claim.evidenceIds.filter((id): id is string => typeof id === "string") : [],
      });
    }
  }
  return { summary: record.summary, claims };
}
