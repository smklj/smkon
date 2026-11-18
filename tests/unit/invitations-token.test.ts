import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateInviteToken,
  hashInviteToken,
  isInvitableRole,
  isValidEmail,
  isWellFormedInviteToken,
  normalizeEmail,
} from "../../src/lib/invitations/token.ts";

test("token tem 256 bits em base64url e hash SHA-256 correspondente", () => {
  const { token, tokenHash } = generateInviteToken();
  assert.equal(isWellFormedInviteToken(token), true);
  assert.match(tokenHash, /^[a-f0-9]{64}$/);
  assert.equal(hashInviteToken(token), tokenHash);
});

test("tokens não se repetem", () => {
  const tokens = new Set(Array.from({ length: 200 }, () => generateInviteToken().token));
  assert.equal(tokens.size, 200);
});

test("hash é estável (vetor conhecido de SHA-256)", () => {
  assert.equal(hashInviteToken("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("token malformado é recusado antes de chegar ao banco", () => {
  for (const value of ["", "curto", "a".repeat(44), "a".repeat(42) + "=", null, 123]) {
    assert.equal(isWellFormedInviteToken(value), false, String(value));
  }
});

test("e-mail é normalizado e validado", () => {
  assert.equal(normalizeEmail("  Pessoa@Empresa.COM "), "pessoa@empresa.com");
  assert.equal(normalizeEmail(undefined), "");
  assert.equal(isValidEmail("pessoa@empresa.com"), true);
  assert.equal(isValidEmail("sem-arroba"), false);
  assert.equal(isValidEmail(`${"a".repeat(250)}@x.co`), false);
});

test("owner nunca é papel convidável", () => {
  assert.equal(isInvitableRole("owner"), false);
  assert.equal(isInvitableRole("admin"), true);
  assert.equal(isInvitableRole("analyst"), true);
  assert.equal(isInvitableRole("viewer"), true);
  assert.equal(isInvitableRole("ADMIN"), false);
});
