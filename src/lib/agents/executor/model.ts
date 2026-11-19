/**
 * S14 — resolução do modelo do executor (etapa 7).
 *
 * Só liga um modelo com configuração EXPLÍCITA e completa do Owner (nada implícito, nem o token OIDC da Vercel):
 *   AGENT_MODEL_PROVIDER = "vercel-ai-gateway"
 *   AGENT_MODEL          = "<provedor>/<modelo>" do AI Gateway (escolha e orçamento do Owner)
 *   AI_GATEWAY_API_KEY   = chave do AI Gateway (só servidor; nunca NEXT_PUBLIC_)
 * Faltando qualquer uma, devolve null: o worker responde 503 model_not_configured sem reservar execuções e
 * runAgent falha com model_not_configured. Nenhuma chamada paga acontece por resolver o modelo.
 */
import { createGatewayModel, type FetchLike } from "./model-gateway.ts";
import type { AgentModel } from "./types.ts";
import type { WorkerEnv } from "../worker/auth.ts";

export const SUPPORTED_MODEL_PROVIDERS = ["vercel-ai-gateway"] as const;
const MODEL_ID = /^[a-z0-9][a-z0-9-]{0,39}\/[a-z0-9][a-z0-9._:-]{0,79}$/i;
const MIN_KEY_LENGTH = 20;

export type ModelConfigStatus =
  | { ok: true; provider: (typeof SUPPORTED_MODEL_PROVIDERS)[number]; model: string }
  | { ok: false; reason: "provider_missing" | "provider_unsupported" | "model_missing" | "model_invalid" | "key_missing" | "key_invalid" };

/** Diagnóstico sem segredo (pode ir para log): nunca inclui a chave. */
export function modelConfigStatus(env: WorkerEnv): ModelConfigStatus {
  const provider = env.AGENT_MODEL_PROVIDER?.trim();
  if (!provider) return { ok: false, reason: "provider_missing" };
  if (!(SUPPORTED_MODEL_PROVIDERS as readonly string[]).includes(provider)) return { ok: false, reason: "provider_unsupported" };
  const model = env.AGENT_MODEL?.trim();
  if (!model) return { ok: false, reason: "model_missing" };
  if (!MODEL_ID.test(model)) return { ok: false, reason: "model_invalid" };
  const key = env.AI_GATEWAY_API_KEY;
  if (!key) return { ok: false, reason: "key_missing" };
  if (key.length < MIN_KEY_LENGTH || /\s/.test(key)) return { ok: false, reason: "key_invalid" };
  return { ok: true, provider: "vercel-ai-gateway", model };
}

export function resolveAgentModel(env: WorkerEnv, options: { fetch?: FetchLike } = {}): AgentModel | null {
  const status = modelConfigStatus(env);
  if (!status.ok) return null;
  return createGatewayModel({ apiKey: env.AI_GATEWAY_API_KEY as string, model: status.model, fetch: options.fetch });
}
