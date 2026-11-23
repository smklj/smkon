/**
 * IA assistiva nos módulos (Gemini ou outro modelo do catálogo) pelo Vercel AI Gateway.
 *
 * Regras:
 * - Nada aqui publica, aprova, grava conteúdo ou mexe em valores: só devolve texto para a pessoa revisar.
 * - Cada chamada passa por: papel (owner/admin/analyst), limite de 60 chamadas/hora por usuário e teto mensal
 *   do workspace (assistente + agentes). O custo é registrado mesmo quando a resposta vem inválida.
 * - Destino: Gemini direto no Google com GEMINI_API_KEY (cobra na conta Google, usa os créditos do plano) ou,
 *   sem ela, o Vercel AI Gateway com AI_GATEWAY_API_KEY ou o token OIDC da invocação (AGENT_MODEL_AUTH=oidc).
 * Dependências injetadas para os testes rodarem sem rede e sem banco.
 */
import { extractJsonObject, type FetchLike } from "../agents/executor/model-gateway.ts";
import { reasoningFields, resolveTransport, type Transport } from "../agents/executor/transport.ts";
import { estimateCost, modelPrice, modelRequestProfile, monthStartUtc, parseBudget } from "../agents/executor/model-pricing.ts";
import { gatewayCredential, modelConfigStatus } from "../agents/executor/model.ts";

export type AssistFeature =
  | "studio_write"
  | "compliance_review"
  | "product_brief"
  | "finance_explain"
  | "audience_reply"
  | "overview_brief";

export type AssistErrorCode =
  | "ai_not_configured"
  | "ai_forbidden"
  | "ai_rate_limited"
  | "ai_budget_exhausted"
  | "ai_unavailable"
  | "ai_invalid_response"
  | "ai_truncated";

export class AssistError extends Error {
  readonly code: AssistErrorCode;
  constructor(code: AssistErrorCode) {
    super(code);
    this.name = "AssistError";
    this.code = code;
  }
}

/** Mensagem para a pessoa (sem detalhe interno). */
export const ASSIST_ERROR_MESSAGE: Record<AssistErrorCode, string> = {
  ai_not_configured: "A IA ainda não está configurada neste ambiente. Veja Admin → Prontidão para uso.",
  ai_forbidden: "Seu papel não permite usar a IA neste workspace.",
  ai_rate_limited: "Muitas chamadas à IA na última hora. Tente de novo mais tarde.",
  ai_budget_exhausted: "O teto mensal de gasto com IA deste workspace foi atingido.",
  ai_unavailable: "A IA não respondeu agora. Tente de novo em instantes.",
  ai_invalid_response: "A IA devolveu uma resposta fora do formato. Tente de novo.",
  ai_truncated: "A resposta da IA ficou incompleta. Tente de novo com um pedido mais curto.",
};

export const ASSIST_ERROR_STATUS: Record<AssistErrorCode, number> = {
  ai_not_configured: 503,
  ai_forbidden: 403,
  ai_rate_limited: 429,
  ai_budget_exhausted: 402,
  ai_unavailable: 502,
  ai_invalid_response: 502,
  ai_truncated: 502,
};

type Env = Readonly<Record<string, string | undefined>>;

export type AssistConfig = { model: string; budgetUsd: number; transport: Transport };

/**
 * Modelo: AI_MODEL ou, sem ele, o mesmo dos agentes (AGENT_MODEL). Teto: AI_MONTHLY_BUDGET_USD ou
 * AGENT_MONTHLY_BUDGET_USD. O modelo precisa ter preço no catálogo, senão o teto não teria como valer.
 */
export function assistConfig(env: Env, oidcToken?: string | null): AssistConfig | null {
  const merged = { ...env, AGENT_MODEL: env.AI_MODEL?.trim() || env.AGENT_MODEL };
  const status = modelConfigStatus(merged, oidcToken);
  if (!status.ok || !modelPrice(status.model)) return null;
  const budgetUsd = parseBudget(env.AI_MONTHLY_BUDGET_USD ?? env.AGENT_MONTHLY_BUDGET_USD);
  if (budgetUsd === null) return null;
  const cred = gatewayCredential(merged, oidcToken);
  const transport = resolveTransport(merged, status.model, cred.ok ? cred.token : null);
  if (!transport) return null;
  return { model: status.model, budgetUsd, transport };
}

