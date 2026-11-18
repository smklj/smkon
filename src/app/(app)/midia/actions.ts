"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid } from "@/lib/content/server";
import { dbErrorMessage } from "@/lib/http/errors";
import { archiveMedia, recordLicense, registerMedia, revokeLicense } from "@/lib/media/server";
import { todayInBrazil } from "@/lib/media/types";
import { parseLicenseInput } from "@/lib/media/validation";
import { errorFields, log } from "@/lib/observability/log";
import { createClient } from "@/lib/supabase/server";
import { canEditContent, findWorkspace } from "@/lib/tenancy/workspace";

export type MediaState = { error?: string; ok?: string; at?: number } | null;

async function editor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/midia");
  const workspace = await findWorkspace(supabase, user.id);
  return { supabase, workspace: workspace && canEditContent(workspace.role) ? workspace : null };
}

function fields(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(Array.from(formData.entries()).filter(([, value]) => typeof value === "string"));
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
  const mediaId = String(formData.get("media_id") ?? "");
  if (!isUuid(mediaId)) return { error: "Mídia inválida." };
  const { supabase, workspace } = await editor();
  if (!workspace) return { error: "Apenas owner ou admin registram licenças." };
  try {
    await recordLicense(supabase, workspace.organizationId, mediaId, parseLicenseInput(fields(formData), todayInBrazil()));
  } catch (error) {
    log("warn", "media.license.record", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível registrar a licença.") };
  }
  revalidatePath("/midia");
  return { ok: "Licença registrada.", at: Date.now() };
}

export async function revokeLicenseAction(_prev: MediaState, formData: FormData): Promise<MediaState> {
  const licenseId = String(formData.get("license_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!isUuid(licenseId)) return { error: "Licença inválida." };
  if (reason.length < 3) return { error: "Informe o motivo da revogação." };
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
  const mediaId = String(formData.get("media_id") ?? "");
  if (!isUuid(mediaId)) return { error: "Mídia inválida." };
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
