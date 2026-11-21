import { test } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "../../src/lib/http/errors.ts";
import {
  CONSENT_COLUMNS,
  CONTACT_COLUMNS,
  REQUEST_COLUMNS,
  getContact,
  listConsentEvents,
  listConsentState,
  listRequests,
  type SupabaseClient,
} from "../../src/lib/audience/repository.ts";
import {
  ANONYMIZE_CONFIRMATION,
  missingDeletionConfirmation,
  parseOccurredAt,
  parseUuid,
} from "../../src/lib/audience/schema.ts";
import * as legacy from "../../src/lib/audience/validation.ts";
import {
  canManageAudience,
  correctContact,
  eraseContact,
  recordConsentEvent,
  registerContact,
  registerSubjectRequest,
  resolveSubjectRequest,
  revokeAll,
} from "../../src/lib/audience/service.ts";
import { parseUuid as centralParseUuid } from "../../src/lib/validation/fields.ts";

const ORG = "11111111-2222-4333-8444-555555555555";
const CONTACT = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";
const REQUEST = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const NOW = new Date("2026-11-21T15:00:00.000Z");

type Result = { data: unknown; error: unknown };
type Call = { table: string; ops: Array<[string, ...unknown[]]> };

/** Cliente falso: registra cadeias de consulta e chamadas de RPC e devolve os resultados configurados. */
function fakeClient(results: { tables?: Record<string, Result>; rpc?: Record<string, Result> } = {}) {
  const calls: Call[] = [];
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const client = {
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const result = () => results.tables?.[table] ?? { data: [], error: null };
      const builder: Record<string, unknown> = {
        then(resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve(result()).then(resolve, reject);
        },
        maybeSingle() {
          call.ops.push(["maybeSingle"]);
          return Promise.resolve(result());
        },
      };
      for (const op of ["select", "eq", "in", "order", "limit", "is"]) {
        builder[op] = (...args: unknown[]) => {
          call.ops.push([op, ...args]);
          return builder;
        };
      }
      return builder;
    },
    rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args });
      return Promise.resolve(results.rpc?.[fn] ?? { data: null, error: null });
    },
  };
  return { client: client as unknown as SupabaseClient, calls, rpcCalls };
}

test("schema: validation.ts continua reexportando o schema (compatibilidade dos testes antigos)", () => {
  assert.equal(typeof legacy.parseContactInput, "function");
  assert.equal(legacy.ANONYMIZE_CONFIRMATION, ANONYMIZE_CONFIRMATION);
  assert.equal(parseUuid, centralParseUuid);
  assert.equal(legacy.parseUuid, centralParseUuid);
});

test("schema: parseUuid central mantém o formato 8-4-4-4-12 e a mensagem por campo", () => {
  // Formato aceito mesmo sem versão/variante RFC (comportamento antigo dos formulários de audiência).
  assert.equal(parseUuid("00000000-0000-0000-0000-000000000000"), "00000000-0000-0000-0000-000000000000");
  assert.throws(() => parseUuid("nao-e-uuid", "Contato inválido."), (error) => error instanceof ValidationError && error.message === "Contato inválido.");
  assert.throws(() => parseUuid(42), /Registro inválido/);
});

test("schema: data do fato no fuso do workspace (meio-dia de Brasília; hoje vira agora)", () => {
  assert.equal(parseOccurredAt("", NOW), null);
  // 21/11 às 12:00 em Brasília ainda é "hoje" para NOW (15:00 UTC = 12:00 BRT): devolve o instante atual.
  assert.equal(parseOccurredAt("2026-11-21", NOW), NOW.toISOString());
  assert.equal(parseOccurredAt("2026-11-20", NOW), "2026-11-20T15:00:00.000Z");
  assert.throws(() => parseOccurredAt("2026-11-23", NOW), /futuro/);
  assert.throws(() => parseOccurredAt("2020-01-01", NOW), /últimos 5 anos/);
  assert.throws(() => parseOccurredAt("2025-01-01", NOW, 1), /último ano/);
  assert.throws(() => parseOccurredAt("ontem", NOW), /Data inválida/);
});

test("schema: concluir exclusão sem a confirmação é detectado antes da validação", () => {
  assert.equal(missingDeletionConfirmation({ kind: "deletion", status: "completed" }), true);
  assert.equal(missingDeletionConfirmation({ kind: "deletion", status: "completed", confirmation: "excluir" }), true);
  assert.equal(missingDeletionConfirmation({ kind: "deletion", status: "completed", confirmation: ANONYMIZE_CONFIRMATION }), false);
  assert.equal(missingDeletionConfirmation({ kind: "deletion", status: "rejected" }), false);
  assert.equal(missingDeletionConfirmation({ kind: "access", status: "completed" }), false);
});

