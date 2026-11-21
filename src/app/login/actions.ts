"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/http/safe-redirect";
import { clientIp, consumeRateLimit, rateLimitSubject } from "@/lib/http/rate-limit";
import { log } from "@/lib/observability/log";
import { ensureWorkspace } from "@/lib/tenancy/service";

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

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) redirect(`/login?error=invalid-credentials${back}`);

  // Bootstrap idempotente: o primeiro usuário sem membership vira owner;
  // usuários que já pertencem a um workspace mantêm o papel existente.
  try {
    await ensureWorkspace(supabase);
  } catch (error) {
    log("error", "auth.signIn.workspace_setup", { message: error instanceof Error ? error.message : String(error) });
    // Não deixa uma sessão autenticada sem o contexto de tenant obrigatório.
    await supabase.auth.signOut();
    redirect(`/login?error=workspace-setup${back}`);
  }

  redirect(next);
}
