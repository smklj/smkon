"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbErrorMessage, ValidationError } from "@/lib/http/errors";
import { archiveMedia, registerMedia, revokeLicense } from "@/lib/media/repository";
import { parseMediaId, parseRevokeInput } from "@/lib/media/schema";
import { canManageMedia, registerLicense } from "@/lib/media/service";
import { todayInBrazil } from "@/lib/media/types";
import { errorFields, log } from "@/lib/observability/log";
import { createClient } from "@/lib/supabase/server";
import { findWorkspace } from "@/lib/tenancy/workspace";
import { formDataToRaw as fields } from "@/lib/validation/fields";

export type MediaState = { error?: string; ok?: string; at?: number } | null;

async function editor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/midia");
  const workspace = await findWorkspace(supabase, user.id);
  return { supabase, workspace: workspace && canManageMedia(workspace.role) ? workspace : null };
}

/** Validação barata do formulário, antes da autenticação: erro de entrada vira mensagem; o resto propaga. */
function invalidInput(error: unknown): MediaState {
  if (error instanceof ValidationError) return { error: error.message };
  throw error;
}

/** Chamado pelo navegador depois do upload direto ao Storage. O banco confere o arquivo. */
export async function registerMediaAction(storagePath: string, originalName: string): Promise<MediaState> {
  const { supabase, workspace } = await editor();
  if (!workspace) return { error: "Apenas owner ou admin enviam mídia." };
  try {
    await registerMedia(supabase, storagePath, originalName);
  } catch (error) {
    log("warn", "media.register", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível registrar o arquivo.") };
  }
  revalidatePath("/midia");
  return { ok: "Arquivo enviado. Registre a licença para poder publicar.", at: Date.now() };
}

export async function recordLicenseAction(_prev: MediaState, formData: FormData): Promise<MediaState> {
  let mediaId: string;
  try {
    mediaId = parseMediaId(formData.get("media_id"));
  } catch (error) {
    return invalidInput(error);
  }
  const { supabase, workspace } = await editor();
  if (!workspace) return { error: "Apenas owner ou admin registram licenças." };
  try {
    await registerLicense(supabase, workspace.organizationId, mediaId, fields(formData), todayInBrazil());
  } catch (error) {
    log("warn", "media.license.record", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível registrar a licença.") };
  }
  revalidatePath("/midia");
  return { ok: "Licença registrada.", at: Date.now() };
}

export async function revokeLicenseAction(_prev: MediaState, formData: FormData): Promise<MediaState> {
  let licenseId: string;
  let reason: string;
  try {
    ({ licenseId, reason } = parseRevokeInput(formData.get("license_id"), formData.get("reason")));
  } catch (error) {
    return invalidInput(error);
  }
  const { supabase, workspace } = await editor();
  if (!workspace) return { error: "Apenas owner ou admin revogam licenças." };
  try {
    await revokeLicense(supabase, licenseId, reason);
  } catch (error) {
    log("warn", "media.license.revoke", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível revogar a licença.") };
  }
  revalidatePath("/midia");
  return { ok: "Licença revogada.", at: Date.now() };
}

export async function archiveMediaAction(_prev: MediaState, formData: FormData): Promise<MediaState> {
  let mediaId: string;
  try {
    mediaId = parseMediaId(formData.get("media_id"));
  } catch (error) {
    return invalidInput(error);
  }
  const { supabase, workspace } = await editor();
  if (!workspace) return { error: "Apenas owner ou admin arquivam mídia." };
  try {
    await archiveMedia(supabase, mediaId);
  } catch (error) {
    log("warn", "media.archive", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível arquivar.") };
  }
  revalidatePath("/midia");
  return { ok: "Mídia arquivada.", at: Date.now() };
}
