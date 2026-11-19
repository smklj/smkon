"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbErrorMessage } from "@/lib/http/errors";
import { errorFields, log } from "@/lib/observability/log";
import { parseCancelRequest, parseJobId, parseScheduleRequest } from "@/lib/publication/schema";
import { canOperateCalendar, cancelJob, runJobDryRun, scheduleDryRun } from "@/lib/publication/service";
import { PUBLICATION_STATUS_LABEL } from "@/lib/publication/types";
import { createClient } from "@/lib/supabase/server";
import { findWorkspace } from "@/lib/tenancy/workspace";
import { formDataToRaw } from "@/lib/validation/fields";

export type CalendarState = { error?: string; ok?: string; at?: number } | null;

async function editor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/calendario");
  const workspace = await findWorkspace(supabase, user.id);
  return { supabase, allowed: Boolean(workspace && canOperateCalendar(workspace.role)) };
}

export async function scheduleAction(_prev: CalendarState, formData: FormData): Promise<CalendarState> {
  let input: ReturnType<typeof parseScheduleRequest>;
  try {
    input = parseScheduleRequest(formDataToRaw(formData));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Data inválida." };
  }
  const { supabase, allowed } = await editor();
  if (!allowed) return { error: "Apenas owner ou admin agendam publicações." };
  try {
    await scheduleDryRun(supabase, input);
  } catch (error) {
    log("warn", "publication.schedule", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível agendar.") };
  }
  revalidatePath("/calendario");
  return { ok: "Agendado em modo dry-run. Nada será publicado.", at: Date.now() };
}

export async function dryRunAction(_prev: CalendarState, formData: FormData): Promise<CalendarState> {
  let jobId: string;
  try {
    jobId = parseJobId(formDataToRaw(formData));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Agendamento inválido." };
  }
  const { supabase, allowed } = await editor();
  if (!allowed) return { error: "Apenas owner ou admin rodam o dry-run." };
  try {
    const status = await runJobDryRun(supabase, jobId);
    revalidatePath("/calendario");
    return { ok: PUBLICATION_STATUS_LABEL[status] ?? "Dry-run concluído.", at: Date.now() };
  } catch (error) {
    log("warn", "publication.dry_run", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível rodar o dry-run.") };
  }
}

export async function cancelAction(_prev: CalendarState, formData: FormData): Promise<CalendarState> {
  let input: ReturnType<typeof parseCancelRequest>;
  try {
    input = parseCancelRequest(formDataToRaw(formData));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Agendamento inválido." };
  }
  const { supabase, allowed } = await editor();
  if (!allowed) return { error: "Apenas owner ou admin cancelam." };
  try {
    await cancelJob(supabase, input);
  } catch (error) {
    log("warn", "publication.cancel", errorFields(error));
    return { error: dbErrorMessage(error, "Não foi possível cancelar.") };
  }
  revalidatePath("/calendario");
  return { ok: "Agendamento cancelado.", at: Date.now() };
}
