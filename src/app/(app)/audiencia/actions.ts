"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ANONYMIZE_CONFIRMATION, missingDeletionConfirmation } from "@/lib/audience/schema";
import {
  canManageAudience,
  correctContact,
  eraseContact,
  recordConsentEvent,
  registerContact,
  registerSubjectRequest,
  resolveSubjectRequest,
  revokeAll,
} from "@/lib/audience/service";
import { dbErrorMessage } from "@/lib/http/errors";
import { errorFields, log } from "@/lib/observability/log";
import { createClient } from "@/lib/supabase/server";
import { formDataToRaw as fields } from "@/lib/validation/fields";
import { findWorkspace } from "@/lib/tenancy/workspace";

export type AudienceState = { error?: string; ok?: string; at?: number } | null;

const FORBIDDEN: AudienceState = { error: "Apenas owner ou admin alteram contatos, consentimentos e pedidos." };

async function manager() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/audiencia");
  const workspace = await findWorkspace(supabase, user.id);
  return { supabase, workspace: workspace && canManageAudience(workspace.role) ? workspace : null };
}

export async function createContactAction(_prev: AudienceState, formData: FormData): Promise<AudienceState> {
  const { supabase, workspace } = await manager();
  if (!workspace) return FORBIDDEN;
  let id: string;
  try {
    id = await registerContact(supabase, workspace.organizationId, fields(formData));
  } catch (error) {
    log("warn", "audience.contact.create", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível cadastrar o contato.") };
  }
  revalidatePath("/audiencia");
  redirect(`/audiencia?contato=${id}`);
}

export async function updateContactAction(_prev: AudienceState, formData: FormData): Promise<AudienceState> {
  const { supabase, workspace } = await manager();
  if (!workspace) return FORBIDDEN;
  try {
    await correctContact(supabase, fields(formData));
  } catch (error) {
    log("warn", "audience.contact.update", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível corrigir o contato.") };
  }
  revalidatePath("/audiencia");
  return { ok: "Dados corrigidos. O histórico de consentimento não muda.", at: Date.now() };
}

export async function recordConsentAction(_prev: AudienceState, formData: FormData): Promise<AudienceState> {
  const { supabase, workspace } = await manager();
  if (!workspace) return FORBIDDEN;
  let action: "opt_in" | "opt_out";
  try {
    action = await recordConsentEvent(supabase, fields(formData));
  } catch (error) {
    log("warn", "audience.consent.record", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível registrar o consentimento.") };
  }
  revalidatePath("/audiencia");
  return { ok: action === "opt_in" ? "Consentimento registrado com a evidência." : "Revogação registrada.", at: Date.now() };
}

export async function revokeAllAction(_prev: AudienceState, formData: FormData): Promise<AudienceState> {
  const { supabase, workspace } = await manager();
  if (!workspace) return FORBIDDEN;
  let count: number;
  try {
    count = await revokeAll(supabase, fields(formData));
  } catch (error) {
    log("warn", "audience.consent.revoke_all", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível revogar os consentimentos.") };
  }
  revalidatePath("/audiencia");
  return {
    ok: count === 0 ? "Nenhum consentimento ativo para revogar." : `${count} consentimento(s) revogado(s).`,
    at: Date.now(),
  };
}

export async function registerRequestAction(_prev: AudienceState, formData: FormData): Promise<AudienceState> {
  const { supabase, workspace } = await manager();
  if (!workspace) return FORBIDDEN;
  try {
    await registerSubjectRequest(supabase, fields(formData));
  } catch (error) {
    log("warn", "audience.request.register", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível registrar o pedido.") };
  }
  revalidatePath("/audiencia");
  return { ok: "Pedido registrado. Prazo de resposta: 15 dias.", at: Date.now() };
}

export async function resolveRequestAction(_prev: AudienceState, formData: FormData): Promise<AudienceState> {
  const { supabase, workspace } = await manager();
  if (!workspace) return FORBIDDEN;
  let status: "completed" | "rejected";
  const raw = fields(formData);
  // Concluir uma exclusão anonimiza o contato: exige a mesma confirmação da exclusão direta.
  if (missingDeletionConfirmation(raw)) {
    return { error: `Digite ${ANONYMIZE_CONFIRMATION} para concluir a exclusão.` };
  }
  try {
    status = await resolveSubjectRequest(supabase, raw);
  } catch (error) {
    log("warn", "audience.request.resolve", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível resolver o pedido.") };
  }
  revalidatePath("/audiencia");
  return { ok: status === "completed" ? "Pedido concluído." : "Pedido recusado com motivo.", at: Date.now() };
}

export async function anonymizeContactAction(_prev: AudienceState, formData: FormData): Promise<AudienceState> {
  const { supabase, workspace } = await manager();
  if (!workspace) return FORBIDDEN;
  try {
    await eraseContact(supabase, fields(formData));
  } catch (error) {
    log("warn", "audience.contact.anonymize", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível excluir os dados do contato.") };
  }
  revalidatePath("/audiencia");
  return { ok: "Dados pessoais excluídos. O histórico ficou anonimizado para auditoria.", at: Date.now() };
}
