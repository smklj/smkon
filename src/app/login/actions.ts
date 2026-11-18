"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/http/safe-redirect";
import { ensureWorkspace } from "@/lib/tenancy/workspace";

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
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) redirect(`/login?error=invalid-credentials${back}`);

  // Bootstrap idempotente: o primeiro usuário sem membership vira owner;
  // usuários que já pertencem a um workspace mantêm o papel existente.
  try {
    await ensureWorkspace(supabase);
  } catch {
    // Não deixa uma sessão autenticada sem o contexto de tenant obrigatório.
    await supabase.auth.signOut();
    redirect(`/login?error=workspace-setup${back}`);
  }

  redirect(next);
}
