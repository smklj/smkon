import { test } from "node:test";
import assert from "node:assert/strict";
import { licenseStatus, mediaStoragePath, todayInBrazil, validateMediaFile, type LicenseRow } from "../../src/lib/media/types.ts";
import { parseLicenseInput } from "../../src/lib/media/validation.ts";

const base: LicenseRow = {
  id: "l1", media_asset_id: "m1", license_type: "own_production", licensor: "Equipe", proof_url: null,
  allows_commercial_use: true, allows_modification: true, territory: "Mundial",
  valid_from: "2026-11-01", valid_until: null, notes: null, created_at: "2026-11-01T00:00:00Z",
  revoked_at: null, revoke_reason: null,
};

test("arquivo: tipos e tamanho do bucket", () => {
  assert.deepEqual(validateMediaFile({ type: "video/mp4", size: 1000, name: "a.mp4" }), { ext: "mp4", kind: "video" });
  assert.equal(validateMediaFile({ type: "image/jpeg", size: 1000, name: "a.jpg" }).ext, "jpg");
  assert.throws(() => validateMediaFile({ type: "application/pdf", size: 10, name: "a.pdf" }), /Formato/);
  assert.throws(() => validateMediaFile({ type: "video/mp4", size: 60 * 1024 * 1024, name: "a.mp4" }), /50 MB/);
  assert.throws(() => validateMediaFile({ type: "video/mp4", size: 0, name: "a.mp4" }), /vazio/);
});

test("caminho no Storage: <workspace>/<uuid>.<ext>", () => {
  const org = "11111111-2222-4333-8444-555555555555";
  const file = "66666666-7777-4888-8999-000000000000";
  assert.equal(mediaStoragePath(org, file, "mp4"), `${org}/${file}.mp4`);
});

test("estado da licença segue a regra do banco", () => {
  const today = "2026-11-18";
  assert.equal(licenseStatus([], today), "none");
  assert.equal(licenseStatus([base], today), "valid");
  assert.equal(licenseStatus([{ ...base, revoked_at: "x", revoke_reason: "y" }], today), "revoked");
  assert.equal(licenseStatus([{ ...base, allows_commercial_use: false }], today), "not_commercial");
  assert.equal(licenseStatus([{ ...base, valid_until: "2026-11-10" }], today), "expired");
  assert.equal(licenseStatus([{ ...base, valid_from: "2026-12-01" }], today), "expired");
  assert.equal(licenseStatus([{ ...base, revoked_at: "x", revoke_reason: "y" }, { ...base, id: "l2" }], today), "valid");
});

test("hoje em Brasília vira o dia às 03:00 UTC", () => {
  assert.equal(todayInBrazil(new Date("2026-11-19T02:59:00Z")), "2026-11-18");
  assert.equal(todayInBrazil(new Date("2026-11-19T03:00:00Z")), "2026-11-19");
});

test("licença: comprovação obrigatória para terceiros e período coerente", () => {
  const today = "2026-11-18";
  const own = parseLicenseInput({ license_type: "own_production", licensor: "Equipe", allows_commercial_use: "on" }, today);
  assert.equal(own.proof_url, null);
  assert.equal(own.valid_from, today);
  assert.equal(own.allows_commercial_use, true);
  assert.equal(own.allows_modification, false);
  assert.throws(() => parseLicenseInput({ license_type: "creator_authorization", licensor: "@criador" }, today), /comprovação/);
  assert.throws(() => parseLicenseInput({ license_type: "licensed", licensor: "Agência", proof_url: "http://a.com/x" }, today), /https/);
  assert.throws(
    () => parseLicenseInput({ license_type: "stock", licensor: "Banco", proof_url: "https://a.com/x", valid_from: "2026-12-01", valid_until: "2026-11-01" }, today),
    /anterior/,
  );
  assert.throws(() => parseLicenseInput({ license_type: "outro", licensor: "X" }, today), /Tipo/);
});
