"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/http/safe-redirect";

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
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) redirect(`/login?error=invalid-credentials${back}`);
  redirect(next);
}
