/**
 * Audiência / CRM · schema: tipos de entrada e validação (S4).
 * Funções puras que lançam ValidationError com mensagem segura para o usuário,
 * sobre as primitivas de src/lib/validation/fields.ts. Imports relativos com
 * `.ts` para rodar em `node --test`.
 *
 * Divergências preservadas: só texto é aceito (readString, como mídia; números do
 * JSON viram vazio) e os identificadores de formulário usam o UUID pelo formato
 * (parseUuid), não o estrito das rotas.
 */
import { ValidationError } from "../http/errors.ts";
import { DATE_ONLY, WORKSPACE_OFFSET, oneOf, parseUuid, readString as text, workspaceDate, type Raw } from "../validation/fields.ts";
import {
  ANONYMIZE_CONFIRMATION,
  CONSENT_CHANNELS,
  CONTACT_SOURCES,
  EVIDENCE_TYPES,
  LEGAL_BASES,
  OPT_OUT_ONLY_EVIDENCE,
  PURPOSES,
  REQUEST_CHANNELS,
  REQUEST_KINDS,
  isBasisAllowed,
  type ConsentChannel,
  type ContactSource,
  type EvidenceType,
  type LegalBasis,
  type Purpose,
  type RequestChannel,
  type RequestKind,
} from "./types.ts";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const E164 = /^\+[1-9]\d{7,14}$/;

export { ANONYMIZE_CONFIRMATION, parseUuid };

export type ConsentInput = {
  channel: ConsentChannel;
  evidence_type: EvidenceType;
  evidence_ref: string | null;
  occurred_at: string | null;
};

export type ContactInput = {
  display_name: string | null;
  email: string | null;
  phone: string | null;
  source: ContactSource;
  source_detail: string | null;
  purpose: Purpose;
  legal_basis: LegalBasis;
  consent: ConsentInput | null;
};

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (!email) return null;
  if (email.length > 254 || !EMAIL.test(email)) throw new ValidationError("E-mail inválido.");
  return email;
}

/**
 * Telefone em E.164. Aceita "+55 11 99999-0000" ou número brasileiro com DDD
 * ("(11) 99999-0000", 10 ou 11 dígitos), que recebe o +55.
 */
export function normalizePhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[+\d\s().-]+$/.test(trimmed)) throw new ValidationError("Telefone inválido. Use +55 11 99999-0000.");
  const digits = trimmed.replace(/\D/g, "");
  const phone = trimmed.startsWith("+") ? `+${digits}` : digits.length === 10 || digits.length === 11 ? `+55${digits}` : `+${digits}`;
  if (!E164.test(phone)) throw new ValidationError("Telefone inválido. Use +55 11 99999-0000.");
  return phone;
}

/** Data do fato: campo date (AAAA-MM-DD, meio-dia de Brasília) ou ISO. Vazio = agora. */
export function parseOccurredAt(value: string, now: Date = new Date(), maxYearsBack = 5): string | null {
  if (!value) return null;
  const dateOnly = DATE_ONLY.test(value);
  const date = dateOnly ? new Date(`${value}T12:00:00${WORKSPACE_OFFSET}`) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new ValidationError("Data inválida.");
  if (dateOnly && value === workspaceDate(now)) return now.toISOString();
  if (date.getTime() > now.getTime() + 5 * 60 * 1000) throw new ValidationError("A data não pode estar no futuro.");
  const limit = new Date(now);
  limit.setFullYear(limit.getFullYear() - maxYearsBack);
  if (date.getTime() < limit.getTime()) throw new ValidationError(maxYearsBack === 1 ? "A data deve estar dentro do último ano." : `A data deve estar nos últimos ${maxYearsBack} anos.`);
  return date.toISOString();
}

function parseEvidence(raw: Raw, action: "opt_in" | "opt_out"): Pick<ConsentInput, "evidence_type" | "evidence_ref"> {
  const evidence_type = oneOf(text(raw, "evidence_type"), EVIDENCE_TYPES, "Tipo de evidência inválido.");
  const evidence_ref = text(raw, "evidence_ref") || null;
  if (action === "opt_in") {
    if (OPT_OUT_ONLY_EVIDENCE.includes(evidence_type)) throw new ValidationError("Este tipo de evidência não prova um consentimento.");
    if (!evidence_ref || evidence_ref.length < 3) {
      throw new ValidationError("Descreva a evidência do consentimento (onde e como foi dado, 3 a 500 caracteres).");
    }
  }
  if (evidence_ref && (evidence_ref.length < 3 || evidence_ref.length > 500)) {
    throw new ValidationError("A referência da evidência deve ter de 3 a 500 caracteres.");
  }
  return { evidence_type, evidence_ref };
}

export function parseContactInput(raw: Raw, now: Date = new Date()): ContactInput {
  const display_name = text(raw, "display_name") || null;
  if (display_name && display_name.length > 120) throw new ValidationError("O nome deve ter até 120 caracteres.");
  const email = normalizeEmail(text(raw, "email"));
  const phone = normalizePhone(text(raw, "phone"));
  if (!email && !phone) throw new ValidationError("Informe e-mail ou telefone.");

  const source = oneOf(text(raw, "source") || "manual", CONTACT_SOURCES, "Origem inválida.");
  const source_detail = text(raw, "source_detail") || null;
  if (source_detail && source_detail.length > 200) throw new ValidationError("O detalhe da origem deve ter até 200 caracteres.");

  const purpose = oneOf(text(raw, "purpose"), PURPOSES, "Finalidade inválida.");
  const legal_basis = oneOf(text(raw, "legal_basis"), LEGAL_BASES, "Base legal inválida.");
  if (!isBasisAllowed(purpose, legal_basis)) throw new ValidationError("Esta base legal não se aplica a esta finalidade.");

  const channel = text(raw, "consent_channel");
  let consent: ConsentInput | null = null;
  if (legal_basis === "consent" || channel) {
    consent = {
      channel: oneOf(channel, CONSENT_CHANNELS, "Escolha o canal do consentimento."),
      ...parseEvidence(raw, "opt_in"),
      occurred_at: parseOccurredAt(text(raw, "consent_occurred_at"), now),
    };
  }
  return { display_name, email, phone, source, source_detail, purpose, legal_basis, consent };
}

