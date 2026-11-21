import { test } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "../../src/lib/http/errors.ts";
import { setLogSinks } from "../../src/lib/observability/log.ts";
import { MEMBERSHIP_COLUMNS, type SupabaseClient } from "../../src/lib/tenancy/repository.ts";
import { parseMemberId, parseMemberRoleChange, parseWorkspaceId } from "../../src/lib/tenancy/schema.ts";
import {
  canEditContent,
  canManageInvitations,
  changeMemberRole,
  ensureWorkspace,
  findWorkspace,
  listMembers,
  loadWorkspaceContext,
  removeMember,
  setActiveWorkspace,
} from "../../src/lib/tenancy/service.ts";

const ORG_A = "11111111-2222-4333-8444-555555555555";
const ORG_B = "22222222-3333-4444-8555-666666666666";
const USER = "33333333-4444-4555-8666-777777777777";

type Result = { data: unknown; error: unknown };
type Call = { table: string; ops: Array<[string, ...unknown[]]> };

/** Cliente falso: tabelas (cadeia de chamadas registrada), RPCs e auth.getUser. */
function fakeClient(opts: {
  tables?: Record<string, Result>;
  rpcs?: Record<string, Result>;
  user?: { id: string } | null;
}) {
  const calls: Call[] = [];
  const rpcCalls: Array<[string, unknown]> = [];
  const client = {
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const result = () => Promise.resolve(opts.tables?.[table] ?? { data: null, error: null });
      const builder: Record<string, unknown> = {
        then(resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) {
          return result().then(resolve, reject);
        },
        maybeSingle() {
          call.ops.push(["maybeSingle"]);
          return result();
        },
      };
      for (const op of ["select", "eq", "order", "limit"]) {
        builder[op] = (...args: unknown[]) => {
          call.ops.push([op, ...args]);
          return builder;
        };
      }
      return builder;
    },
    rpc(name: string, args?: unknown) {
      rpcCalls.push([name, args]);
      return Promise.resolve(opts.rpcs?.[name] ?? { data: null, error: null });
    },
    auth: {
      getUser: () => Promise.resolve({ data: { user: opts.user ?? null }, error: null }),
    },
  };
  return { client: client as unknown as SupabaseClient, calls, rpcCalls };
}

const memberships = {
  data: [
    { organization_id: ORG_A, role: "owner", created_at: "2026-11-01T10:00:00Z", organizations: { name: " Loja A " } },
    { organization_id: ORG_B, role: "viewer", created_at: "2026-11-10T10:00:00Z", organizations: null },
    { organization_id: "x", role: "superuser", created_at: "2026-11-11T10:00:00Z", organizations: null },
  ],
  error: null,
};

// ---------------------------------------------------------------------------
// schema
// ---------------------------------------------------------------------------

test("schema: workspace e membro exigem UUID estrito com as mensagens das actions", () => {
  assert.equal(parseWorkspaceId({ organization_id: ORG_A }), ORG_A);
  assert.equal(parseMemberId({ user_id: USER }), USER);
  for (const raw of [{}, { organization_id: "" }, { organization_id: "abc" }, { organization_id: "11111111-2222-0333-8444-555555555555" }]) {
    assert.throws(() => parseWorkspaceId(raw), (e: unknown) => e instanceof ValidationError && e.message === "Workspace inválido.");
  }
  assert.throws(() => parseMemberId({ user_id: null }), (e: unknown) => e instanceof ValidationError && e.message === "Membro inválido.");
});

test("schema: troca de papel confere o membro antes do papel", () => {
  assert.deepEqual(parseMemberRoleChange({ user_id: USER, role: "analyst" }), { userId: USER, role: "analyst" });
  assert.throws(() => parseMemberRoleChange({ user_id: "x", role: "nada" }), { message: "Membro inválido." });
  assert.throws(() => parseMemberRoleChange({ user_id: USER, role: "nada" }), { message: "Papel inválido." });
  assert.throws(() => parseMemberRoleChange({ user_id: USER }), { message: "Papel inválido." });
});

