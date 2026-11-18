import { createHash } from "node:crypto";
import type { createClient } from "@/lib/supabase/server";
import { errorFields, log } from "../observability/log.ts";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type RateLimitScope = "login_ip" | "login_email" | "invite_create" | "invite_accept";
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

/**
 * Consome uma tentativa. Em falha do banco, libera (fail-open) e registra erro:
 * o limite é proteção adicional e não pode derrubar o login se a função não existir.
 */
export async function consumeRateLimit(
  supabase: SupabaseClient,
  scope: RateLimitScope,
  subject?: string,
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc("rate_limit_consume", { p_scope: scope, p_subject: subject });
  if (error) {
    log("error", "rate_limit", { rateScope: scope, ...errorFields(error) });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { allowed: row?.allowed !== false, retryAfterSeconds: Number(row?.retry_after_seconds ?? 0) };
}
