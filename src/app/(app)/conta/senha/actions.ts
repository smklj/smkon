"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/http/safe-redirect";
import { log } from "@/lib/observability/log";

export type PasswordState = { error: string } | null;

export async function updatePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < 8 || password.length > 128) return { error: "Use uma senha entre 8 e 128 caracteres." };
  if (password !== confirmation) return { error: "As senhas não conferem." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    log("error", "account.updatePassword", { code: error.code ?? "unknown" });
    return { error: "Não foi possível definir a senha. Tente novamente." };
  }
  redirect(safeNextPath(formData.get("next"), "/?senha=ok"));
}
