import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNextPath } from "../../src/lib/http/safe-redirect.ts";

test("aceita caminhos internos com query", () => {
  assert.equal(safeNextPath("/convite?token=abc"), "/convite?token=abc");
  assert.equal(safeNextPath("/studio"), "/studio");
});

test("recusa redirecionamentos externos e malformados", () => {
  for (const value of ["//evil.com", "https://evil.com", "/\\evil.com", "evil.com", "", null, undefined, 42, "/" + "a".repeat(3000)]) {
    assert.equal(safeNextPath(value), "/", String(value));
  }
});

test("usa o fallback informado", () => {
  assert.equal(safeNextPath("https://evil.com", "/?senha=ok"), "/?senha=ok");
});
