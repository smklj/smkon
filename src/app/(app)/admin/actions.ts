"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ValidationError, dbErrorMessage } from "@/lib/http/errors";
import { errorFields, log } from "@/lib/observability/log";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL, canManageMembers } from "@/lib/tenancy/members";
import { parseMemberId, parseMemberRoleChange, type MemberRoleChangeInput } from "@/lib/tenancy/schema";
import { changeMemberRole, findWorkspace, removeMember } from "@/lib/tenancy/service";
import { formDataToRaw } from "@/lib/validation/fields";

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
  let input: MemberRoleChangeInput;
  try {
    input = parseMemberRoleChange(formDataToRaw(formData));
  } catch (error) {
    if (error instanceof ValidationError) return { error: error.message };
    throw error;
  }
  const { userId, role } = input;
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
  let userId: string;
  try {
    userId = parseMemberId(formDataToRaw(formData));
  } catch (error) {
    if (error instanceof ValidationError) return { error: error.message };
    throw error;
  }
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
