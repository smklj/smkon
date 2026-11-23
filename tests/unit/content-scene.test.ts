import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSceneWrite } from "../../src/lib/content/schema.ts";
import { CONTENT_SELECT_COLUMNS, SCENE_SELECT_COLUMNS, updateContentScene, type SupabaseClient } from "../../src/lib/content/repository.ts";
import { bannerConfigToScene } from "../../src/lib/scene/templates/smkon-banner.ts";
import { OFFICIAL_SMKON_PRESETS } from "../../src/lib/media/smart-banner-engine.ts";

const ID = "7d2c9a7e-3f1b-4c55-9a51-0b6c1f5d2e10";
const HASH = "a".repeat(64);
const scene = bannerConfigToScene(OFFICIAL_SMKON_PRESETS["top-perifericos"]);

test("gravação do design: valida id, documento e hash esperado", () => {
  const input = parseSceneWrite({ id: ID, scene: JSON.parse(JSON.stringify(scene)), expectedHash: HASH });
  assert.equal(input.id, ID);
  assert.deepEqual(input.scene, scene);
  assert.equal(input.expectedHash, HASH);
  assert.equal(parseSceneWrite({ id: ID, scene: null }).scene, null, "null remove o design");

  assert.throws(() => parseSceneWrite(null), /Corpo/);
  assert.throws(() => parseSceneWrite({ id: "x", scene }), /Identificador/);
  assert.throws(() => parseSceneWrite({ id: ID }), /documento de cena/);
  assert.throws(() => parseSceneWrite({ id: ID, scene, expectedHash: "abc" }), /Hash/);
  assert.throws(() => parseSceneWrite({ id: ID, scene: { ...scene, schema: 2 } }), /Documento de cena inválido/);
});

test("a lista da biblioteca não carrega a cena; a leitura do design carrega", () => {
  assert.ok(!CONTENT_SELECT_COLUMNS.split(",").includes("scene"));
  for (const column of ["id", "version", "content_hash", "status", "scene"]) {
    assert.ok(SCENE_SELECT_COLUMNS.split(",").includes(column), column);
  }
});

/** Cliente falso: registra os filtros e devolve as linhas configuradas. */
function fakeClient(updateResult: unknown, readResult: unknown) {
  const calls: Array<[string, ...unknown[]]> = [];
  const builder = (result: unknown) => {
    const chain = {
      update: (...args: unknown[]) => (calls.push(["update", ...args]), chain),
      select: (...args: unknown[]) => (calls.push(["select", ...args]), chain),
      eq: (...args: unknown[]) => (calls.push(["eq", ...args]), chain),
      maybeSingle: async () => ({ data: result, error: null }),
    };
    return chain;
  };
  let first = true;
  const client = {
    from: () => {
      const result = first ? updateResult : readResult;
      first = false;
      return builder(result);
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

test("gravar com hash esperado filtra pela versão aberta e devolve a linha nova", async () => {
  const row = { id: ID, version: 2, content_hash: "b".repeat(64), status: "draft", scene };
  const { client, calls } = fakeClient(row, null);
  assert.deepEqual(await updateContentScene(client, "org", ID, scene, HASH), row);
  assert.ok(calls.some(([name, column, value]) => name === "eq" && column === "content_hash" && value === HASH));
  assert.ok(calls.some(([name, column, value]) => name === "eq" && column === "organization_id" && value === "org"));
});

test("versão mudou desde a abertura → stale; peça inexistente → not_found", async () => {
  const existing = { id: ID, version: 3, content_hash: "c".repeat(64), status: "draft", scene: null };
  assert.equal(await updateContentScene(fakeClient(null, existing).client, "org", ID, scene, HASH), "stale");
  assert.equal(await updateContentScene(fakeClient(null, null).client, "org", ID, scene, HASH), "not_found");
  assert.equal(await updateContentScene(fakeClient(null, null).client, "org", ID, scene, null), "not_found");
});
