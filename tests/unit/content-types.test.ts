import { test } from "node:test";
import assert from "node:assert/strict";
import { CHANNELS, emptyItem, itemToPayload, migrationKey, rowToItem, type ContentItemRow } from "../../src/lib/content/types.ts";

const row: ContentItemRow = {
  id: "7d2c9a7e-3f1b-4c55-9a51-0b6c1f5d2e10",
  title: "Review",
  product: "Fone",
  source_url: "",
  asset_url: "",
  script: "s",
  caption: "c",
  cta: "",
  hashtags: "",
  channels: ["TikTok", "Orkut"],
  rights_confirmed: false,
  media_asset_id: "11111111-2222-4333-8444-555555555555",
  status: "approved",
  version: 3,
  content_hash: "a".repeat(64),
  approved_version: 3,
  approved_at: "2026-11-18T12:00:00Z",
  created_at: "2026-11-18T10:00:00Z",
  updated_at: "2026-11-18T12:00:00Z",
};

test("rowToItem mapeia status, versão, hash e descarta canais desconhecidos", () => {
  const item = rowToItem(row);
  assert.equal(item.status, "Aprovado");
  assert.equal(item.version, 3);
  assert.equal(item.contentHash, "a".repeat(64));
  assert.equal(item.approvedVersion, 3);
  assert.deepEqual(item.channels, ["TikTok"]);
});

test("mídia da peça vai e volta entre a API e a tela", () => {
  const item = rowToItem(row);
  assert.equal(item.mediaAssetId, "11111111-2222-4333-8444-555555555555");
  assert.equal(itemToPayload(item).mediaAssetId, "11111111-2222-4333-8444-555555555555");
  assert.equal(rowToItem({ ...row, media_asset_id: null }).mediaAssetId, null);
  assert.equal(emptyItem().mediaAssetId, null);
});

test("rowToItem usa todos os canais quando nenhum é válido", () => {
  assert.deepEqual(rowToItem({ ...row, channels: ["Orkut"] }).channels, CHANNELS);
});

test("itemToPayload nunca envia status approved", () => {
  const payload = itemToPayload(rowToItem(row));
  assert.equal(payload.status, "draft");
  assert.equal(itemToPayload(rowToItem(row), "archived").status, "archived");
  assert.equal("contentHash" in payload, false);
});

test("emptyItem começa sem id e sem versão", () => {
  const item = emptyItem();
  assert.equal(item.id, "");
  assert.equal(item.version, 0);
  assert.equal(item.status, "Rascunho");
});

test("migrationKey normaliza título", () => {
  assert.equal(migrationKey({ title: "  Review X ", updatedAt: "t" }), "review x|t");
});
