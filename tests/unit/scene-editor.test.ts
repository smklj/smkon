import { test } from "node:test";
import assert from "node:assert/strict";

import { parseSceneDocument } from "../../src/lib/scene/schema.ts";
import { applyOperation, SceneOperationError } from "../../src/lib/scene/operations.ts";
import { assertLocksRespected, canEditBrand } from "../../src/lib/scene/locks.ts";
import {
  MIN_SIZE,
  movePatch,
  newImageLayer,
  newRectLayer,
  newTextLayer,
  nextLayerId,
  reflowScene,
  resizePatch,
  sceneAssetIds,
  sceneFormatOf,
} from "../../src/lib/scene/geometry.ts";
import { renderPageSvg } from "../../src/lib/scene/render.ts";
import { reformatScene } from "../../src/lib/scene/templates/index.ts";
import { bannerConfigToScene } from "../../src/lib/scene/templates/smkon-banner.ts";
import { postPackageToScene } from "../../src/lib/scene/templates/smkon-post.ts";
import { OFFICIAL_SMKON_PRESETS } from "../../src/lib/media/smart-banner-engine.ts";
import { OFFICIAL_POST_PRESETS } from "../../src/lib/content/smart-post-generator.ts";
import type { SceneDocument } from "../../src/lib/scene/types.ts";

const ASSET = "11111111-1111-4111-8111-111111111111";
const banner = () => bannerConfigToScene(OFFICIAL_SMKON_PRESETS["top-perifericos"]);

function doc(): SceneDocument {
  return parseSceneDocument({
    schema: 1,
    kind: "image",
    width: 1080,
    height: 1080,
    pages: [
      {
        id: "p1",
        layers: [
          { id: "fundo", type: "brand", element: "smk-backdrop", x: 0, y: 0, locked: "brand", props: { variant: "post" } },
          { id: "logo", type: "brand", element: "smk-logo", x: 80, y: 50, locked: "brand", props: { variant: "post" } },
          { id: "preco", type: "rect", x: 100, y: 800, width: 300, height: 80, radius: 12, fill: "#2563FF", locked: "position" },
          { id: "titulo", type: "text", text: "Oi", font: "display", size: 60, color: "#FFFFFF", x: 100, y: 200 },
          { id: "foto", type: "image", assetId: ASSET, x: 300, y: 300, width: 400, height: 400 },
        ],
      },
    ],
  });
}

function edit(base: SceneDocument, change: (d: SceneDocument) => void): SceneDocument {
  const copy = structuredClone(base);
  change(copy);
  return parseSceneDocument(copy);
}

/* ---------- travas no servidor ---------- */

test("canEditBrand: só owner e admin", () => {
  assert.equal(canEditBrand("owner"), true);
  assert.equal(canEditBrand("admin"), true);
  assert.equal(canEditBrand("analyst"), false);
  assert.equal(canEditBrand("viewer"), false);
  assert.equal(canEditBrand(null), false);
});

test("travas: sem permissão de marca, mudar/remover/criar camada da marca é recusado mesmo enviando o documento inteiro", () => {
  const before = doc();
  const opts = { allowBrand: false };
  const moved = edit(before, (d) => (d.pages[0].layers[1].x = 90));
  assert.throws(() => assertLocksRespected(before, moved, opts), SceneOperationError);
  const removed = edit(before, (d) => d.pages[0].layers.splice(1, 1));
  assert.throws(() => assertLocksRespected(before, removed, opts), /é da marca/);
  const unlocked = edit(before, (d) => delete d.pages[0].layers[1].locked);
  assert.throws(() => assertLocksRespected(before, unlocked, opts), SceneOperationError);
  const added = edit(before, (d) =>
    d.pages[0].layers.push({ id: "logo-2", type: "brand", element: "smk-logo", x: 0, y: 0, locked: "brand", props: { variant: "post" } }),
  );
  assert.throws(() => assertLocksRespected(before, added, opts), /Só owner ou admin adiciona/);
  assert.throws(() => assertLocksRespected(before, null, opts), /é da marca/, "apagar o design some com a marca");
});

