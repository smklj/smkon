/**
 * Prontidão para uso: o que cada recurso do SMKON precisa para funcionar neste ambiente.
 *
 * Função pura sobre as variáveis de ambiente. Devolve só o estado e os NOMES das variáveis que
 * faltam; nenhum valor sai daqui. Chaves de cifragem são validadas (base64 de 32 bytes) pelos
 * mesmos carregadores usados em produção, com o erro descartado.
 */
import { loadTokenKeyring } from "../integrations/shared/token-envelope.ts";
import { loadMercadoLivreTokenKeyring } from "../integrations/mercado-livre/token-crypto.ts";
import { modelConfigStatus } from "../agents/executor/model.ts";
import { modelPrice } from "../agents/executor/model-pricing.ts";
import { cronSecret, executorEnabled } from "../agents/worker/auth.ts";

export type ReadinessStatus = "ready" | "action" | "invalid" | "off";

export type ReadinessCheck = {
  id: string;
  title: string;
  status: ReadinessStatus;
  /** O que o recurso libera, em uma frase. */
  unlocks: string;
  /** Variáveis ausentes (só nomes). */
  missing: string[];
  /** Variáveis presentes com formato inválido (só nomes). */
  invalid: string[];
  /** Próximo passo, quando houver. */
  hint?: string;
};

type Env = Readonly<Record<string, string | undefined>>;

const has = (env: Env, name: string) => typeof env[name] === "string" && env[name]!.trim().length > 0;

function keyStatus(load: () => unknown): "ok" | "invalid" {
  try {
    load();
    return "ok";
  } catch {
    return "invalid";
  }
}

function result(
  base: Omit<ReadinessCheck, "status" | "missing" | "invalid">,
  missing: string[],
  invalid: string[] = [],
): ReadinessCheck {
  const status: ReadinessStatus = invalid.length ? "invalid" : missing.length ? "action" : "ready";
  return { ...base, status, missing, invalid };
}

const SERVICE_HINT =
  "Supabase → Project Settings → API Keys → crie uma secret key e cadastre na Vercel como SUPABASE_SECRET_KEY (tipo Sensitive).";
const KEY_HINT = "Gere com `openssl rand -base64 32` e cadastre na Vercel como Sensitive. O _ID é um rótulo curto (ex.: k2026).";

