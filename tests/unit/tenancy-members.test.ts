import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canManageMembers,
  canViewMembers,
  isMemberRole,
  isMissingSchemaObject,
  memberControls,
  resolveActiveWorkspace,
  type MemberRow,
  type WorkspaceMembership,
} from "../../src/lib/tenancy/members.ts";
import { dbErrorMessage } from "../../src/lib/http/errors.ts";

const A: WorkspaceMembership = { organizationId: "a", role: "owner", name: "A", joinedAt: "2026-11-01T10:00:00Z" };
const B: WorkspaceMembership = { organizationId: "b", role: "viewer", name: "B", joinedAt: "2026-11-10T10:00:00Z" };

test("sem memberships não há workspace ativo", () => {
  assert.equal(resolveActiveWorkspace([], "a"), null);
  assert.equal(resolveActiveWorkspace([], null), null);
});

test("sem preferência vale a membership mais antiga, em qualquer ordem de entrada", () => {
  assert.equal(resolveActiveWorkspace([B, A], null)?.organizationId, "a");
  assert.equal(resolveActiveWorkspace([A, B], null)?.organizationId, "a");
});

test("preferência válida escolhe o workspace e o papel dele", () => {
  const active = resolveActiveWorkspace([A, B], "b");
  assert.equal(active?.organizationId, "b");
  assert.equal(active?.role, "viewer");
});

test("preferência de workspace sem membership é ignorada (não concede acesso)", () => {
  assert.equal(resolveActiveWorkspace([A, B], "outro-tenant")?.organizationId, "a");
  assert.equal(resolveActiveWorkspace([B], "a")?.organizationId, "b");
});

test("papéis: listar é de owner/admin; gerenciar é só de owner", () => {
  assert.deepEqual(["owner", "admin", "analyst", "viewer"].map((r) => canViewMembers(r as never)), [true, true, false, false]);
  assert.deepEqual(["owner", "admin", "analyst", "viewer"].map((r) => canManageMembers(r as never)), [true, false, false, false]);
  assert.equal(isMemberRole("owner"), true);
  assert.equal(isMemberRole("superuser"), false);
  assert.equal(isMemberRole(undefined), false);
});

test("controles: último owner sem alterar/remover; admin não recebe controles", () => {
  const owner: MemberRow = { userId: "1", email: "o@x.test", role: "owner", joinedAt: "" };
  const viewer: MemberRow = { userId: "2", email: "v@x.test", role: "viewer", joinedAt: "" };
  assert.deepEqual(memberControls("owner", owner, 1), { canChangeRole: false, canRemove: false });
  assert.deepEqual(memberControls("owner", owner, 2), { canChangeRole: true, canRemove: true });
  assert.deepEqual(memberControls("owner", viewer, 1), { canChangeRole: true, canRemove: true });
  assert.deepEqual(memberControls("admin", viewer, 1), { canChangeRole: false, canRemove: false });
});

test("objeto ausente no banco é reconhecido (ambiente sem a migration)", () => {
  for (const code of ["PGRST202", "PGRST205", "42883", "42P01"]) assert.equal(isMissingSchemaObject({ code }), true);
  assert.equal(isMissingSchemaObject({ code: "42501" }), false);
  assert.equal(isMissingSchemaObject(null), false);
});

test("erros de membros viram mensagens seguras", () => {
  assert.match(dbErrorMessage({ message: "last_owner" }, "x"), /pelo menos um owner/);
  assert.match(dbErrorMessage({ message: "member_not_found" }, "x"), /não é mais membro/);
  assert.match(dbErrorMessage({ message: "workspace_not_found" }, "x"), /Workspace não encontrado/);
  assert.equal(dbErrorMessage({ message: "invalid_member_role" }, "x"), "Papel inválido.");
  assert.equal(dbErrorMessage({ message: "forbidden" }, "x"), "Seu papel não permite esta ação.");
});
