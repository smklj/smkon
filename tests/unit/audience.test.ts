import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BASES_BY_PURPOSE,
  LEGAL_BASES,
  PURPOSES,
  contactLabel,
  deriveConsentState,
  exportFileName,
  isBasisAllowed,
  requestDeadline,
  type ConsentEventRow,
} from "../../src/lib/audience/types.ts";
import {
  ANONYMIZE_CONFIRMATION,
  normalizeEmail,
  normalizePhone,
  parseAnonymizeInput,
  parseConsentEvent,
  parseContactInput,
  parseContactUpdate,
  parseOccurredAt,
  parseRequestInput,
  parseResolveInput,
  parseRevokeAll,
  sanitizeSearch,
} from "../../src/lib/audience/validation.ts";
import { contactExportResponse } from "../../src/lib/audience/export.ts";

const ID = "11111111-2222-4333-8444-555555555555";
const NOW = new Date("2026-11-19T15:00:00Z");

test("e-mail: normaliza e recusa formato inválido", () => {
  assert.equal(normalizeEmail("  Ana@Exemplo.COM "), "ana@exemplo.com");
  assert.equal(normalizeEmail(""), null);
  assert.throws(() => normalizeEmail("ana@"), /E-mail inválido/);
  assert.throws(() => normalizeEmail("a b@c.com"), /E-mail inválido/);
});

test("telefone: E.164, com +55 para número brasileiro com DDD", () => {
  assert.equal(normalizePhone("(11) 99999-0000"), "+5511999990000");
  assert.equal(normalizePhone("11 3333-4444"), "+551133334444");
  assert.equal(normalizePhone("+1 (415) 555-0100"), "+14155550100");
  assert.equal(normalizePhone(""), null);
  assert.throws(() => normalizePhone("abc"), /Telefone inválido/);
  assert.throws(() => normalizePhone("123"), /Telefone inválido/);
});

test("base legal por finalidade espelha a constraint do banco", () => {
  assert.ok(isBasisAllowed("order_fulfillment", "contract"));
  assert.ok(!isBasisAllowed("order_fulfillment", "consent"));
  assert.ok(!isBasisAllowed("research", "legitimate_interest"));
  assert.ok(!isBasisAllowed("marketing", "contract"));
  // Mesma regra do SQL: pedido → contrato; pesquisa → consentimento; contrato só em pedido/atendimento.
  for (const purpose of PURPOSES) {
    for (const basis of LEGAL_BASES) {
      const sql =
        (purpose !== "order_fulfillment" || basis === "contract") &&
        (purpose !== "research" || basis === "consent") &&
        (basis !== "contract" || purpose === "order_fulfillment" || purpose === "customer_service");
      assert.equal(BASES_BY_PURPOSE[purpose].includes(basis), sql, `${purpose} × ${basis}`);
    }
  }
});

test("cadastro: base consentimento exige canal e evidência", () => {
  const base = { email: "ana@exemplo.com", purpose: "newsletter", legal_basis: "consent", source: "form" };
  assert.throws(() => parseContactInput(base, NOW), /canal do consentimento/);
  assert.throws(() => parseContactInput({ ...base, consent_channel: "email", evidence_type: "form_checkbox" }, NOW), /evidência/);
  assert.throws(
    () => parseContactInput({ ...base, consent_channel: "email", evidence_type: "unsubscribe_link", evidence_ref: "link" }, NOW),
    /não prova/,
  );
  const ok = parseContactInput(
    { ...base, display_name: " Ana ", consent_channel: "email", evidence_type: "double_opt_in", evidence_ref: "Confirmação #1", consent_occurred_at: "2026-11-10" },
    NOW,
  );
  assert.equal(ok.display_name, "Ana");
  assert.equal(ok.consent?.channel, "email");
  assert.equal(ok.consent?.occurred_at, "2026-11-10T15:00:00.000Z");
});

test("cadastro: exige identificador e base compatível", () => {
  assert.throws(() => parseContactInput({ purpose: "marketing", legal_basis: "legitimate_interest" }, NOW), /e-mail ou telefone/);
  assert.throws(() => parseContactInput({ phone: "11999990000", purpose: "order_fulfillment", legal_basis: "legitimate_interest" }, NOW), /não se aplica/);
  const contract = parseContactInput({ phone: "11999990000", purpose: "order_fulfillment", legal_basis: "contract", source: "purchase" }, NOW);
  assert.equal(contract.consent, null);
  assert.equal(contract.phone, "+5511999990000");
  assert.throws(() => parseContactInput({ email: "a@b.co", purpose: "x", legal_basis: "consent" }, NOW), /Finalidade/);
  assert.throws(() => parseContactInput({ email: "a@b.co", source: "comprado", purpose: "marketing", legal_basis: "legitimate_interest" }, NOW), /Origem/);
});

test("correção valida contato e base legal", () => {
  assert.throws(() => parseContactUpdate({ contact_id: "x", email: "a@b.co", purpose: "marketing", legal_basis: "consent" }), /Contato inválido/);
  const ok = parseContactUpdate({ contact_id: ID, email: "A@B.co", purpose: "marketing", legal_basis: "consent" });
  assert.equal(ok.email, "a@b.co");
});

test("data do fato: não no futuro, até 5 anos", () => {
  assert.equal(parseOccurredAt("", NOW), null);
  assert.equal(parseOccurredAt("2026-11-19", NOW), NOW.toISOString(), "hoje = agora");
  assert.throws(() => parseOccurredAt("2026-11-25", NOW), /futuro/);
  assert.throws(() => parseOccurredAt("2020-01-01", NOW), /5 anos/);
  assert.throws(() => parseOccurredAt("ontem", NOW), /Data inválida/);
});

