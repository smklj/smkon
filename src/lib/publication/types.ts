/** S10a — fila de publicação em dry-run. Espelha as constraints do banco. */

export const PUBLICATION_CHANNELS = ["YouTube", "Instagram", "TikTok"] as const;
export type PublicationChannel = (typeof PUBLICATION_CHANNELS)[number];

export type PublicationStatus = "scheduled" | "dry_run_passed" | "dry_run_failed" | "cancelled";

export const PUBLICATION_STATUS_LABEL: Record<PublicationStatus, string> = {
  scheduled: "Agendado",
  dry_run_passed: "Dry-run aprovado",
  dry_run_failed: "Dry-run reprovado",
  cancelled: "Cancelado",
};

export const PUBLICATION_STATUS_TONE: Record<PublicationStatus, "neutral" | "info" | "ok" | "warn" | "danger"> = {
  scheduled: "info",
  dry_run_passed: "ok",
  dry_run_failed: "danger",
  cancelled: "neutral",
};

export type PublicationCheck = {
  check: string;
  severity: "error" | "warning";
  ok: boolean;
  detail: string;
};

export type PublicationJobRow = {
  id: string;
  content_item_id: string;
  content_version: number;
  channel: PublicationChannel;
  scheduled_for: string;
  status: PublicationStatus;
  checks: PublicationCheck[];
  last_run_at: string | null;
  cancel_reason: string | null;
  content_title: string;
};

/** Fuso do workspace. O Brasil não tem horário de verão desde 2019. */
export const WORKSPACE_TIMEZONE = "America/Sao_Paulo";
const WORKSPACE_OFFSET = "-03:00";

export function isPublicationChannel(value: string): value is PublicationChannel {
  return (PUBLICATION_CHANNELS as readonly string[]).includes(value);
}

/**
 * Converte o valor de um <input type="datetime-local"> (horário de Brasília) em ISO UTC
 * e valida a janela aceita pelo banco: mais de 1 minuto no futuro e até 365 dias.
 */
export function parseScheduleInput(value: string, now: Date = new Date()): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Informe data e hora.");
  const date = new Date(`${value}:00${WORKSPACE_OFFSET}`);
  if (Number.isNaN(date.getTime())) throw new Error("Data inválida.");
  if (date.getTime() <= now.getTime() + 60_000) throw new Error("Escolha um horário no futuro.");
  if (date.getTime() > now.getTime() + 365 * 24 * 60 * 60 * 1000) throw new Error("Agende com até 1 ano de antecedência.");
  return date.toISOString();
}

/** Valor inicial do campo: amanhã às 10h, horário de Brasília. */
export function defaultScheduleValue(now: Date = new Date()): string {
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  brt.setUTCDate(brt.getUTCDate() + 1);
  return `${brt.toISOString().slice(0, 10)}T10:00`;
}

export type ChecksSummary = { total: number; passed: number; errors: number; warnings: number };

/** Conta as verificações do dry-run: bloqueio = erro que falhou; aviso = alerta que falhou. */
export function summarizeChecks(checks: readonly PublicationCheck[]): ChecksSummary {
  let errors = 0;
  let warnings = 0;
  for (const check of checks) {
    if (check.ok) continue;
    if (check.severity === "error") errors += 1;
    else warnings += 1;
  }
  return { total: checks.length, passed: checks.length - errors - warnings, errors, warnings };
}

/** Texto curto do resumo, exibido com a lista recolhida. */
export function checksSummaryLabel(summary: ChecksSummary): string {
  const parts = [`${summary.total} ${summary.total === 1 ? "verificação" : "verificações"}`];
  if (summary.errors) parts.push(`${summary.errors} ${summary.errors === 1 ? "bloqueio" : "bloqueios"}`);
  if (summary.warnings) parts.push(`${summary.warnings} ${summary.warnings === 1 ? "aviso" : "avisos"}`);
  if (!summary.errors && !summary.warnings) parts.push(summary.total === 1 ? "aprovada" : "todas aprovadas");
  return parts.join(" · ");
}

export function toChecks(value: unknown): PublicationCheck[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is PublicationCheck =>
      typeof item === "object" && item !== null && typeof (item as PublicationCheck).detail === "string",
  );
}