test("service: só owner e admin gerenciam a audiência", () => {
  assert.equal(canManageAudience("owner"), true);
  assert.equal(canManageAudience("admin"), true);
  for (const role of ["editor", "member", "viewer", "analyst", ""]) assert.equal(canManageAudience(role), false);
});

test("repository: leituras sempre filtram pelo workspace", async () => {
  const { client, calls } = fakeClient({ tables: { contacts: { data: { id: CONTACT }, error: null } } });
  await getContact(client, ORG, CONTACT);
  await listConsentEvents(client, ORG, CONTACT);
  await listConsentState(client, ORG, [CONTACT]);
  await listRequests(client, ORG, { contactId: CONTACT, openOnly: true });
  assert.deepEqual(
    calls.map((call) => call.table),
    ["contacts", "consent_events", "contact_consent_state", "data_subject_requests"],
  );
  for (const call of calls) assert.deepEqual(call.ops.find((op) => op[0] === "eq"), ["eq", "organization_id", ORG], call.table);
  assert.deepEqual(calls[0].ops[0], ["select", CONTACT_COLUMNS]);
  assert.deepEqual(calls[1].ops[0], ["select", CONSENT_COLUMNS]);
  assert.deepEqual(calls[3].ops[0], ["select", REQUEST_COLUMNS]);
  assert.ok(calls[3].ops.some((op) => op[0] === "eq" && op[1] === "status" && op[2] === "open"));
  assert.ok(calls[3].ops.some((op) => op[0] === "limit" && op[1] === 200));
});

test("repository: estado de consentimento sem contatos não consulta o banco", async () => {
  const { client, calls } = fakeClient();
  assert.deepEqual(await listConsentState(client, ORG, []), []);
  assert.equal(calls.length, 0);
});

test("service: entrada inválida é recusada antes de qualquer RPC", async () => {
  const { client, rpcCalls } = fakeClient();
  await assert.rejects(registerContact(client, ORG, { purpose: "marketing" }, NOW), /Informe e-mail ou telefone/);
  await assert.rejects(correctContact(client, { contact_id: "x" }), /Contato inválido/);
  await assert.rejects(recordConsentEvent(client, { contact_id: CONTACT, action: "talvez" }, NOW), /Ação inválida/);
  await assert.rejects(revokeAll(client, { contact_id: CONTACT, evidence_type: "?" }), /Tipo de evidência/);
  await assert.rejects(registerSubjectRequest(client, { contact_id: CONTACT, kind: "?" }, NOW), /Tipo de pedido/);
  await assert.rejects(resolveSubjectRequest(client, { request_id: REQUEST, status: "rejected" }), /motivo da recusa/);
  await assert.rejects(eraseContact(client, { contact_id: CONTACT, confirmation: "não" }), /para confirmar/);
  assert.equal(rpcCalls.length, 0);
});

test("service: casos de uso chamam a RPC com a entrada validada e devolvem o resultado", async () => {
  const { client, rpcCalls } = fakeClient({
    rpc: {
      create_contact: { data: CONTACT, error: null },
      revoke_all_consents: { data: 2, error: null },
      register_data_subject_request: { data: REQUEST, error: null },
    },
  });
  const id = await registerContact(client, ORG, { email: " Ana@Exemplo.com ", purpose: "order_fulfillment", legal_basis: "contract" }, NOW);
  assert.equal(id, CONTACT);
  assert.equal(rpcCalls[0].fn, "create_contact");
  assert.equal(rpcCalls[0].args.p_organization_id, ORG);
  assert.equal(rpcCalls[0].args.p_email, "ana@exemplo.com");
  assert.equal(rpcCalls[0].args.p_source, "manual");

  const action = await recordConsentEvent(
    client,
    { contact_id: CONTACT, action: "opt_out", purpose: "marketing", channel: "email", evidence_type: "unsubscribe_link" },
    NOW,
  );
  assert.equal(action, "opt_out");
  assert.equal(rpcCalls[1].fn, "record_consent");

  assert.equal(await revokeAll(client, { contact_id: CONTACT, evidence_type: "unsubscribe_link" }), 2);
  assert.equal(await registerSubjectRequest(client, { contact_id: CONTACT, kind: "access", received_via: "email" }, NOW), REQUEST);

  const status = await resolveSubjectRequest(client, { request_id: REQUEST, status: "completed" });
  assert.equal(status, "completed");
  assert.deepEqual(rpcCalls.at(-1), {
    fn: "resolve_data_subject_request",
    args: { p_request_id: REQUEST, p_status: "completed", p_note: undefined },
  });
});

test("service: erro do banco é propagado sem ser engolido", async () => {
  const dbError = { code: "42501", message: "permission denied" };
  const { client } = fakeClient({ rpc: { anonymize_contact: { data: null, error: dbError } } });
  await assert.rejects(
    eraseContact(client, { contact_id: CONTACT, confirmation: ANONYMIZE_CONFIRMATION, reason: "pedido do titular" }),
    (error) => error === dbError,
  );
});