test("permissões: conteúdo e convites só para owner e admin", () => {
  for (const role of ["owner", "admin"] as const) {
    assert.equal(canEditContent(role), true);
    assert.equal(canManageInvitations(role), true);
  }
  for (const role of ["analyst", "viewer"] as const) {
    assert.equal(canEditContent(role), false);
    assert.equal(canManageInvitations(role), false);
  }
});

// ---------------------------------------------------------------------------
// workspace ativo
// ---------------------------------------------------------------------------

test("workspace: memberships filtradas pelo próprio usuário, papel desconhecido descartado", async () => {
  const { client, calls } = fakeClient({ tables: { organization_members: memberships, user_active_workspace: { data: null, error: null } } });
  const ctx = await loadWorkspaceContext(client, USER);
  assert.deepEqual(
    ctx.memberships.map((m) => [m.organizationId, m.role, m.name]),
    [[ORG_A, "owner", "Loja A"], [ORG_B, "viewer", "Workspace"]],
  );
  assert.equal(ctx.active?.organizationId, ORG_A);
  const members = calls.find((c) => c.table === "organization_members");
  assert.deepEqual(members?.ops, [
    ["select", MEMBERSHIP_COLUMNS],
    ["eq", "user_id", USER],
    ["order", "created_at", { ascending: true }],
  ]);
  const preferred = calls.find((c) => c.table === "user_active_workspace");
  assert.deepEqual(preferred?.ops, [["select", "organization_id"], ["eq", "user_id", USER], ["maybeSingle"]]);
});

test("workspace: preferência salva escolhe entre memberships; preferência alheia é ignorada", async () => {
  const pick = async (preferred: string) => {
    const { client } = fakeClient({
      tables: { organization_members: memberships, user_active_workspace: { data: { organization_id: preferred }, error: null } },
    });
    return findWorkspace(client, USER);
  };
  assert.deepEqual(await pick(ORG_B), { organizationId: ORG_B, role: "viewer" });
  assert.deepEqual(await pick("44444444-5555-4666-8777-888888888888"), { organizationId: ORG_A, role: "owner" });
});

test("workspace: tabela de preferência ausente (sem migration) não loga; outro erro loga warn; ambos caem na mais antiga", async () => {
  const lines: Array<{ level: string; scope: string }> = [];
  setLogSinks([{ name: "test", write: (record) => void lines.push({ level: record.level, scope: record.scope }) }]);
  try {
    const missing = fakeClient({
      tables: { organization_members: memberships, user_active_workspace: { data: null, error: { code: "PGRST205", message: "x" } } },
    });
    assert.equal((await findWorkspace(missing.client, USER))?.organizationId, ORG_A);
    assert.equal(lines.length, 0);

    const broken = fakeClient({
      tables: { organization_members: memberships, user_active_workspace: { data: null, error: { code: "500", message: "boom" } } },
    });
    assert.equal((await findWorkspace(broken.client, USER))?.organizationId, ORG_A);
    assert.deepEqual(lines, [{ level: "warn", scope: "tenancy.active_workspace" }]);
  } finally {
    setLogSinks(null);
  }
});

test("workspace: sem memberships não há workspace; erro ao listar propaga", async () => {
  const empty = fakeClient({ tables: { organization_members: { data: [], error: null } } });
  assert.equal(await findWorkspace(empty.client, USER), null);
  const failure = { code: "42501", message: "denied" };
  const broken = fakeClient({ tables: { organization_members: { data: null, error: failure } } });
  await assert.rejects(findWorkspace(broken.client, USER), (e: unknown) => e === failure);
});

