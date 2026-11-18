import { test } from "node:test";
import assert from "node:assert/strict";
import { CONTENT_HASH_PATTERN, CONTENT_SELECT_COLUMNS, isUuid } from "../../src/lib/content/server.ts";

test("isUuid aceita UUID válido e recusa formatos frouxos", () => {
  assert.equal(isUuid("7d2c9a7e-3f1b-4c55-9a51-0b6c1f5d2e10"), true);
  assert.equal(isUuid("------------------------------------"), false);
  assert.equal(isUuid("7d2c9a7e3f1b4c559a510b6c1f5d2e10"), false);
  assert.equal(isUuid(123), false);
});

test("hash de versão exige SHA-256 hexadecimal minúsculo", () => {
  assert.equal(CONTENT_HASH_PATTERN.test("a".repeat(64)), true);
  assert.equal(CONTENT_HASH_PATTERN.test("A".repeat(64)), false);
  assert.equal(CONTENT_HASH_PATTERN.test("a".repeat(63)), false);
});

test("colunas selecionadas incluem versão e hash", () => {
  for (const column of ["version", "content_hash", "approved_version", "approved_at"]) {
    assert.ok(CONTENT_SELECT_COLUMNS.split(",").includes(column), column);
  }
});
