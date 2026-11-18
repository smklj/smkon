"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid } from "@/lib/content/server";
import { dbErrorMessage } from "@/lib/http/errors";
import { errorFields, log } from "@/lib/observability/log";
import { cancelPublication, runDryRun, schedulePublication } from "@/lib/publication/server";
import { isPublicationChannel, parseScheduleInput, PUBLICATION_STATUS_LABEL } from "@/lib/publication/types";
import { createClient } from "@/lib/supabase/server";
import { canEditContent, findWorkspace } from "@/lib/tenancy/workspace";

export type CalendarState = { error?: string; ok?: string; at?: number } | null;

async function editor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/calendario");
  const workspace = await findWorkspace(supabase, user.id);
  return { supabase, allowed: Boolean(workspace && canEditContent(workspace.role)) };
}

export async function scheduleAction(_prev: CalendarState, formData: FormData): Promise<CalendarState> {
  const contentId = String(formData.get("content_id") ?? "");
  const channel = String(formData.get("channel") ?? "");
  if (!isUuid(contentId)) return { error: "Escolha um conteúdo aprovado." };
  if (!isPublicationChannel(channel)) return { error: "Canal inválido." };
  let scheduledFor: string;
  try {
    scheduledFor = parseScheduleInput(String(formData.get("scheduled_for") ?? ""));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Data inválida." };
  }
  const { supabase, allowed } = await editor();
  if (!allowed) return { error: "Apenas owner ou admin agendam publicações." };
  try {
    await schedulePublication(supabase, contentId, channel, scheduledFor);
  } catch (error) {
    log("warn", "publication.schedule", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível agendar.") };
  }
  revalidatePath("/calendario");
  return { ok: "Agendado em modo dry-run. Nada será publicado.", at: Date.now() };
}

export async function dryRunAction(_prev: CalendarState, formData: FormData): Promise<CalendarState> {
  const jobId = String(formData.get("job_id") ?? "");
  if (!isUuid(jobId)) return { error: "Agendamento inválido." };
  const { supabase, allowed } = await editor();
  if (!allowed) return { error: "Apenas owner ou admin rodam o dry-run." };
  try {
    const status = await runDryRun(supabase, jobId);
    revalidatePath("/calendario");
    return { ok: PUBLICATION_STATUS_LABEL[status] ?? "Dry-run concluído.", at: Date.now() };
  } catch (error) {
    log("warn", "publication.dry_run", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível rodar o dry-run.") };
  }
}

export async function cancelAction(_prev: CalendarState, formData: FormData): Promise<CalendarState> {
  const jobId = String(formData.get("job_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!isUuid(jobId)) return { error: "Agendamento inválido." };
  if (reason.length < 3) return { error: "Informe o motivo do cancelamento." };
  const { supabase, allowed } = await editor();
  if (!allowed) return { error: "Apenas owner ou admin cancelam." };
  try {
    await cancelPublication(supabase, jobId, reason);
  } catch (error) {
    log("warn", "publication.cancel", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível cancelar.") };
  }
  revalidatePath("/calendario");
  return { ok: "Agendamento cancelado.", at: Date.now() };
}
