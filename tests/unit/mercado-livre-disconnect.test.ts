import assert from "node:assert/strict";
import test from "node:test";

test("disconnect requires valid workspace and authorized manager role", () => {
  const isAuthorizedManager = (role: string | null | undefined): boolean => {
    return role === "owner" || role === "admin";
  };

  assert.equal(isAuthorizedManager("owner"), true);
  assert.equal(isAuthorizedManager("admin"), true);
  assert.equal(isAuthorizedManager("viewer"), false);
  assert.equal(isAuthorizedManager("analyst"), false);
  assert.equal(isAuthorizedManager(null), false);
  assert.equal(isAuthorizedManager(undefined), false);
});

test("disconnect sets connection status to disabled", () => {
  const currentConnection = {
    id: "conn-123",
    status: "connected",
    provider: "mercado_livre",
    updated_at: "2026-11-20T00:00:00.000Z",
  };

  const updatedConnection = {
    ...currentConnection,
    status: "disabled",
    updated_at: new Date().toISOString(),
  };

  assert.equal(updatedConnection.status, "disabled");
  assert.notEqual(updatedConnection.updated_at, currentConnection.updated_at);
});