test("travas: posição travada aceita texto e cor, recusa geometria e destravar", () => {
  const before = doc();
  const opts = { allowBrand: false };
  assertLocksRespected(before, edit(before, (d) => ((d.pages[0].layers[2] as { fill: string }).fill = "#FF0000")), opts);
  assert.throws(() => assertLocksRespected(before, edit(before, (d) => (d.pages[0].layers[2].y = 10)), opts), /posição travada/);
  assert.throws(
    () => assertLocksRespected(before, edit(before, (d) => ((d.pages[0].layers[2] as { width: number }).width = 1)), opts),
    /posição travada/,
  );
  assert.throws(() => assertLocksRespected(before, edit(before, (d) => delete d.pages[0].layers[2].locked), opts), /só pode ser removida/);
});

test("travas: camadas livres mudam à vontade; owner/admin passa por tudo", () => {
  const before = doc();
  const free = edit(before, (d) => {
    d.pages[0].layers[3].x = 500;
    d.pages[0].layers.splice(4, 1);
  });
  assertLocksRespected(before, free, { allowBrand: false });
  assertLocksRespected(before, edit(before, (d) => d.pages[0].layers.splice(0, 2)), { allowBrand: true });
  // Ordem das chaves não conta como mudança.
  const reordered = edit(before, (d) => {
    const { id, type, element, x, y, locked, props } = d.pages[0].layers[1] as never;
    d.pages[0].layers[1] = { props, locked, y, x, element, type, id } as never;
  });
  assertLocksRespected(before, reordered, { allowBrand: false });
});

test("layer.lock no editor segue a regra do servidor para a trava de posição", () => {
  const base = doc();
  const locked = applyOperation(base, { op: "layer.lock", pageId: "p1", layerId: "titulo", locked: "position" });
  assert.equal(locked.pages[0].layers[3].locked, "position");
  assert.throws(() => applyOperation(locked, { op: "layer.lock", pageId: "p1", layerId: "titulo", locked: null }), /só pode ser removida/);
  const freed = applyOperation(locked, { op: "layer.lock", pageId: "p1", layerId: "titulo", locked: null }, { allowBrand: true });
  assert.equal(freed.pages[0].layers[3].locked, undefined);
});

/* ---------- geometria ---------- */

test("movePatch arredonda a uma casa", () => {
  assert.deepEqual(movePatch(doc().pages[0].layers[3], 10.04, -0.26), { x: 110, y: 199.7 });
});

test("resizePatch por tipo de camada", () => {
  const layers = doc().pages[0].layers;
  const box = { x: 0, y: 0, width: 200, height: 100 };
  assert.deepEqual(resizePatch(layers[4], box, 250.06, 2), { width: 250.1, height: MIN_SIZE });
  assert.deepEqual(resizePatch(layers[3], box, 0, 150), { size: 90 }, "texto escala o corpo pela altura");
  assert.deepEqual(resizePatch(layers[1], box, 100, 0), { scale: 0.5 }, "marca escala pela largura");
  const fitted = banner().pages[0].layers.find((layer) => layer.type === "rect" && layer.fitText);
  assert.ok(fitted);
  assert.deepEqual(Object.keys(resizePatch(fitted, box, 300, 60)), ["height"], "largura acompanha o texto");
});

test("novas camadas: ids únicos e válidas para layer.add", () => {
  const base = doc();
  const page = base.pages[0];
  assert.equal(nextLayerId(page, "titulo"), "titulo-2");
  assert.equal(nextLayerId(page, "texto"), "texto");
  let next = applyOperation(base, { op: "layer.add", pageId: "p1", layer: newTextLayer(base, page) });
  next = applyOperation(next, { op: "layer.add", pageId: "p1", layer: newTextLayer(next, next.pages[0]) });
  assert.deepEqual(next.pages[0].layers.slice(-2).map((layer) => layer.id), ["texto", "texto-2"]);
  next = applyOperation(next, { op: "layer.add", pageId: "p1", layer: newRectLayer(next, next.pages[0]) });
  const image = newImageLayer(next, next.pages[0], ASSET, { width: 1600, height: 900 });
  assert.equal(image.id, "imagem");
  assert.equal(image.width, 648);
  assert.equal(image.height, 364.5);
  next = applyOperation(next, { op: "layer.add", pageId: "p1", layer: image });
  assert.deepEqual(sceneAssetIds(next), [ASSET], "sem duplicar");
  assert.deepEqual(sceneAssetIds(null), []);
});

