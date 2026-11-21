import { test } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "../../src/lib/http/errors.ts";
import { parseLicenseInput, parseMediaId, parseRevokeInput } from "../../src/lib/media/schema.ts";
import * as compat from "../../src/lib/media/validation.ts";

const ID = "11111111-2222-4333-8444-555555555555";
const TODAY = "2026-11-21";

test("media/validation.ts continua reexportando o schema", () => {
  assert.equal(compat.parseLicenseInput, parseLicenseInput);
});

test("parseMediaId: UUID estrito; ausente, File ou formato inválido → 'Mídia inválida.'", () => {
  assert.equal(parseMediaId(ID), ID);
  for (const value of [null, undefined, "", "abc", "11111111-2222-0333-8444-555555555555", ` ${ID}`]) {
    assert.throws(() => parseMediaId(value), (error: unknown) => error instanceof ValidationError && error.message === "Mídia inválida.");
  }
});

test("parseRevokeInput: identificador antes do motivo; motivo aparado com no mínimo 3 caracteres", () => {
  assert.deepEqual(parseRevokeInput(ID, "  contrato encerrado  "), { licenseId: ID, reason: "contrato encerrado" });
  assert.throws(() => parseRevokeInput("x", ""), /Licença inválida\./);
  assert.throws(() => parseRevokeInput(ID, "  ab  "), /Informe o motivo da revogação\./);
  assert.throws(() => parseRevokeInput(ID, null), /Informe o motivo da revogação\./);
});

test("parseLicenseInput: tipo fora da lista e números do JSON são recusados (só texto)", () => {
  assert.throws(() => parseLicenseInput({ license_type: "", licensor: "Equipe" }, TODAY), /Tipo de licença inválido/);
  assert.throws(() => parseLicenseInput({ license_type: "own_production", licensor: 12345 }, TODAY), /quem concede/);
});

test("parseLicenseInput: padrões de data, território e flags", () => {
  const input = parseLicenseInput(
    { license_type: "own_production", licensor: "  Equipe  ", allows_commercial_use: "on", allows_modification: true },
    TODAY,
  );
  assert.deepEqual(input, {
    license_type: "own_production",
    licensor: "Equipe",
    proof_url: null,
    allows_commercial_use: true,
    allows_modification: true,
    territory: "Mundial",
    valid_from: TODAY,
    valid_until: null,
    notes: null,
  });
});

test("parseLicenseInput: link de comprovação precisa ser https com host válido e sem credenciais", () => {
  const base = { license_type: "stock", licensor: "Banco de imagens" };
  assert.throws(() => parseLicenseInput(base, TODAY), /Anexe o link/);
  assert.throws(() => parseLicenseInput({ ...base, proof_url: "http://exemplo.com/l" }, TODAY), /https:\/\//);
  assert.throws(() => parseLicenseInput({ ...base, proof_url: "https://user:pw@exemplo.com/l" }, TODAY), /https:\/\//);
  assert.equal(parseLicenseInput({ ...base, proof_url: "https://exemplo.com/l" }, TODAY).proof_url, "https://exemplo.com/l");
});
