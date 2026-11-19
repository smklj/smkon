/** S15 — audiência e consentimento (LGPD). Espelha as constraints de `20261119110000_audience_consent.sql`. */

export const CONTACT_SOURCES = ["manual", "form", "event", "purchase", "social", "import"] as const;
export type ContactSource = (typeof CONTACT_SOURCES)[number];

export const PURPOSES = ["marketing", "newsletter", "customer_service", "order_fulfillment", "research"] as const;
export type Purpose = (typeof PURPOSES)[number];

export const LEGAL_BASES = ["consent", "legitimate_interest", "contract"] as const;
export type LegalBasis = (typeof LEGAL_BASES)[number];

export const CONSENT_CHANNELS = ["email", "whatsapp", "sms", "phone", "social_dm"] as const;
export type ConsentChannel = (typeof CONSENT_CHANNELS)[number];

export const EVIDENCE_TYPES = [
  "form_checkbox",
  "double_opt_in",
  "written",
  "recorded_call",
  "unsubscribe_link",
  "titular_request",
  "import",
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

/** Tipos de evidência que não provam um opt-in. */
export const OPT_OUT_ONLY_EVIDENCE: readonly EvidenceType[] = ["unsubscribe_link"];

export const REQUEST_KINDS = ["access", "correction", "deletion"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

export const REQUEST_CHANNELS = ["email", "form", "phone", "in_person", "internal"] as const;
export type RequestChannel = (typeof REQUEST_CHANNELS)[number];

export type RequestStatus = "open" | "completed" | "rejected";

/** Palavra que a pessoa digita para confirmar a exclusão. */
export const ANONYMIZE_CONFIRMATION = "EXCLUIR";

/** Prazo do art. 19, II da LGPD. */
export const REQUEST_DEADLINE_DAYS = 15;

export const SOURCE_LABEL: Record<ContactSource, string> = {
  manual: "Cadastro manual",
  form: "Formulário",
  event: "Evento",
  purchase: "Compra",
  social: "Rede social",
  import: "Importação",
};

export const PURPOSE_LABEL: Record<Purpose, string> = {
  marketing: "Marketing",
  newsletter: "Newsletter",
  customer_service: "Atendimento",
  order_fulfillment: "Pedido e entrega",
  research: "Pesquisa",
};

export const LEGAL_BASIS_LABEL: Record<LegalBasis, string> = {
  consent: "Consentimento",
  legitimate_interest: "Legítimo interesse",
  contract: "Execução de contrato",
};

export const CHANNEL_LABEL: Record<ConsentChannel, string> = {
  email: "E-mail",
  whatsapp: "WhatsApp",
  sms: "SMS",
  phone: "Telefone",
  social_dm: "Mensagem em rede social",
};

export const EVIDENCE_LABEL: Record<EvidenceType, string> = {
  form_checkbox: "Caixa marcada em formulário",
  double_opt_in: "Confirmação dupla (double opt-in)",
  written: "Termo escrito",
  recorded_call: "Ligação gravada",
  unsubscribe_link: "Link de descadastro",
  titular_request: "Pedido do titular",
  import: "Importação com prova de origem",
};

export const REQUEST_KIND_LABEL: Record<RequestKind, string> = {
  access: "Acesso e cópia dos dados",
  correction: "Correção",
  deletion: "Exclusão",
};

export const REQUEST_CHANNEL_LABEL: Record<RequestChannel, string> = {
  email: "E-mail",
  form: "Formulário",
  phone: "Telefone",
  in_person: "Presencial",
  internal: "Interno",
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  open: "Aberto",
  completed: "Concluído",
  rejected: "Recusado",
};

/** Bases aceitas por finalidade — mesma regra da constraint `contacts_basis_purpose`. */
export const BASES_BY_PURPOSE: Record<Purpose, readonly LegalBasis[]> = {
  marketing: ["consent", "legitimate_interest"],
  newsletter: ["consent", "legitimate_interest"],
  customer_service: ["contract", "legitimate_interest", "consent"],
  order_fulfillment: ["contract"],
  research: ["consent"],
};

export function isBasisAllowed(purpose: Purpose, basis: LegalBasis): boolean {
  return BASES_BY_PURPOSE[purpose].includes(basis);
}

export type ContactRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  source: ContactSource;
  source_detail: string | null;
  purpose: Purpose;
  legal_basis: LegalBasis;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  anonymized_at: string | null;
};

export type ConsentEventRow = {
  id: string;
  contact_id: string;
  action: "opt_in" | "opt_out";
  purpose: Purpose;
  channel: ConsentChannel;
  evidence_type: EvidenceType;
  evidence_ref: string | null;
  occurred_at: string;
  created_at: string;
};

export type ConsentStateRow = {
  contact_id: string;
  purpose: Purpose;
  channel: ConsentChannel;
  granted: boolean;
  occurred_at: string;
};

export type RequestRow = {
  id: string;
  contact_id: string;
  kind: RequestKind;
  received_via: RequestChannel;
  details: string | null;
  received_at: string;
  due_at: string;
  status: RequestStatus;
  resolution_note: string | null;
  resolved_at: string | null;
};

/** Nome para exibir sem expor mais que o necessário. */
export function contactLabel(contact: Pick<ContactRow, "display_name" | "email" | "phone" | "anonymized_at">): string {
  if (contact.anonymized_at) return "Titular anonimizado";
  return contact.display_name || contact.email || contact.phone || "Sem identificação";
}

/** Último evento por finalidade × canal (pela data do fato; empate → revogação). Igual à view do banco. */
export function deriveConsentState(events: readonly ConsentEventRow[]): ConsentStateRow[] {
  const latest = new Map<string, ConsentEventRow>();
  for (const event of events) {
    const key = `${event.contact_id}|${event.purpose}|${event.channel}`;
    const current = latest.get(key);
    if (!current || compareEvents(event, current) > 0) latest.set(key, event);
  }
  return Array.from(latest.values())
    .map((event) => ({
      contact_id: event.contact_id,
      purpose: event.purpose,
      channel: event.channel,
      granted: event.action === "opt_in",
      occurred_at: event.occurred_at,
    }))
    .sort((a, b) => a.purpose.localeCompare(b.purpose) || a.channel.localeCompare(b.channel));
}

function compareEvents(a: ConsentEventRow, b: ConsentEventRow): number {
  const byOccurred = Date.parse(a.occurred_at) - Date.parse(b.occurred_at);
  if (byOccurred !== 0) return byOccurred;
  const byCreated = Date.parse(a.created_at) - Date.parse(b.created_at);
  if (byCreated !== 0) return byCreated;
  if (a.action !== b.action) return a.action === "opt_out" ? 1 : -1;
  return a.id.localeCompare(b.id);
}

export type DeadlineStatus = "done" | "overdue" | "due_soon" | "on_time";

/** Situação do prazo de um pedido. "due_soon" = vence em até 3 dias. */
export function requestDeadline(request: Pick<RequestRow, "status" | "due_at">, now: Date = new Date()): DeadlineStatus {
  if (request.status !== "open") return "done";
  const remaining = Date.parse(request.due_at) - now.getTime();
  if (remaining < 0) return "overdue";
  if (remaining <= 3 * 24 * 60 * 60 * 1000) return "due_soon";
  return "on_time";
}

/** Nome do arquivo de exportação: não leva dado pessoal. */
export function exportFileName(contactId: string, now: Date = new Date()): string {
  return `smkon-titular-${contactId.slice(0, 8)}-${now.toISOString().slice(0, 10)}.json`;
}
