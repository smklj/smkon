import { decodeCursor, toPage, type Page } from "@/lib/pagination/keyset";
import type { createClient } from "@/lib/supabase/server";
import { CONTACTS_KEYSET, CONTACT_PAGE_SIZE, contactsListQuery } from "./contacts-page";
import type { ConsentEventRow, ConsentStateRow, ContactRow, RequestRow } from "./types";
import type { ConsentEventInput, ContactInput, ContactUpdateInput, RequestInput } from "./validation";
import { sanitizeSearch } from "./validation";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export const CONTACT_COLUMNS =
  "id,display_name,email,phone,source,source_detail,purpose,legal_basis,created_at,updated_at,last_activity_at,anonymized_at";
export const CONSENT_COLUMNS = "id,contact_id,action,purpose,channel,evidence_type,evidence_ref,occurred_at,created_at";
export const REQUEST_COLUMNS = "id,contact_id,kind,received_via,details,received_at,due_at,status,resolution_note,resolved_at";

export { CONTACT_PAGE_SIZE };

/** Só owner e admin alteram cadastro, consentimento e pedidos; os demais papéis leem. */
export function canManageAudience(role: string): boolean {
  return role === "owner" || role === "admin";
}

export async function listContacts(
  supabase: SupabaseClient,
  organizationId: string,
  options: { search?: string; includeAnonymized?: boolean; cursor?: string | null; pageSize?: number } = {},
): Promise<Page<ContactRow>> {
  // Cursor inválido lança InvalidCursorError (ValidationError) antes de qualquer consulta.
  const after = decodeCursor(CONTACTS_KEYSET, options.cursor);
  const pageSize = options.pageSize ?? CONTACT_PAGE_SIZE;
  const { data, error } = await contactsListQuery(supabase.from("contacts").select(CONTACT_COLUMNS), {
    organizationId,
    term: sanitizeSearch(options.search),
    includeAnonymized: Boolean(options.includeAnonymized),
    after,
    pageSize,
  });
  if (error) throw error;
  return toPage(CONTACTS_KEYSET, (data ?? []) as unknown as ContactRow[], pageSize);
}

export async function getContact(supabase: SupabaseClient, organizationId: string, id: string): Promise<ContactRow | null> {
  const { data, error } = await supabase
    .from("contacts")
    .select(CONTACT_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ContactRow) ?? null;
}

export async function listConsentEvents(supabase: SupabaseClient, organizationId: string, contactId: string): Promise<ConsentEventRow[]> {
  const { data, error } = await supabase
    .from("consent_events")
    .select(CONSENT_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ConsentEventRow[];
}

/** Estado atual (view derivada do histórico) para vários contatos. */
export async function listConsentState(supabase: SupabaseClient, organizationId: string, contactIds: string[]): Promise<ConsentStateRow[]> {
  if (contactIds.length === 0) return [];
  const { data, error } = await supabase
    .from("contact_consent_state")
    .select("contact_id,purpose,channel,granted,occurred_at")
    .eq("organization_id", organizationId)
    .in("contact_id", contactIds);
  if (error) throw error;
  return (data ?? []) as unknown as ConsentStateRow[];
}

export async function listRequests(
  supabase: SupabaseClient,
  organizationId: string,
  options: { contactId?: string; openOnly?: boolean } = {},
): Promise<RequestRow[]> {
  let query = supabase
    .from("data_subject_requests")
    .select(REQUEST_COLUMNS)
    .eq("organization_id", organizationId)
    .order("due_at", { ascending: true })
    .limit(200);
  if (options.contactId) query = query.eq("contact_id", options.contactId);
  if (options.openOnly) query = query.eq("status", "open");
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as RequestRow[];
}

export async function createContact(supabase: SupabaseClient, organizationId: string, input: ContactInput): Promise<string> {
  const { data, error } = await supabase.rpc("create_contact", {
    p_organization_id: organizationId,
    p_display_name: input.display_name,
    p_email: input.email,
    p_phone: input.phone,
    p_source: input.source,
    p_source_detail: input.source_detail,
    p_purpose: input.purpose,
    p_legal_basis: input.legal_basis,
    p_consent_channel: input.consent?.channel,
    p_evidence_type: input.consent?.evidence_type,
    p_evidence_ref: input.consent?.evidence_ref ?? undefined,
    p_consent_occurred_at: input.consent?.occurred_at ?? undefined,
  });
  if (error) throw error;
  return data as string;
}

export async function updateContact(supabase: SupabaseClient, input: ContactUpdateInput): Promise<void> {
  const { error } = await supabase.rpc("update_contact", {
    p_contact_id: input.contactId,
    p_display_name: input.display_name,
    p_email: input.email,
    p_phone: input.phone,
    p_purpose: input.purpose,
    p_legal_basis: input.legal_basis,
  });
  if (error) throw error;
}

export async function recordConsent(supabase: SupabaseClient, input: ConsentEventInput): Promise<void> {
  const { error } = await supabase.rpc("record_consent", {
    p_contact_id: input.contactId,
    p_action: input.action,
    p_purpose: input.purpose,
    p_channel: input.channel,
    p_evidence_type: input.evidence_type,
    p_evidence_ref: input.evidence_ref ?? undefined,
    p_occurred_at: input.occurred_at ?? undefined,
  });
  if (error) throw error;
}

export async function revokeAllConsents(
  supabase: SupabaseClient,
  input: { contactId: string; evidence_type: string; evidence_ref: string | null },
): Promise<number> {
  const { data, error } = await supabase.rpc("revoke_all_consents", {
    p_contact_id: input.contactId,
    p_evidence_type: input.evidence_type,
    p_evidence_ref: input.evidence_ref ?? undefined,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function registerRequest(supabase: SupabaseClient, input: RequestInput): Promise<string> {
  const { data, error } = await supabase.rpc("register_data_subject_request", {
    p_contact_id: input.contactId,
    p_kind: input.kind,
    p_received_via: input.received_via,
    p_details: input.details ?? undefined,
    p_received_at: input.received_at ?? undefined,
  });
  if (error) throw error;
  return data as string;
}

export async function resolveRequest(
  supabase: SupabaseClient,
  input: { requestId: string; status: "completed" | "rejected"; note: string | null },
): Promise<void> {
  const { error } = await supabase.rpc("resolve_data_subject_request", {
    p_request_id: input.requestId,
    p_status: input.status,
    p_note: input.note ?? undefined,
  });
  if (error) throw error;
}

export async function anonymizeContact(supabase: SupabaseClient, input: { contactId: string; reason: string }): Promise<string> {
  const { data, error } = await supabase.rpc("anonymize_contact", { p_contact_id: input.contactId, p_reason: input.reason });
  if (error) throw error;
  return data as string;
}

/** JSON com tudo o que o workspace guarda sobre o titular. A chamada fica registrada no audit_log. */
export async function exportContactData(supabase: SupabaseClient, contactId: string): Promise<unknown> {
  const { data, error } = await supabase.rpc("export_contact_data", { p_contact_id: contactId });
  if (error) throw error;
  return data;
}