/** "google/gemini-3.8-flash" → "Gemini"; outros provedores → "IA". */
export function assistLabel(model: string | null | undefined): string {
  return model?.startsWith("google/gemini") ? "Gemini" : "IA";
}

/** Operações de banco usadas pelo assistente (implementadas com a sessão do usuário). */
export interface AssistStore {
  consumeRateLimit(): Promise<boolean>;
  spentSince(since: Date): Promise<number>;
  recordUsage(usage: { model: string; inputTokens: number; outputTokens: number; costUsd: number }): Promise<void>;
}

export type AssistRequest = {
  feature: AssistFeature;
  role: string;
  system: string;
  user: string;
  /** Tokens para a resposta em si (o perfil do modelo soma a folga de raciocínio). */
  maxTokens: number;
};

export type AssistResult = { json: unknown; model: string; costUsd: number };

const ALLOWED_ROLES = new Set(["owner", "admin", "analyst"]);
const MAX_RESPONSE_BYTES = 128 * 1024;
const TIMEOUT_MS = 45_000;

function tokens(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;
}

/** Executa uma chamada assistiva com todas as barreiras e devolve o JSON da resposta. */
export async function runAssist(
  request: AssistRequest,
  deps: { config: AssistConfig | null; store: AssistStore; fetch?: FetchLike; now?: () => Date },
): Promise<AssistResult> {
  if (!ALLOWED_ROLES.has(request.role)) throw new AssistError("ai_forbidden");
  const config = deps.config;
  if (!config) throw new AssistError("ai_not_configured");
  const price = modelPrice(config.model);
  if (!price) throw new AssistError("ai_not_configured");

  if (!(await deps.store.consumeRateLimit())) throw new AssistError("ai_rate_limited");
  const spent = await deps.store.spentSince(monthStartUtc((deps.now ?? (() => new Date()))()));
  if (!Number.isFinite(spent) || spent >= config.budgetUsd) throw new AssistError("ai_budget_exhausted");

  const profile = modelRequestProfile(config.model);
  const maxTokens = request.maxTokens + (profile.outputHeadroom ?? 0);
  const doFetch: FetchLike = deps.fetch ?? ((url, init) => fetch(url, init));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const record = async (data: unknown) => {
    const usage = (data as { usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } } | null)?.usage;
    const inputTokens = tokens(usage?.prompt_tokens, Math.ceil((request.system.length + request.user.length) / 3));
    const outputTokens = tokens(usage?.completion_tokens, maxTokens);
    const costUsd = estimateCost(price, inputTokens, outputTokens);
    await deps.store.recordUsage({ model: config.model, inputTokens, outputTokens, costUsd });
    return costUsd;
  };

  let raw: string;
  try {
    const { transport } = config;
    const response = await doFetch(`${transport.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${transport.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: transport.modelId,
        temperature: 0.4,
        max_tokens: maxTokens,
        ...reasoningFields(profile.reasoningEffort, transport.direct),
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new AssistError("ai_unavailable");
    raw = await response.text();
  } catch (error) {
    if (error instanceof AssistError) throw error;
    throw new AssistError("ai_unavailable");
  } finally {
    clearTimeout(timer);
  }

  let data: unknown = null;
  if (Buffer.byteLength(raw, "utf8") <= MAX_RESPONSE_BYTES) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }
  // A resposta 2xx gerou custo: registra antes de validar.
  const costUsd = await record(data);
  if (!data) throw new AssistError("ai_invalid_response");

  const choice = (data as { choices?: Array<{ finish_reason?: unknown; message?: { content?: unknown } }> }).choices?.[0];
  if (!choice || typeof choice.message?.content !== "string") throw new AssistError("ai_invalid_response");
  if (choice.finish_reason === "length") throw new AssistError("ai_truncated");
  try {
    return { json: extractJsonObject(choice.message.content), model: config.model, costUsd };
  } catch {
    throw new AssistError("ai_invalid_response");
  }
}
