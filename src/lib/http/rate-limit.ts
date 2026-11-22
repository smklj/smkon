import { createHash } from "node:crypto";
import type { SupabaseClient as BaseClient } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { errorFields, log } from "../observability/log.ts";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type ServiceClient = BaseClient<Database>;

/** Escopos de usuário logado: o banco usa auth.uid() como sujeito. */
export type RateLimitScope = "invite_create" | "invite_accept" | "ai_assist";
/** Escopos de login: só a chave de servidor consome (anon não bloqueia o login de ninguém). */
export type LoginRateLimitScope = "login_ip" | "login_email";
export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

/** Hash do sujeito (IP ou e-mail normalizado). O banco nunca recebe o valor real. */
export function rateLimitSubject(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase(), "utf8").digest("hex");
}

/** Primeiro IP do X-Forwarded-For (definido pela Vercel) ou "unknown". */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip") || "unknown";
}

function toResult(data: unknown): RateLimitResult {
  const row = (Array.isArray(data) ? data[0] : data) as { allowed?: boolean; retry_after_seconds?: number } | null;
  return { allowed: row?.allowed !== false, retryAfterSeconds: Number(row?.retry_after_seconds ?? 0) };
}

/**
 * Consome uma tentativa de um escopo de usuário logado. Em falha do banco, libera (fail-open)
 * e registra erro: o limite é proteção adicional e não pode derrubar a ação.
 */
export async function consumeRateLimit(supabase: SupabaseClient, scope: RateLimitScope): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc("rate_limit_consume", { p_scope: scope });
  if (error) {
    log("error", "rate_limit", { rateScope: scope, ...errorFields(error) });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  return toResult(data);
}

/**
 * Consome uma tentativa de login com a chave de servidor. Sem SUPABASE_SECRET_KEY o limite fica
 * desligado (fail-open) e isso é registrado: o Supabase Auth ainda aplica os próprios limites.
 */
export async function consumeLoginRateLimit(
  service: ServiceClient | null,
  scope: LoginRateLimitScope,
  subject: string,
): Promise<RateLimitResult> {
  if (!service) {
    log("warn", "rate_limit.login_unprotected", { rateScope: scope, reason: "service_not_configured" });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  const { data, error } = await service.rpc("rate_limit_consume_login", { p_scope: scope, p_subject: subject });
  if (error) {
    log("error", "rate_limit", { rateScope: scope, ...errorFields(error) });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  return toResult(data);
}
