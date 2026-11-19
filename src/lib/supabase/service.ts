/**
 * Cliente Supabase com chave secreta (service_role) — SÓ no servidor.
 *
 * Usado apenas pela rota /api/agents/worker (S14), que chama funções restritas a service_role
 * (agent_claim_next_run, agent_record_step, agent_draft_content, ...). Não importe este módulo em
 * componentes de cliente nem em Server Actions de usuário: ele ignora RLS.
 * A chave vem de SUPABASE_SECRET_KEY (nunca com prefixo NEXT_PUBLIC_).
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export function getServiceEnv(env: Readonly<Record<string, string | undefined>> = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) return null;
  return { url, secretKey };
}

export function createServiceClient() {
  if (typeof window !== "undefined") throw new Error("service client is server-only");
  const env = getServiceEnv();
  if (!env) return null;
  return createClient<Database>(env.url, env.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
