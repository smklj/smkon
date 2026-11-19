/**
 * S14 — resolução do modelo do executor (etapa 7).
 *
 * Só liga um modelo com configuração EXPLÍCITA e completa do Owner (nada implícito):
 *   AGENT_MODEL_PROVIDER = "vercel-ai-gateway"
 *   AGENT_MODEL          = "<provedor>/<modelo>" do AI Gateway (escolha e orçamento do Owner)
 *   credencial, uma de:
 *     AI_GATEWAY_API_KEY = chave do AI Gateway (só servidor; nunca NEXT_PUBLIC_), ou
 *     AGENT_MODEL_AUTH   = "oidc" → token OIDC do deployment na Vercel (header x-vercel-oidc-token da invocação ou
 *                          VERCEL_OIDC_TOKEN). Opt-in explícito: o token OIDC presente sozinho não liga nada.
 *                          Escolhido pelo Owner em 19/11/2026 para não guardar chave.
 * O teto de gasto (AGENT_MONTHLY_BUDGET_USD) é exigido pelo worker (handler.ts), não aqui.
 * Faltando qualquer uma, devolve null: o worker responde 503 model_not_configured sem reservar execuções e
 * runAgent falha com model_not_configured. Nenhuma chamada paga acontece por resolver o modelo.
 */
import { createGatewayModel, type FetchLike, type ModelUsage } from "./model-gateway.ts";
import type { AgentModel } from "./types.ts";
import type { WorkerEnv } from "../worker/auth.ts";

export const SUPPORTED_MODEL_PROVIDERS = ["vercel-ai-gateway"] as const;
const MODEL_ID = /^[a-z0-9][a-z0-9-]{0,39}\/[a-z0-9][a-z0-9._:-]{0,79}$/i;
const MIN_KEY_LENGTH = 20;

export type ModelConfigStatus =
  | { ok: true; provider: (typeof SUPPORTED_MODEL_PROVIDERS)[number]; model: string }
  | { ok: false; reason: "provider_missing" | "provider_unsupported" | "model_missing" | "model_invalid" | "key_missing" | "key_invalid" | "oidc_token_missing" };

export interface ModelResolveOptions {
  fetch?: FetchLike;
  /** Token OIDC da invocação (header x-vercel-oidc-token); só usado com AGENT_MODEL_AUTH=oidc. */
  oidcToken?: string | null;
  onUsage?: (usage: ModelUsage) => Promise<void>;
}

function credential(env: WorkerEnv, oidcToken?: string | null): { ok: true; token: string } | { ok: false; reason: "key_missing" | "key_invalid" | "oidc_token_missing" } {
  if (env.AGENT_MODEL_AUTH === "oidc") {
    const token = [oidcToken, env.VERCEL_OIDC_TOKEN].find((value) => typeof value === "string" && value.length >= MIN_KEY_LENGTH && !/\s/.test(value));
    return token ? { ok: true, token } : { ok: false, reason: "oidc_token_missing" };
  }
  const key = env.AI_GATEWAY_API_KEY;
  if (!key) return { ok: false, reason: "key_missing" };
  if (key.length < MIN_KEY_LENGTH || /\s/.test(key)) return { ok: false, reason: "key_invalid" };
  return { ok: true, token: key };
}

/** Diagnóstico sem segredo (pode ir para log): nunca inclui a chave. */
export function modelConfigStatus(env: WorkerEnv, oidcToken?: string | null): ModelConfigStatus {
  const provider = env.AGENT_MODEL_PROVIDER?.trim();
  if (!provider) return { ok: false, reason: "provider_missing" };
  if (!(SUPPORTED_MODEL_PROVIDERS as readonly string[]).includes(provider)) return { ok: false, reason: "provider_unsupported" };
  const model = env.AGENT_MODEL?.trim();
  if (!model) return { ok: false, reason: "model_missing" };
  if (!MODEL_ID.test(model)) return { ok: false, reason: "model_invalid" };
  const cred = credential(env, oidcToken);
  if (!cred.ok) return { ok: false, reason: cred.reason };
  return { ok: true, provider: "vercel-ai-gateway", model };
}

export function resolveAgentModel(env: WorkerEnv, options: ModelResolveOptions = {}): AgentModel | null {
  const status = modelConfigStatus(env, options.oidcToken);
  if (!status.ok) return null;
  const cred = credential(env, options.oidcToken);
  if (!cred.ok) return null;
  return createGatewayModel({ apiKey: cred.token, model: status.model, fetch: options.fetch, onUsage: options.onUsage });
}