test("consentimento: opt-in exige evidência; opt-out não", () => {
  const raw = { contact_id: ID, purpose: "marketing", channel: "whatsapp" };
  assert.throws(() => parseConsentEvent({ ...raw, action: "opt_in", evidence_type: "written" }, NOW), /evidência/);
  const out = parseConsentEvent({ ...raw, action: "opt_out", evidence_type: "unsubscribe_link" }, NOW);
  assert.equal(out.evidence_ref, null);
  assert.throws(() => parseConsentEvent({ ...raw, action: "talvez", evidence_type: "written" }, NOW), /Ação/);
  assert.throws(() => parseConsentEvent({ ...raw, channel: "fax", action: "opt_out", evidence_type: "written" }, NOW), /Canal/);
  assert.equal(parseRevokeAll({ contact_id: ID, evidence_type: "titular_request" }).evidence_type, "titular_request");
});

test("estado derivado: último fato vence; empate favorece a revogação", () => {
  const ev = (id: string, action: "opt_in" | "opt_out", occurred: string, created = occurred): ConsentEventRow => ({
    id, contact_id: "c", action, purpose: "marketing", channel: "email", evidence_type: "written",
    evidence_ref: null, occurred_at: occurred, created_at: created,
  });
  assert.equal(deriveConsentState([ev("1", "opt_in", "2026-11-01T00:00:00Z"), ev("2", "opt_out", "2026-11-02T00:00:00Z")])[0].granted, false);
  // Opt-in registrado depois, com data do fato anterior, não reativa.
  assert.equal(
    deriveConsentState([ev("2", "opt_out", "2026-11-02T00:00:00Z"), ev("3", "opt_in", "2026-10-01T00:00:00Z", "2026-11-03T00:00:00Z")])[0].granted,
    false,
  );
  assert.equal(deriveConsentState([ev("b", "opt_out", "2026-11-02T00:00:00Z"), ev("a", "opt_in", "2026-11-02T00:00:00Z")])[0].granted, false);
  assert.equal(deriveConsentState([ev("a", "opt_in", "2026-11-02T00:00:00Z")])[0].granted, true);
});

test("pedidos do titular: entrada e prazo", () => {
  const req = parseRequestInput({ contact_id: ID, kind: "deletion", received_via: "email", details: "Apaguem" }, NOW);
  assert.equal(req.kind, "deletion");
  assert.throws(() => parseRequestInput({ contact_id: ID, kind: "portabilidade", received_via: "email" }, NOW), /Tipo de pedido/);
  assert.throws(() => parseRequestInput({ contact_id: ID, kind: "access", received_via: "email", received_at: "2025-01-01" }, NOW), /último ano/);
  assert.throws(() => parseResolveInput({ request_id: ID, status: "rejected" }), /motivo/);
  assert.equal(parseResolveInput({ request_id: ID, status: "completed" }).note, null);

  assert.equal(requestDeadline({ status: "completed", due_at: "2026-01-01T00:00:00Z" }, NOW), "done");
  assert.equal(requestDeadline({ status: "open", due_at: "2026-11-18T00:00:00Z" }, NOW), "overdue");
  assert.equal(requestDeadline({ status: "open", due_at: "2026-11-21T00:00:00Z" }, NOW), "due_soon");
  assert.equal(requestDeadline({ status: "open", due_at: "2026-12-01T00:00:00Z" }, NOW), "on_time");
});

test("exclusão exige a palavra de confirmação e motivo", () => {
  assert.throws(() => parseAnonymizeInput({ contact_id: ID, confirmation: "excluir", reason: "Pedido" }), /Digite EXCLUIR/);
  assert.throws(() => parseAnonymizeInput({ contact_id: ID, confirmation: ANONYMIZE_CONFIRMATION, reason: "" }), /motivo/);
  assert.deepEqual(parseAnonymizeInput({ contact_id: ID, confirmation: "EXCLUIR", reason: "Pedido do titular" }), { contactId: ID, reason: "Pedido do titular" });
});

test("busca: remove caracteres que quebrariam o filtro do PostgREST", () => {
  assert.equal(sanitizeSearch("ana,email.eq.x)"), "ana email.eq.x");
  assert.equal(sanitizeSearch("  50%  "), "50");
  assert.equal(sanitizeSearch(42), "");
  assert.equal(sanitizeSearch("a".repeat(200)).length, 80);
});

test("exibição e exportação não expõem dado pessoal desnecessário", async () => {
  assert.equal(contactLabel({ display_name: "Ana", email: "a@b.co", phone: null, anonymized_at: "2026-11-19" }), "Titular anonimizado");
  assert.equal(contactLabel({ display_name: null, email: "a@b.co", phone: null, anonymized_at: null }), "a@b.co");
  assert.equal(exportFileName(ID, NOW), "smkon-titular-11111111-2026-11-19.json");

  const response = contactExportResponse(ID, { contact: { email: "a@b.co" } }, NOW);
  assert.equal(response.headers.get("cache-control"), "no-store, private");
  assert.match(response.headers.get("content-disposition") ?? "", /attachment; filename="smkon-titular-11111111-2026-11-19\.json"/);
  assert.doesNotMatch(response.headers.get("content-disposition") ?? "", /a@b\.co/);
  assert.deepEqual(JSON.parse(await response.text()), { contact: { email: "a@b.co" } });
});