export type ContactUpdateInput = Omit<ContactInput, "source" | "source_detail" | "consent"> & { contactId: string };

export function parseContactUpdate(raw: Raw): ContactUpdateInput {
  const contactId = parseUuid(raw.contact_id, "Contato inválido.");
  const display_name = text(raw, "display_name") || null;
  if (display_name && display_name.length > 120) throw new ValidationError("O nome deve ter até 120 caracteres.");
  const email = normalizeEmail(text(raw, "email"));
  const phone = normalizePhone(text(raw, "phone"));
  if (!email && !phone) throw new ValidationError("Informe e-mail ou telefone.");
  const purpose = oneOf(text(raw, "purpose"), PURPOSES, "Finalidade inválida.");
  const legal_basis = oneOf(text(raw, "legal_basis"), LEGAL_BASES, "Base legal inválida.");
  if (!isBasisAllowed(purpose, legal_basis)) throw new ValidationError("Esta base legal não se aplica a esta finalidade.");
  return { contactId, display_name, email, phone, purpose, legal_basis };
}

export type ConsentEventInput = ConsentInput & { contactId: string; action: "opt_in" | "opt_out"; purpose: Purpose };

export function parseConsentEvent(raw: Raw, now: Date = new Date()): ConsentEventInput {
  const contactId = parseUuid(raw.contact_id, "Contato inválido.");
  const action = oneOf(text(raw, "action"), ["opt_in", "opt_out"] as const, "Ação inválida.");
  return {
    contactId,
    action,
    purpose: oneOf(text(raw, "purpose"), PURPOSES, "Finalidade inválida."),
    channel: oneOf(text(raw, "channel"), CONSENT_CHANNELS, "Canal inválido."),
    ...parseEvidence(raw, action),
    occurred_at: parseOccurredAt(text(raw, "occurred_at"), now),
  };
}

export function parseRevokeAll(raw: Raw): { contactId: string; evidence_type: EvidenceType; evidence_ref: string | null } {
  const contactId = parseUuid(raw.contact_id, "Contato inválido.");
  return { contactId, ...parseEvidence(raw, "opt_out") };
}

export type RequestInput = {
  contactId: string;
  kind: RequestKind;
  received_via: RequestChannel;
  details: string | null;
  received_at: string | null;
};

export function parseRequestInput(raw: Raw, now: Date = new Date()): RequestInput {
  const contactId = parseUuid(raw.contact_id, "Contato inválido.");
  const kind = oneOf(text(raw, "kind"), REQUEST_KINDS, "Tipo de pedido inválido.");
  const received_via = oneOf(text(raw, "received_via"), REQUEST_CHANNELS, "Canal de recebimento inválido.");
  const details = text(raw, "details") || null;
  if (details && details.length > 1000) throw new ValidationError("O texto do pedido deve ter até 1000 caracteres.");
  return { contactId, kind, received_via, details, received_at: parseOccurredAt(text(raw, "received_at"), now, 1) };
}

export function parseResolveInput(raw: Raw): { requestId: string; status: "completed" | "rejected"; note: string | null } {
  const requestId = parseUuid(raw.request_id, "Pedido inválido.");
  const status = oneOf(text(raw, "status"), ["completed", "rejected"] as const, "Decisão inválida.");
  const note = text(raw, "note") || null;
  if (status === "rejected" && (!note || note.length < 3)) throw new ValidationError("Informe o motivo da recusa.");
  if (note && (note.length < 3 || note.length > 1000)) throw new ValidationError("A nota deve ter de 3 a 1000 caracteres.");
  return { requestId, status, note };
}

export function parseAnonymizeInput(raw: Raw): { contactId: string; reason: string } {
  const contactId = parseUuid(raw.contact_id, "Contato inválido.");
  if (text(raw, "confirmation") !== ANONYMIZE_CONFIRMATION) {
    throw new ValidationError(`Digite ${ANONYMIZE_CONFIRMATION} para confirmar a exclusão.`);
  }
  const reason = text(raw, "reason");
  if (reason.length < 3 || reason.length > 1000) throw new ValidationError("Informe o motivo da exclusão (3 a 1000 caracteres, sem dados pessoais).");
  return { contactId, reason };
}

/** Termo de busca seguro para o filtro `or` do PostgREST (sem vírgulas, parênteses ou curingas). */
export function sanitizeSearch(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[,()*%\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

/**
 * Concluir um pedido de exclusão anonimiza o contato: exige a mesma confirmação da
 * exclusão direta. A Server Action checa antes de validar o resto (sem log).
 */
export function missingDeletionConfirmation(raw: Raw): boolean {
  return raw.kind === "deletion" && raw.status === "completed" && raw.confirmation !== ANONYMIZE_CONFIRMATION;
}
