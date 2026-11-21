/**
 * S14 etapa 7 — adaptador de modelo para o Vercel AI Gateway (API compatível com OpenAI Chat Completions).
 *
 * - Sem SDK e sem dependência nova: fetch nativo, injetável nos testes. Nenhum teste faz chamada real.
 * - URL fixa no código (GATEWAY_BASE_URL): a chave nunca é enviada a um host vindo de variável de ambiente.
 * - temperature 0 e teto de tokens por chamada (custo previsível); resposta acima de MAX_RESPONSE_BYTES é recusada.
 * - Erros não carregam corpo da resposta nem a chave: só um código curto (gateway_http_401, model_truncated…).
 *   O loop (run.ts) converte qualquer erro daqui em model_error / step_timeout.
 * - O objeto devolvido é "unknown" de propósito: parse.ts valida plano e resumo como entrada não confiável.
 * - Consumo (onUsage, opcional): toda resposta 2xx do Gateway registra tokens e custo estimado ANTES de qualquer
 *   validação do conteúdo; se o registro falhar, a chamada falha (gasto não registrado não passa pelo teto).
 *   Sem `usage` na resposta, cobra o pior caso (prompt/3 caracteres por token e o teto de saída).
 */
import { estimateCost, modelPrice } from "./model-pricing.ts";
import { planSystemPrompt, planUserPrompt, summarySystemPrompt, summaryUserPrompt } from "./model-prompt.ts";
import type { AgentModel } from "./types.ts";

export const GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1";
export const MAX_RESPONSE_BYTES = 256 * 1024;
export const DEFAULT_PLAN_MAX_TOKENS = 1_500;
export const DEFAULT_SUMMARY_MAX_TOKENS = 3_000;

export class ModelCallError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "ModelCallError";
    this.code = code;
  }
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

export interface ModelUsage {
  phase: "plan" | "verify";
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface GatewayModelOptions {
  /** Credencial do Gateway: chave (AI_GATEWAY_API_KEY) ou token OIDC do deployment. */
  apiKey: string;
  /** Formato "provedor/modelo" do AI Gateway (ex.: anthropic/…); escolhido pelo Owner. */
  model: string;
  fetch?: FetchLike;
  planMaxTokens?: number;
  summaryMaxTokens?: number;
  /** Registro de consumo; exige modelo com preço conhecido (model-pricing.ts). */
  onUsage?: (usage: ModelUsage) => Promise<void>;
}

function tokenCount(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;
}

/**
 * Extrai o primeiro objeto JSON do texto do modelo. Aceita cerca ```json … ``` e texto antes/depois do objeto;
 * qualquer outra coisa lança model_invalid_json.
 */
export function extractJsonObject(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new ModelCallError("model_invalid_json");
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    throw new ModelCallError("model_invalid_json");
  }
}

export function createGatewayModel(options: GatewayModelOptions): AgentModel {
  const doFetch: FetchLike = options.fetch ?? ((url, init) => fetch(url, init));
  const planMaxTokens = options.planMaxTokens ?? DEFAULT_PLAN_MAX_TOKENS;
  const summaryMaxTokens = options.summaryMaxTokens ?? DEFAULT_SUMMARY_MAX_TOKENS;
  const price = modelPrice(options.model);
  if (options.onUsage && !price) throw new ModelCallError("model_unpriced");

  async function recordUsage(phase: "plan" | "verify", system: string, user: string, maxTokens: number, data: unknown): Promise<void> {
    if (!options.onUsage || !price) return;
    const usage = (data as { usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } } | null)?.usage;
    const inputTokens = tokenCount(usage?.prompt_tokens, Math.ceil((system.length + user.length) / 3));
    const outputTokens = tokenCount(usage?.completion_tokens, maxTokens);
    await options.onUsage({ phase, model: options.model, inputTokens, outputTokens, costUsd: estimateCost(price, inputTokens, outputTokens) });
  }

  async function complete(phase: "plan" | "verify", system: string, user: string, maxTokens: number, signal: AbortSignal): Promise<unknown> {
    let response;
    try {
      response = await doFetch(`${GATEWAY_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: options.model,
          temperature: 0,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal,
      });
    } catch (error) {
      if (signal.aborted) throw error; // o loop transforma em step_timeout
      throw new ModelCallError("gateway_unreachable");
    }
    if (!response.ok) throw new ModelCallError(`gateway_http_${response.status}`);

    let raw: string;
    try {
      raw = await response.text();
    } catch (error) {
      // A resposta 2xx pode já ter gerado custo; contabiliza o pior caso mesmo se o stream falhar.
      await recordUsage(phase, system, user, maxTokens, null);
      if (signal.aborted) throw error; // preserva timeout/cancelamento do AbortSignal
      throw new ModelCallError("gateway_body_read_failed");
    }
    if (Buffer.byteLength(raw, "utf8") > MAX_RESPONSE_BYTES) {
      await recordUsage(phase, system, user, maxTokens, null);
      throw new ModelCallError("model_response_too_large");
    }
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      await recordUsage(phase, system, user, maxTokens, null);
      throw new ModelCallError("gateway_invalid_response");
    }
    await recordUsage(phase, system, user, maxTokens, data);
    const choice = (data as { choices?: Array<{ finish_reason?: unknown; message?: { content?: unknown } }> })?.choices?.[0];
    if (!choice) throw new ModelCallError("gateway_invalid_response");
    if (choice.finish_reason === "length") throw new ModelCallError("model_truncated");
    const content = choice.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) throw new ModelCallError("model_empty");
    return extractJsonObject(content);
  }

  return {
    plan(input, signal) {
      return complete("plan", planSystemPrompt(), planUserPrompt(input), planMaxTokens, signal);
    },
    summarize(input, signal) {
      return complete("verify", summarySystemPrompt(), summaryUserPrompt(input), summaryMaxTokens, signal);
    },
  };
}
