import { test } from "node:test";
import assert from "node:assert/strict";
import { ValidationError, toErrorResponse } from "../../src/lib/http/errors.ts";
import { INVITATION_COLUMNS, INVITATION_LIST_LIMIT, type SupabaseClient } from "../../src/lib/invitations/repository.ts";
import {
  InvitationInputError,
  parseAcceptToken,
  parseInvitationId,
  parseInvitationRequest,
} from "../../src/lib/invitations/schema.ts";
import { acceptInvitation, createInvitation, listInvitations, revokeInvitation } from "../../src/lib/invitations/service.ts";
import { generateInviteToken, hashInviteToken, isWellFormedInviteToken } from "../../src/lib/invitations/token.ts";

const ORG = "11111111-2222-4333-8444-555555555555";
const INVITE = "22222222-3333-4444-8555-666666666666";

type Result = { data: unknown; error: unknown };

function fakeClient(opts: { tables?: Record<string, Result>; rpcs?: Record<string, Result> }) {
  const ops: Array<[string, ...unknown[]]> = [];
  const rpcCalls: Array<[string, Record<string, unknown>]> = [];
  const client = {
    from(table: string) {
      ops.push(["from", table]);
      const builder: Record<string, unknown> = {
        then(resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve(opts.tables?.[table] ?? { data: null, error: null }).then(resolve, reject);
        },
      };
      for (const op of ["select", "eq", "order", "limit"]) {
        builder[op] = (...args: unknown[]) => {
          ops.push([op, ...args]);
          return builder;
        };
      }
      return builder;
    },
    rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push([name, args]);
      return Promise.resolve(opts.rpcs?.[name] ?? { data: null, error: null });
    },
  };
  return { client: client as unknown as SupabaseClient, ops, rpcCalls };
}

test("schema: convite normaliza e-mail e confere e-mail antes do papel, com códigos próprios", () => {
  assert.deepEqual(parseInvitationRequest({ email: "  Ana@Exemplo.COM ", role: "analyst" }), {
    email: "ana@exemplo.com",
    role: "analyst",
  });
  const expectCode = (body: unknown, code: string, message: string) =>
    assert.throws(
      () => parseInvitationRequest(body),
      (e: unknown) => e instanceof InvitationInputError && e instanceof ValidationError && e.code === code && e.message === message,
    );
  expectCode({ email: "x", role: "nada" }, "invalid_email", "E-mail inválido.");
  expectCode(null, "invalid_email", "E-mail inválido.");
  expectCode([], "invalid_email", "E-mail inválido.");
  expectCode({ email: "a@b.co", role: "owner" }, "invalid_role", "Papel inválido para convite.");
  expectCode({ email: "a@b.co" }, "invalid_role", "Papel inválido para convite.");
});

test("schema: id de revogação e token de aceite recusados antes do banco", async () => {
  assert.equal(parseInvitationId(INVITE), INVITE);
  for (const value of [null, "", "abc", "22222222-3333-0444-8555-666666666666"]) {
    assert.throws(() => parseInvitationId(value), { message: "Identificador inválido." });
  }
  // Na rota, o ValidationError vira o mesmo 400 invalid_input de antes.
  const response = toErrorResponse("test", new ValidationError("Identificador inválido."), "x");
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Identificador inválido.", code: "invalid_input" });

  const { token } = generateInviteToken();
  assert.equal(parseAcceptToken(token), token);
  assert.throws(() => parseAcceptToken("curto"), { message: "Convite inválido, expirado ou já utilizado." });
});

test("listInvitations: workspace da sessão, sem token_hash, mais recentes primeiro, limite fixo", async () => {
  const rows = [{ id: INVITE, email: "a@b.co" }];
  const { client, ops } = fakeClient({ tables: { organization_invitations: { data: rows, error: null } } });
  assert.deepEqual(await listInvitations(client, ORG), rows);
  assert.ok(!INVITATION_COLUMNS.includes("token"));
  assert.deepEqual(ops, [
    ["from", "organization_invitations"],
    ["select", INVITATION_COLUMNS],
    ["eq", "organization_id", ORG],
    ["order", "created_at", { ascending: false }],
    ["limit", INVITATION_LIST_LIMIT],
  ]);
  const failure = { code: "42501" };
  const broken = fakeClient({ tables: { organization_invitations: { data: null, error: failure } } });
  await assert.rejects(listInvitations(broken.client, ORG), (e: unknown) => e === failure);
});

test("createInvitation: só o hash vai ao banco; o token volta apenas quando o convite é novo", async () => {
  const created = fakeClient({
    rpcs: { create_invitation: { data: [{ invitation_id: INVITE, created: true, invitation_expires_at: "2026-11-28T00:00:00Z" }], error: null } },
  });
  const result = await createInvitation(created.client, ORG, { email: "a@b.co", role: "viewer" });
  assert.equal(result.created, true);
  assert.ok(result.created && isWellFormedInviteToken(result.token));
  const [name, args] = created.rpcCalls[0];
  assert.equal(name, "create_invitation");
  assert.equal(args.p_organization_id, ORG);
  assert.equal(args.p_email, "a@b.co");
  assert.equal(args.p_role, "viewer");
  assert.equal(result.created && args.p_token_hash, result.created && hashInviteToken(result.token));
  assert.ok(!Object.values(args).includes(result.created && result.token));

  const existing = fakeClient({
    rpcs: { create_invitation: { data: { invitation_id: INVITE, created: false, invitation_expires_at: "2026-11-28T00:00:00Z" }, error: null } },
  });
  assert.deepEqual(await createInvitation(existing.client, ORG, { email: "a@b.co", role: "viewer" }), {
    created: false,
    id: INVITE,
    expiresAt: "2026-11-28T00:00:00Z",
  });

  const empty = fakeClient({ rpcs: { create_invitation: { data: [], error: null } } });
  await assert.rejects(createInvitation(empty.client, ORG, { email: "a@b.co", role: "viewer" }), {
    message: "create_invitation returned no row",
  });
  const failure = { message: "rate_limited" };
  const broken = fakeClient({ rpcs: { create_invitation: { data: null, error: failure } } });
  await assert.rejects(createInvitation(broken.client, ORG, { email: "a@b.co", role: "viewer" }), (e: unknown) => e === failure);
});

test("revogar e aceitar: RPCs com id e hash; erro do aceite é devolvido, não lançado", async () => {
  const revoked = fakeClient({});
  await revokeInvitation(revoked.client, INVITE);
  assert.deepEqual(revoked.rpcCalls, [["revoke_invitation", { p_invitation_id: INVITE }]]);

  const { token, tokenHash } = generateInviteToken();
  const accepted = fakeClient({ rpcs: { accept_invitation: { data: [{ workspace_id: ORG }], error: null } } });
  assert.deepEqual(await acceptInvitation(accepted.client, token), { workspaceId: ORG, error: null });
  assert.deepEqual(accepted.rpcCalls, [["accept_invitation", { p_token_hash: tokenHash }]]);

  const failure = { message: "invitation_invalid" };
  const rejected = fakeClient({ rpcs: { accept_invitation: { data: null, error: failure } } });
  assert.deepEqual(await acceptInvitation(rejected.client, token), { workspaceId: null, error: failure });
});