/* ---------- formatos ---------- */

test("sceneFormatOf reconhece 1:1, 4:5 e 9:16 (inclusive 720×1280)", () => {
  assert.equal(sceneFormatOf({ width: 1080, height: 1080 }), "1:1");
  assert.equal(sceneFormatOf({ width: 1080, height: 1350 }), "4:5");
  assert.equal(sceneFormatOf({ width: 720, height: 1280 }), "9:16");
  assert.equal(sceneFormatOf({ width: 1280, height: 720 }), null);
});

test("reflowScene: escala uniforme centralizada, fundo ocupa a peça nova, template vira editado", () => {
  const source = edit(doc(), (d) => (d.template = { id: "x", version: 1, params: {} }));
  const out = reflowScene(source, 1080, 1920);
  assert.equal(out.width, 1080);
  assert.equal(out.height, 1920);
  assert.equal(out.template?.detached, true);
  const [fundo, logo, preco, titulo] = out.pages[0].layers;
  assert.deepEqual([fundo.x, fundo.y], [0, 0], "fundo não se move");
  assert.equal(logo.y, 50 + 420, "conteúdo desce para o centro (1920-1080)/2");
  assert.equal(preco.type === "rect" && preco.width, 300);
  assert.equal(titulo.type === "text" && titulo.size, 60);
  const half = reflowScene(source, 540, 1080).pages[0].layers;
  assert.equal(half[3].type === "text" && half[3].size, 30);
  assert.equal(half[4].type === "image" && half[4].width, 200);
});

test("reformatScene usa o template quando ele tem a proporção; senão adapta", () => {
  const vertical = reformatScene(banner(), "9:16");
  assert.equal(vertical.via, "template");
  assert.deepEqual([vertical.doc.width, vertical.doc.height], [720, 1280]);
  assert.equal(vertical.doc.template?.detached, undefined);
  const portrait = reformatScene(banner(), "4:5");
  assert.equal(portrait.via, "reflow");
  assert.equal(portrait.doc.template?.detached, true);

  const post = postPackageToScene(OFFICIAL_POST_PRESETS["carrossel-5-achados"]);
  const post45 = reformatScene(post, "4:5");
  assert.equal(post45.via, "template");
  assert.deepEqual([post45.doc.width, post45.doc.height], [1080, 1350]);
  assert.equal(post45.doc.pages.length, post.pages.length);

  const edited = applyOperation(banner(), { op: "layer.update", pageId: "capa", layerId: "headline", patch: { text: "Outro" } });
  assert.equal(reformatScene(edited, "1:1").via, "reflow", "editado à mão não volta ao template");
});

/* ---------- render do editor ---------- */

test("annotate envolve cada camada visível em data-layer; exportação não", () => {
  const base = edit(doc(), (d) => (d.pages[0].layers[3].hidden = true));
  const annotated = renderPageSvg(base, { annotate: true });
  assert.deepEqual(
    [...annotated.matchAll(/data-layer="([a-z0-9-]+)"/g)].map((m) => m[1]),
    ["fundo", "logo", "preco", "foto"],
  );
  assert.ok(!renderPageSvg(base).includes("data-layer"));
  const resolved = renderPageSvg(base, { resolveAsset: () => "https://x.supabase.co/a?token=1&b=2" });
  assert.ok(resolved.includes('href="https://x.supabase.co/a?token=1&amp;b=2"'), "URL escapada");
});
