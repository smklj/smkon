/**
 * Publicação · schema: validação dos formulários do calendário (S4).
 * Mensagens idênticas às das Server Actions originais. Os campos não são
 * aparados (exceto o motivo do cancelamento), como antes.
 */
import { ValidationError } from "../http/errors.ts";
import { isUuid, type Raw } from "../validation/fields.ts";
import { isPublicationChannel, parseScheduleInput, type PublicationChannel } from "./types.ts";

export type ScheduleRequest = { contentId: string; channel: PublicationChannel; scheduledFor: string };
export type CancelRequest = { jobId: string; reason: string };

function field(raw: Raw, key: string): string {
  const value = raw[key];
  return typeof value === "string" ? value : "";
}

/** Agendar: conteúdo aprovado (UUID), canal da lista e horário de Brasília na janela aceita pelo banco. */
export function parseScheduleRequest(raw: Raw, now: Date = new Date()): ScheduleRequest {
  const contentId = field(raw, "content_id");
  const channel = field(raw, "channel");
  if (!isUuid(contentId)) throw new ValidationError("Escolha um conteúdo aprovado.");
  if (!isPublicationChannel(channel)) throw new ValidationError("Canal inválido.");
  let scheduledFor: string;
  try {
    scheduledFor = parseScheduleInput(field(raw, "scheduled_for"), now);
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : "Data inválida.");
  }
  return { contentId, channel, scheduledFor };
}

/** Rodar o dry-run: id do agendamento. */
export function parseJobId(raw: Raw): string {
  const jobId = field(raw, "job_id");
  if (!isUuid(jobId)) throw new ValidationError("Agendamento inválido.");
  return jobId;
}

/** Cancelar: id do agendamento e motivo com ao menos 3 caracteres. */
export function parseCancelRequest(raw: Raw): CancelRequest {
  const jobId = parseJobId(raw);
  const reason = field(raw, "reason").trim();
  if (reason.length < 3) throw new ValidationError("Informe o motivo do cancelamento.");
  return { jobId, reason };
}