export function readinessChecks(env: Env): ReadinessCheck[] {
  const serviceReady = has(env, "SUPABASE_SECRET_KEY");
  const needService = serviceReady ? [] : ["SUPABASE_SECRET_KEY"];

  const checks: ReadinessCheck[] = [];

  checks.push(
    result(
      {
        id: "core",
        title: "Núcleo do app",
        unlocks: "Login, produtos, Content Studio, aprovação, calendário, financeiro manual, audiência e mídia.",
      },
      ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"].filter((name) => !has(env, name)),
    ),
  );

  checks.push(
    result(
      {
        id: "site-url",
        title: "Links em e-mails",
        unlocks: "Confirmação de conta e convites apontando para o endereço certo.",
        hint: "Use o domínio público de produção, por exemplo https://smkon.vercel.app.",
      },
      has(env, "NEXT_PUBLIC_SITE_URL") ? [] : ["NEXT_PUBLIC_SITE_URL"],
    ),
  );

  checks.push(
    result(
      {
        id: "service",
        title: "Chave de servidor do Supabase",
        unlocks: "Limite de tentativas de login, webhooks de venda, integrações, execução de ações aprovadas e agentes.",
        hint: serviceReady ? undefined : SERVICE_HINT,
      },
      needService,
    ),
  );

  const metricoolKey = has(env, "INTEGRATION_TOKEN_ENCRYPTION_KEY")
    ? keyStatus(() => loadTokenKeyring("INTEGRATION_TOKEN_ENCRYPTION_KEY", "INTEGRATION_TOKEN_ENCRYPTION_KEY_ID", env))
    : null;
  checks.push(
    result(
      {
        id: "metricool",
        title: "Metricool (publicação nas redes)",
        unlocks: "Conectar a conta do Metricool e publicar, só depois da aprovação da versão exata.",
        hint: metricoolKey === "ok" && serviceReady ? undefined : KEY_HINT,
      },
      [...needService, ...(metricoolKey ? [] : ["INTEGRATION_TOKEN_ENCRYPTION_KEY"])],
      metricoolKey === "invalid" ? ["INTEGRATION_TOKEN_ENCRYPTION_KEY"] : [],
    ),
  );

  const mlKey = has(env, "MERCADO_LIVRE_TOKEN_ENCRYPTION_KEY") ? keyStatus(() => loadMercadoLivreTokenKeyring(env)) : null;
  checks.push(
    result(
      {
        id: "mercado-livre",
        title: "Mercado Livre",
        unlocks: "OAuth da conta de vendedor e sincronização de pedidos no ledger de vendas próprias.",
        hint: "Crie o app em developers.mercadolivre.com.br com a URL de retorno /api/integrations/mercado-livre/oauth/callback.",
      },
      [
        ...needService,
        ...["MERCADO_LIVRE_CLIENT_ID", "MERCADO_LIVRE_CLIENT_SECRET", "MERCADO_LIVRE_REDIRECT_URI"].filter((name) => !has(env, name)),
        ...(mlKey ? [] : ["MERCADO_LIVRE_TOKEN_ENCRYPTION_KEY"]),
      ],
      mlKey === "invalid" ? ["MERCADO_LIVRE_TOKEN_ENCRYPTION_KEY"] : [],
    ),
  );

  checks.push(
    result(
      {
        id: "hotmart",
        title: "Hotmart (webhook de vendas)",
        unlocks: "Receber vendas e comissões da Hotmart no ledger, com segredo próprio por conexão.",
        hint: serviceReady ? "Crie a conexão no Hub de integrações e cole o segredo gerado no painel da Hotmart." : SERVICE_HINT,
      },
      needService,
    ),
  );

  if (!executorEnabled(env)) {
    checks.push({
      id: "agents",
      title: "Agentes de IA",
      status: "off",
      unlocks: "Rascunhos e análises por agentes (Planner → Executor → Verifier), sem publicar nada.",
      missing: [],
      invalid: [],
      hint: "Desligado (AGENT_EXECUTOR_ENABLED diferente de true).",
    });
  } else {
    // Com AGENT_MODEL_AUTH=oidc o token chega a cada execução na Vercel; aqui só a configuração é conferida.
    const oidc = env.AGENT_MODEL_AUTH === "oidc";
    const model = modelConfigStatus(env, oidc ? "token-oidc-verificado-na-execucao" : null);
    const missing = [...needService];
    const invalid: string[] = [];
    if (!has(env, "CRON_SECRET")) missing.push("CRON_SECRET");
    else if (!cronSecret(env)) invalid.push("CRON_SECRET");
    if (!has(env, "AGENT_MONTHLY_BUDGET_USD")) missing.push("AGENT_MONTHLY_BUDGET_USD");
    // Modelo sem preço cadastrado: o worker recusa (budget_not_configured), porque o teto não teria como ser aplicado.
    if (model.ok && !modelPrice(model.model)) invalid.push("AGENT_MODEL");
    if (!model.ok) {
      if (model.reason === "provider_missing") missing.push("AGENT_MODEL_PROVIDER");
      else if (model.reason === "provider_unsupported") invalid.push("AGENT_MODEL_PROVIDER");
      else if (model.reason === "model_missing") missing.push("AGENT_MODEL");
      else if (model.reason === "model_invalid") invalid.push("AGENT_MODEL");
      else if (model.reason === "key_missing") missing.push("AI_GATEWAY_API_KEY");
      else if (model.reason === "key_invalid") invalid.push("AI_GATEWAY_API_KEY");
    }
    checks.push(
      result(
        {
          id: "agents",
          title: "Agentes de IA",
          unlocks: "Rascunhos e análises por agentes (Planner → Executor → Verifier), sem publicar nada.",
          hint: [
            model.ok ? `Modelo: ${model.model}${modelPrice(model.model) ? "" : " (sem preço cadastrado; use um dos modelos suportados)"}.` : null,
            oidc ? "Credencial do AI Gateway por OIDC: só é confirmada na primeira execução." : null,
          ]
            .filter(Boolean)
            .join(" ") || undefined,
        },
        missing,
        invalid,
      ),
    );
  }

  checks.push({
    id: "kiwify",
    title: "Kiwify",
    status: env.KIWIFY_WEBHOOK_ENABLED === "true" ? (has(env, "KIWIFY_WEBHOOK_SECRET") ? "ready" : "action") : "off",
    unlocks: "Receptor de webhook. Ainda não grava vendas no ledger: fica desligado até a homologação.",
    missing: env.KIWIFY_WEBHOOK_ENABLED === "true" && !has(env, "KIWIFY_WEBHOOK_SECRET") ? ["KIWIFY_WEBHOOK_SECRET"] : [],
    invalid: [],
    hint: env.KIWIFY_WEBHOOK_ENABLED === "true" ? undefined : "Desligado por padrão (não homologado).",
  });

  return checks;
}

export function readinessSummary(checks: readonly ReadinessCheck[]) {
  const counted = checks.filter((check) => check.status !== "off");
  return {
    ready: counted.filter((check) => check.status === "ready").length,
    total: counted.length,
    pending: counted.filter((check) => check.status !== "ready").length,
  };
}
