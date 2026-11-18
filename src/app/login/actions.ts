"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/http/safe-redirect";
import { clientIp, consumeRateLimit, rateLimitSubject } from "@/lib/http/rate-limit";
import { log } from "@/lib/observability/log";

// Acesso somente por convite (decisão do Owner): não existe cadastro público.

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"), "/");
  const back = next !== "/" ? `&next=${encodeURIComponent(next)}` : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 128) {
    redirect(`/login?error=invalid-input${back}`);
  }

  const supabase = await createClient();

  // Limite por IP e por e-mail (o servidor chama o Supabase sempre do mesmo IP,
  // então o limite por IP do Supabase Auth não protege contra força bruta aqui).
  const ip = clientIp(await headers());
  const [byIp, byEmail] = await Promise.all([
    consumeRateLimit(supabase, "login_ip", rateLimitSubject(ip)),
    consumeRateLimit(supabase, "login_email", rateLimitSubject(email)),
  ]);
  if (!byIp.allowed || !byEmail.allowed) {
    log("warn", "auth.signIn.rate_limited", { byIp: !byIp.allowed, byEmail: !byEmail.allowed });
    redirect(`/login?error=rate-limited${back}`);
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) redirect(`/login?error=invalid-credentials${back}`);
  redirect(next);
}
