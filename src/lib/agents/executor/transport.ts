/**
 * Para onde vai a chamada do modelo.
 *
 * - Gemini direto no Google (endpoint compatível com OpenAI do Google AI Studio) quando o modelo é
 *   "google/…" e há GEMINI_API_KEY: a cobrança usa a conta Google (e os créditos do plano Google AI Pro),
 *   sem exigir créditos do AI Gateway. O id enviado ao Google não tem o prefixo "google/".
 * - Nos demais casos, o Vercel AI Gateway com AI_GATEWAY_API_KEY ou o token OIDC do deployment.
 * O preço e o teto continuam pelo id do catálogo ("google/gemini-3.8-flash").
 */
export const GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1";
export const GOOGLE_OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";

const MIN_KEY_LENGTH = 20;

export type Transport = {
  baseUrl: string;
  apiKey: string;
  /** Id enviado ao provedor. */
  modelId: string;
  /** true = Google direto (campo reasoning_effort); false = AI Gateway (extensão reasoning). */
  direct: boolean;
};

type Env = Readonly<Record<string, string | undefined>>;

/** Chave do Google AI Studio utilizável (sem espaços, tamanho mínimo) ou null. */
export function googleApiKey(env: Env): string | null {
  const key = env.GEMINI_API_KEY;
  return typeof key === "string" && key.length >= MIN_KEY_LENGTH && !/\s/.test(key) ? key : null;
}

export function isGoogleModel(model: string): boolean {
  return model.startsWith("google/");
}

export function resolveTransport(env: Env, model: string, gatewayKey: string | null): Transport | null {
  const google = isGoogleModel(model) ? googleApiKey(env) : null;
  if (google) return { baseUrl: GOOGLE_OPENAI_BASE_URL, apiKey: google, modelId: model.slice("google/".length), direct: true };
  if (gatewayKey) return { baseUrl: GATEWAY_BASE_URL, apiKey: gatewayKey, modelId: model, direct: false };
  return null;
}

/** Campo de esforço de raciocínio no formato de cada destino. */
export function reasoningFields(effort: string | undefined, direct: boolean): Record<string, unknown> {
  if (!effort) return {};
  return direct ? { reasoning_effort: effort } : { reasoning: { effort } };
}
