/**
 * Publicação · service: regras e casos de uso do calendário (S4).
 * Regra permanente: tudo aqui roda em dry-run. Agendar exige conteúdo aprovado na
 * versão exata (conferido pelo banco) e nenhum caminho publica em rede social.
 */
import { canEditContent } from "@/lib/tenancy/workspace";
import { cancelPublication, runDryRun, schedulePublication, type SupabaseClient } from "./repository";
import type { CancelRequest, ScheduleRequest } from "./schema";
import type { PublicationStatus } from "./types";

/** Agendar, rodar dry-run e cancelar: os mesmos papéis que editam conteúdo (owner ou admin). */
export function canOperateCalendar(role: Parameters<typeof canEditContent>[0]): boolean {
  return canEditContent(role);
}

export function scheduleDryRun(supabase: SupabaseClient, input: ScheduleRequest): Promise<string> {
  return schedulePublication(supabase, input.contentId, input.channel, input.scheduledFor);
}

export function runJobDryRun(supabase: SupabaseClient, jobId: string): Promise<PublicationStatus> {
  return runDryRun(supabase, jobId);
}

export function cancelJob(supabase: SupabaseClient, input: CancelRequest): Promise<void> {
  return cancelPublication(supabase, input.jobId, input.reason);
}
