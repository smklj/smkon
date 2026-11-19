"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid } from "@/lib/content/server";
import { dbErrorMessage } from "@/lib/http/errors";
import { errorFields, log } from "@/lib/observability/log";
import { createClient } from "@/lib/supabase/server";
import { changeMemberRole, removeMember } from "@/lib/tenancy/admin";
import { ROLE_LABEL, canManageMembers, isMemberRole } from "@/lib/tenancy/members";
import { findWorkspace } from "@/lib/tenancy/workspace";

export type MemberState = { error?: string; ok?: string; at?: number } | null;

/** O workspace vem da sessão (workspace ativo no servidor), nunca de um campo do formulário. */
async function owner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  const workspace = await findWorkspace(supabase, user.id);
  return { supabase, userId: user.id, workspace: workspace && canManageMembers(workspace.role) ? workspace : null };
}

export async function changeMemberRoleAction(_prev: MemberState, formData: FormData): Promise<MemberState> {
  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!isUuid(userId)) return { error: "Membro inválido." };
  if (!isMemberRole(role)) return { error: "Papel inválido." };
  const { supabase, workspace } = await owner();
  if (!workspace) return { error: "Apenas o owner altera papéis." };
  let changed: boolean;
  try {
    changed = await changeMemberRole(supabase, workspace.organizationId, userId, role);
  } catch (error) {
    log("warn", "members.change_role", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível alterar o papel.") };
  }
  log("info", "members.change_role", { organization_id: workspace.organizationId, target: userId, role, changed });
  revalidatePath("/", "layout");
  return { ok: changed ? `Papel alterado para ${ROLE_LABEL[role]}.` : "O papel já era este.", at: Date.now() };
}

export async function removeMemberAction(_prev: MemberState, formData: FormData): Promise<MemberState> {
  const userId = String(formData.get("user_id") ?? "");
  if (!isUuid(userId)) return { error: "Membro inválido." };
  const { supabase, workspace, userId: actorId } = await owner();
  if (!workspace) return { error: "Apenas o owner remove membros." };
  try {
    await removeMember(supabase, workspace.organizationId, userId);
  } catch (error) {
    log("warn", "members.remove", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível remover o membro.") };
  }
  log("info", "members.remove", { organization_id: workspace.organizationId, target: userId });
  // Quem removeu a si mesmo perdeu o acesso a este workspace: recarrega no próximo ativo.
  if (userId === actorId) redirect("/");
  revalidatePath("/", "layout");
  return { ok: "Membro removido do workspace.", at: Date.now() };
}
