"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid } from "@/lib/content/server";
import { dbErrorMessage } from "@/lib/http/errors";
import { createClient } from "@/lib/supabase/server";
import { errorFields, log } from "@/lib/observability/log";
import { setActiveWorkspace } from "@/lib/tenancy/admin";
import { isMissingSchemaObject } from "@/lib/tenancy/members";

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    log("error", "auth.signOut", errorFields(error));
  }
  redirect("/login");
}

export type SwitchWorkspaceState = { error?: string } | null;

/**
 * Troca o workspace ativo. O id vindo do formulário é só uma escolha: o banco
 * (public.set_active_workspace) confere a membership, e as páginas continuam
 * autorizadas pela RLS. Vai para a visão geral, porque a página atual pode ser
 * um registro do workspace anterior.
 */
export async function switchWorkspace(_prev: SwitchWorkspaceState, formData: FormData): Promise<SwitchWorkspaceState> {
  const organizationId = String(formData.get("organization_id") ?? "");
  if (!isUuid(organizationId)) return { error: "Workspace inválido." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  try {
    await setActiveWorkspace(supabase, organizationId);
  } catch (error) {
    if (isMissingSchemaObject(error as { code?: string })) {
      return { error: "A troca de workspace ainda não está disponível neste ambiente." };
    }
    log("warn", "tenancy.switch", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível trocar de workspace.") };
  }
  log("info", "tenancy.switch", { organization_id: organizationId });
  revalidatePath("/", "layout");
  redirect("/");
}
