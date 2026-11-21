import { test } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "../../src/lib/http/errors.ts";
import { parseApproveInput, parseContentId, parseContentPayload, parseContentStatusFilter, readContentJson } from "../../src/lib/content/schema.ts";
import { CONTENT_KEYSET, emptyCounts } from "../../src/lib/content/repository.ts";
import { isOptionalHttpsUrl } from "../../src/lib/validation/fields.ts";

const UUID = "7d2c9a7e-3f1b-4c55-9a51-0b6c1f5d2e10";
const base = { title: "  Review do fone  ", channels: ["YouTube"] };

function rejects(fn: () => unknown, message: RegExp) {
  assert.throws(fn, (error: unknown) => error instanceof ValidationError && message.test(error.message));
}

test("payload mínimo vira linha de rascunho com padrões", () => {
  const row = parseContentPayload(base);
  assert.equal(row.title, "Review do fone");
  assert.equal(row.status, "draft");
  assert.deepEqual(row.channels, ["YouTube"]);
  assert.equal(row.media_asset_id, null);
  assert.equal(row.rights_confirmed, false);
  assert.equal(row.source_url, "");
});

test("título e canais são obrigatórios; canais duplicados são removidos", () => {
  rejects(() => parseContentPayload({ channels: ["YouTube"] }), /título/);
  rejects(() => parseContentPayload({ title: "x".repeat(181), channels: ["YouTube"] }), /título/);
  rejects(() => parseContentPayload({ title: "a", channels: [] }), /canal/);
  rejects(() => parseContentPayload({ title: "a", channels: ["X"] }), /canal/);
  assert.deepEqual(parseContentPayload({ title: "a", channels: ["TikTok", "TikTok"] }).channels, ["TikTok"]);
});

test("links precisam de HTTPS e vídeo de referência exige direitos confirmados", () => {
  rejects(() => parseContentPayload({ ...base, sourceUrl: "http://a.com/v" }), /vídeo de referência deve usar HTTPS/);
  rejects(() => parseContentPayload({ ...base, assetUrl: "ftp://a.com" }), /link do produto/);
  rejects(() => parseContentPayload({ ...base, sourceUrl: "https://a.com/v" }), /direitos/);
  const row = parseContentPayload({ ...base, sourceUrl: "https://a.com/v", rightsConfirmed: true });
  assert.equal(row.rights_confirmed, true);
});

test("status approved nunca é gravado diretamente", () => {
  rejects(() => parseContentPayload({ ...base, status: "approved" as never }), /fluxo de aprovação/);
  assert.equal(parseContentPayload({ ...base, status: "archived" }).status, "archived");
});

test("mídia precisa ser UUID e textos longos são cortados no limite do banco", () => {
  rejects(() => parseContentPayload({ ...base, mediaAssetId: "abc" }), /Mídia/);
  assert.equal(parseContentPayload({ ...base, mediaAssetId: UUID }).media_asset_id, UUID);
  assert.equal(parseContentPayload({ ...base, caption: "c".repeat(10_050) }).caption.length, 10_000);
  assert.equal(parseContentPayload({ ...base, product: "p".repeat(200) }).product.length, 180);
});

test("variante permissiva de HTTPS do Studio: vazio passa, host sem ponto passa", () => {
  assert.equal(isOptionalHttpsUrl(""), true);
  assert.equal(isOptionalHttpsUrl("https://localhost/x"), true);
  assert.equal(isOptionalHttpsUrl("http://a.com"), false);
  assert.equal(isOptionalHttpsUrl("não é url"), false);
});

test("aprovação exige UUID e hash SHA-256 minúsculo; nota é cortada em 1000", () => {
  rejects(() => parseApproveInput(null), /Identificador/);
  rejects(() => parseApproveInput([UUID]), /Identificador/);
  rejects(() => parseApproveInput({ id: UUID, contentHash: "A".repeat(64) }), /Hash/);
  const input = parseApproveInput({ id: UUID, contentHash: "a".repeat(64), note: "n".repeat(1200) });
  assert.equal(input.id, UUID);
  assert.equal(input.note?.length, 1000);
  assert.equal(parseApproveInput({ id: UUID, contentHash: "b".repeat(64), note: 5 }).note, undefined);
});

test("id da peça, filtro de status e corpo JSON", async () => {
  assert.equal(parseContentId(UUID), UUID);
  rejects(() => parseContentId("1"), /Identificador/);
  assert.equal(parseContentStatusFilter("all"), null);
  assert.equal(parseContentStatusFilter("approved"), "approved");
  assert.equal(parseContentStatusFilter("x"), "invalid");
  const ok = await readContentJson(new Request("http://t/", { method: "POST", body: JSON.stringify(base) }));
  assert.equal(ok.title, base.title);
  await assert.rejects(readContentJson(new Request("http://t/", { method: "POST", body: "[]" })), /Corpo/);
  await assert.rejects(readContentJson(new Request("http://t/", { method: "POST", body: "{" })), /Corpo/);
});

test("repository: cursor estável e contagens zeradas", () => {
  assert.equal(CONTENT_KEYSET.id, "content:v1");
  assert.deepEqual(emptyCounts(), { total: 0, draft: 0, approved: 0, archived: 0 });
});