test("ensureWorkspace: devolve o ativo; sem linha do banco lança; sem usuário usa a linha da RPC", async () => {
  const ok = fakeClient({
    rpcs: { ensure_workspace: { data: [{ workspace_id: ORG_B, member_role: "owner" }], error: null } },
    tables: { organization_members: memberships, user_active_workspace: { data: null, error: null } },
    user: { id: USER },
  });
  assert.deepEqual(await ensureWorkspace(ok.client), { organizationId: ORG_A, role: "owner" });
  assert.deepEqual(ok.rpcCalls, [["ensure_workspace", undefined]]);

  const noUser = fakeClient({ rpcs: { ensure_workspace: { data: { workspace_id: ORG_B, member_role: "admin" }, error: null } } });
  assert.deepEqual(await ensureWorkspace(noUser.client), { organizationId: ORG_B, role: "admin" });

  const none = fakeClient({ rpcs: { ensure_workspace: { data: [], error: null } } });
  await assert.rejects(ensureWorkspace(none.client), { message: "ensure_workspace returned no workspace" });
});

// ---------------------------------------------------------------------------
// membros
// ---------------------------------------------------------------------------

test("listMembers: classifica migration ausente, proibido e erro inesperado", async () => {
  const rows = [
    { user_id: USER, email: "a@b.co", member_role: "owner", joined_at: "2026-11-01T10:00:00Z" },
    { user_id: "u2", email: null, member_role: "estranho", joined_at: "2026-11-02T10:00:00Z" },
  ];
  const ok = fakeClient({ rpcs: { list_workspace_members: { data: rows, error: null } } });
  assert.deepEqual(await listMembers(ok.client, ORG_A), {
    state: "ok",
    members: [{ userId: USER, email: "a@b.co", role: "owner", joinedAt: "2026-11-01T10:00:00Z" }],
  });
  assert.deepEqual(ok.rpcCalls, [["list_workspace_members", { p_organization_id: ORG_A }]]);

  const missing = fakeClient({ rpcs: { list_workspace_members: { data: null, error: { code: "PGRST202" } } } });
  assert.deepEqual(await listMembers(missing.client, ORG_A), { state: "unavailable" });
  const forbidden = fakeClient({ rpcs: { list_workspace_members: { data: null, error: { message: " forbidden " } } } });
  assert.deepEqual(await listMembers(forbidden.client, ORG_A), { state: "forbidden" });
  const denied = fakeClient({ rpcs: { list_workspace_members: { data: null, error: { code: "42501" } } } });
  assert.deepEqual(await listMembers(denied.client, ORG_A), { state: "forbidden" });
  const failure = { code: "XX000", message: "boom" };
  const broken = fakeClient({ rpcs: { list_workspace_members: { data: null, error: failure } } });
  await assert.rejects(listMembers(broken.client, ORG_A), (e: unknown) => e === failure);
});

test("membros: RPCs recebem o workspace da sessão; changed vem da linha devolvida; erro propaga", async () => {
  const changed = fakeClient({ rpcs: { change_member_role: { data: [{ changed: true }], error: null } } });
  assert.equal(await changeMemberRole(changed.client, ORG_A, USER, "viewer"), true);
  assert.deepEqual(changed.rpcCalls, [["change_member_role", { p_organization_id: ORG_A, p_user_id: USER, p_role: "viewer" }]]);
  const same = fakeClient({ rpcs: { change_member_role: { data: { changed: false }, error: null } } });
  assert.equal(await changeMemberRole(same.client, ORG_A, USER, "viewer"), false);

  const removed = fakeClient({});
  await removeMember(removed.client, ORG_A, USER);
  assert.deepEqual(removed.rpcCalls, [["remove_member", { p_organization_id: ORG_A, p_user_id: USER }]]);

  const switched = fakeClient({});
  await setActiveWorkspace(switched.client, ORG_B);
  assert.deepEqual(switched.rpcCalls, [["set_active_workspace", { p_organization_id: ORG_B }]]);

  const lastOwner = { message: "last_owner" };
  const blocked = fakeClient({ rpcs: { remove_member: { data: null, error: lastOwner } } });
  await assert.rejects(removeMember(blocked.client, ORG_A, USER), (e: unknown) => e === lastOwner);
});
