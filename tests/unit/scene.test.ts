import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { parseSceneDocument, SCENE_LIMITS } from "../../src/lib/scene/schema.ts";
import { applyOperation, applyOperations, SceneOperationError } from "../../src/lib/scene/operations.ts";
import { canRedo, canUndo, commit, createHistory, HISTORY_LIMIT, redo, undo } from "../../src/lib/scene/history.ts";
import { escapeXml, renderPageSvg, rectWidth } from "../../src/lib/scene/render.ts";
import { bannerConfigFromScene, bannerConfigToScene } from "../../src/lib/scene/templates/smkon-banner.ts";
import { postPackageFromScene, postPackageToScene, postSlideToScene } from "../../src/lib/scene/templates/smkon-post.ts";
import { generateSmartBannerSvg, OFFICIAL_SMKON_PRESETS } from "../../src/lib/media/smart-banner-engine.ts";
import { generatePostSlideSvg, OFFICIAL_POST_PRESETS } from "../../src/lib/content/smart-post-generator.ts";
import type { SceneDocument, TextLayer } from "../../src/lib/scene/types.ts";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const banner = () => bannerConfigToScene(OFFICIAL_SMKON_PRESETS["top-perifericos"]);

function minimalDoc(): SceneDocument {
  return parseSceneDocument({
    schema: 1,
    kind: "image",
    width: 1080,
    height: 1080,
    pages: [
      {
        id: "p1",
        layers: [
          { id: "bg", type: "brand", element: "smk-backdrop", x: 0, y: 0, locked: "brand", props: { variant: "post" } },
          { id: "title", type: "text", text: "Olá", font: "display", size: 48, color: "#FFFFFF", x: 80, y: 200 },
          { id: "tag", type: "text", text: "R$ 10", font: "body", size: 20, color: "#FFFFFF", x: 80, y: 300, locked: "position" },
        ],
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Renderização: os templates reproduzem as peças anteriores
// ---------------------------------------------------------------------------

/**
 * Hashes do SVG renderizado de cada preset oficial. Foram gravados depois de comparar,
 * pixel a pixel, a saída do motor anterior (main 6552706) com a do documento de cena:
 * 275 peças, diferença máxima de 1 pixel de antialiasing. Mudou o hash? Confira a peça
 * antes de atualizar o arquivo.
 */
const SNAPSHOTS = JSON.parse(readFileSync(new URL("./fixtures/scene-render-snapshots.json", import.meta.url), "utf8")) as Record<string, string>;

test("banners oficiais: SVG igual ao snapshot aprovado", () => {
  for (const [key, preset] of Object.entries(OFFICIAL_SMKON_PRESETS)) {
    for (const ratio of ["16:9", "1:1", "9:16"] as const) {
      const name = `banner:${key}:${ratio}`;
      assert.equal(sha(generateSmartBannerSvg({ ...preset, aspectRatio: ratio })), SNAPSHOTS[name], name);
    }
  }
});

test("posts oficiais: SVG igual ao snapshot aprovado", () => {
  for (const [key, post] of Object.entries(OFFICIAL_POST_PRESETS)) {
    for (const ratio of ["1:1", "4:5"] as const) {
      post.slides.forEach((slide, index) => {
        const name = `post:${key}:${ratio}:${index + 1}`;
        assert.equal(sha(generatePostSlideSvg(slide, ratio)), SNAPSHOTS[name], name);
      });
    }
  }
});

test("geradores anteriores agora renderizam pelo documento de cena", () => {
  const preset = OFFICIAL_SMKON_PRESETS["top-perifericos"];
  assert.equal(generateSmartBannerSvg(preset), renderPageSvg(bannerConfigToScene(preset)));
  const slide = Object.values(OFFICIAL_POST_PRESETS)[0].slides[0];
  assert.equal(generatePostSlideSvg(slide, "4:5"), renderPageSvg(postSlideToScene(slide, "4:5")));
});

test("texto do documento é escapado: o SVG continua XML válido e não injeta marcação", () => {
  const preset = OFFICIAL_SMKON_PRESETS["top-perifericos"];
  const svg = generateSmartBannerSvg({ ...preset, headline: `<script>alert("x")</script> & cia`, categoryTag: "Tecnologia & Setup" });
  assert.ok(!svg.includes("<script>"));
  assert.ok(svg.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; cia"));
  assert.ok(svg.includes("TECNOLOGIA &amp; SETUP"));
  assert.doesNotMatch(svg, /&(?!amp;|lt;|gt;|quot;|apos;|#)/, "nenhum & solto (o PNG exportado falhava com isso)");
  assert.equal(escapeXml(`'"<>&`), "&apos;&quot;&lt;&gt;&amp;");
});

test("rodapé sem categoria não imprime 'undefined'", () => {
  const preset = { ...OFFICIAL_SMKON_PRESETS["top-perifericos"], categoryTag: undefined };
  const svg = generateSmartBannerSvg(preset);
  assert.ok(!svg.includes("UNDEFINED") && !svg.includes("undefined"));
  assert.ok(svg.includes(">SMKON CURADORIA INTELIGENTE<"));
});

test("selo acompanha o tamanho do texto (fitText)", () => {
  const doc = banner();
  const page = doc.pages[0];
  const bg = page.layers.find((layer) => layer.id === "badge-bg");
  assert.ok(bg && bg.type === "rect");
  const longer = applyOperation(doc, { op: "layer.update", pageId: "capa", layerId: "badge", patch: { text: "UM SELO BEM MAIS LONGO QUE O ORIGINAL" } });
  const bg2 = longer.pages[0].layers.find((layer) => layer.id === "badge-bg");
  assert.ok(bg2 && bg2.type === "rect");
  assert.equal(rectWidth(bg2, longer.pages[0]), "UM SELO BEM MAIS LONGO QUE O ORIGINAL".length * 11 + 30);
});

test("ids de gradiente prefixados: miniaturas na mesma página não colidem", () => {
  const doc = banner();
  const a = renderPageSvg(doc, { idPrefix: "thumb1" });
  const b = renderPageSvg(doc, { idPrefix: "thumb2" });
  assert.ok(a.includes('id="thumb10-backdrop-bg"'));
  assert.ok(b.includes('id="thumb20-backdrop-bg"'));
  assert.ok(renderPageSvg(doc, { idPrefix: '"><x' }).includes('id="x0-backdrop-bg"'), "prefixo é saneado");
});

test("camada de imagem: URL resolvida vira <image>; sem URL, marcador de posição", () => {
  const assetId = "3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90";
  const doc = applyOperation(minimalDoc(), {
    op: "layer.add",
    pageId: "p1",
    layer: { id: "produto", type: "image", assetId, x: 100, y: 100, width: 400, height: 400 },
  });
  assert.match(renderPageSvg(doc, { resolveAsset: () => "https://x.supabase.co/a.png?token=1&b=2" }), /<image href="https:\/\/x\.supabase\.co\/a\.png\?token=1&amp;b=2"/);
  assert.match(renderPageSvg(doc), /stroke-dasharray="8 6"/);
});

test("camada oculta não é desenhada", () => {
  const doc = applyOperation(minimalDoc(), { op: "layer.update", pageId: "p1", layerId: "title", patch: { hidden: true } });
  assert.ok(!renderPageSvg(doc).includes(">Olá<"));
});

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

test("valida e normaliza: idempotente e serializável", () => {
  const doc = banner();
  assert.deepEqual(parseSceneDocument(JSON.parse(JSON.stringify(doc))), doc);
});

test("recusa documentos inválidos", () => {
  // Documento cru (JSON), mutado de propósito para quebrar a validação.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Raw = any;
  const base = JSON.parse(JSON.stringify(minimalDoc()));
  const cases: Array<[string, (d: Raw) => void]> = [
    ["campo desconhecido", (d) => { d.extra = 1; }],
    ["versão de schema", (d) => { d.schema = 2; }],
    ["vídeo ainda não suportado", (d) => { d.kind = "video"; }],
    ["imagem com duas páginas", (d) => { d.pages.push({ id: "p2", layers: [] }); }],
    ["lado pequeno demais", (d) => { d.width = 10; }],
    ["cor fora do padrão", (d) => { d.pages[0].layers[1].color = "red"; }],
    ["camada com campo desconhecido", (d) => { d.pages[0].layers[1].onclick = "x"; }],
    ["id de camada repetido", (d) => { d.pages[0].layers[2].id = "title"; }],
    ["id com caracteres proibidos", (d) => { d.pages[0].layers[1].id = 'a"b'; }],
    ["elemento de marca desconhecido", (d) => { d.pages[0].layers[0].element = "logo-concorrente"; }],
    ["parâmetro obrigatório faltando", (d) => { d.pages[0].layers[0].props = {}; }],
    ["parâmetro fora da lista", (d) => { d.pages[0].layers[0].props.variant = "outro"; }],
    ["imagem fora da biblioteca", (d) => { d.pages[0].layers.push({ id: "img", type: "image", assetId: "https://site/x.png", x: 0, y: 0, width: 10, height: 10 }); }],
    ["número não finito", (d) => { d.pages[0].layers[1].x = Number.NaN; }],
    ["texto longo demais", (d) => { d.pages[0].layers[1].text = "x".repeat(SCENE_LIMITS.maxTextLength + 1); }],
    ["fitText para camada inexistente", (d) => { d.pages[0].layers.push({ id: "r", type: "rect", x: 0, y: 0, width: 1, height: 1, fitText: { layerId: "nada", charWidth: 1, padding: 0, minWidth: 0 } }); }],
  ];
  for (const [name, mutate] of cases) {
    const doc = structuredClone(base);
    mutate(doc);
    assert.throws(() => parseSceneDocument(doc), /Documento de cena inválido/, name);
  }
});

test("recusa documento acima de 256 KB", () => {
  const doc = JSON.parse(JSON.stringify(minimalDoc()));
  doc.kind = "carousel";
  doc.pages = Array.from({ length: SCENE_LIMITS.maxPages }, (_, p) => ({
    id: `p${p}`,
    layers: Array.from({ length: 40 }, (_, i) => ({ id: `t${i}`, type: "text", text: "é".repeat(400), font: "body", size: 10, color: "#FFFFFF", x: 0, y: 0 })),
  }));
  assert.throws(() => parseSceneDocument(doc), /maior que 256 KB/);
});

// ---------------------------------------------------------------------------
// Operações e travas
// ---------------------------------------------------------------------------

test("operação devolve documento novo e não altera o anterior", () => {
  const doc = minimalDoc();
  const snapshot = JSON.stringify(doc);
  const next = applyOperation(doc, { op: "layer.update", pageId: "p1", layerId: "title", patch: { text: "Novo" } });
  assert.equal(JSON.stringify(doc), snapshot);
  assert.equal((next.pages[0].layers[1] as TextLayer).text, "Novo");
});

test("camada da marca: travada sem allowBrand, editável por owner/admin", () => {
  const doc = minimalDoc();
  assert.throws(() => applyOperation(doc, { op: "layer.update", pageId: "p1", layerId: "bg", patch: { x: 10 } }), SceneOperationError);
  assert.throws(() => applyOperation(doc, { op: "layer.remove", pageId: "p1", layerId: "bg" }), SceneOperationError);
  assert.throws(() => applyOperation(doc, { op: "layer.move", pageId: "p1", layerId: "bg", toIndex: 2 }), SceneOperationError);
  assert.throws(() => applyOperation(doc, { op: "layer.lock", pageId: "p1", layerId: "bg", locked: null }), SceneOperationError);
  assert.throws(() => applyOperation(doc, { op: "layer.lock", pageId: "p1", layerId: "title", locked: "brand" }), SceneOperationError);
  assert.throws(() => applyOperation(doc, { op: "page.remove", pageId: "p1" }), SceneOperationError);
  const moved = applyOperation(doc, { op: "layer.update", pageId: "p1", layerId: "bg", patch: { x: 10 } }, { allowBrand: true });
  assert.equal(moved.pages[0].layers[0].x, 10);
});

test("posição travada: conteúdo editável, geometria não", () => {
  const doc = minimalDoc();
  const edited = applyOperation(doc, { op: "layer.update", pageId: "p1", layerId: "tag", patch: { text: "R$ 9", color: "#F59E0B" } });
  assert.equal((edited.pages[0].layers[2] as TextLayer).text, "R$ 9");
  assert.throws(() => applyOperation(doc, { op: "layer.update", pageId: "p1", layerId: "tag", patch: { y: 1 } }), /posição travada/);
});

test("id, tipo e trava não mudam por atualização; patch inválido é recusado inteiro", () => {
  const doc = minimalDoc();
  for (const patch of [{ id: "x" }, { type: "rect" }, { locked: "brand" }]) {
    assert.throws(() => applyOperation(doc, { op: "layer.update", pageId: "p1", layerId: "title", patch }), SceneOperationError);
  }
  assert.throws(() => applyOperation(doc, { op: "layer.update", pageId: "p1", layerId: "title", patch: { color: "javascript:alert(1)" } }), /cor/);
  assert.throws(() => applyOperation(doc, { op: "layer.update", pageId: "p1", layerId: "nada", patch: {} }), /não existe/);
});

test("adicionar, mover e remover camadas e páginas", () => {
  let doc = minimalDoc();
  doc = applyOperation(doc, { op: "layer.add", pageId: "p1", index: 1, layer: { id: "box", type: "rect", x: 0, y: 0, width: 10, height: 10, fill: "#FFFFFF" } });
  assert.deepEqual(doc.pages[0].layers.map((l) => l.id), ["bg", "box", "title", "tag"]);
  doc = applyOperation(doc, { op: "layer.move", pageId: "p1", layerId: "box", toIndex: 3 });
  assert.deepEqual(doc.pages[0].layers.map((l) => l.id), ["bg", "title", "tag", "box"]);
  doc = applyOperation(doc, { op: "layer.remove", pageId: "p1", layerId: "box" });
  assert.deepEqual(doc.pages[0].layers.map((l) => l.id), ["bg", "title", "tag"]);
  assert.throws(() => applyOperation(doc, { op: "layer.add", pageId: "p1", layer: { id: "title", type: "rect", x: 0, y: 0, width: 1, height: 1 } }), /repetido/);
  assert.throws(() => applyOperation(doc, { op: "layer.add", pageId: "p1", layer: { id: "z", type: "rect", x: 0, y: 0, width: 1, height: 1, locked: "brand" } }), SceneOperationError);
  assert.throws(() => applyOperation(doc, { op: "page.add", page: { id: "p2", layers: [] } }), /exatamente uma página/);
});

test("carrossel: páginas reordenáveis e operações em lote atômicas", () => {
  const post = Object.values(OFFICIAL_POST_PRESETS).find((item) => item.slides.length > 2);
  assert.ok(post, "existe preset com 3 ou mais slides");
  const doc = postPackageToScene(post);
  assert.equal(doc.kind, "carousel");
  const ids = doc.pages.map((p) => p.id);
  const moved = applyOperation(doc, { op: "page.move", pageId: ids[0], toIndex: ids.length - 1 });
  assert.equal(moved.pages.at(-1)?.id, ids[0]);
  assert.throws(() =>
    applyOperations(doc, [
      { op: "layer.update", pageId: ids[0], layerId: "headline", patch: { text: "ok" } },
      { op: "layer.update", pageId: ids[0], layerId: "mascot", patch: { x: 0 } },
    ]),
  );
  assert.equal((doc.pages[0].layers.find((l) => l.id === "headline") as TextLayer).text, post.slides[0].headline, "nada aplicado");
});

// ---------------------------------------------------------------------------
// Template: reabrir no formulário
// ---------------------------------------------------------------------------

test("banner: parâmetros do formulário voltam do documento até ser editado à mão", () => {
  const config = OFFICIAL_SMKON_PRESETS["top-perifericos"];
  const doc = bannerConfigToScene(config);
  assert.deepEqual(bannerConfigFromScene(doc), JSON.parse(JSON.stringify(config)));
  const edited = applyOperation(doc, { op: "layer.update", pageId: "capa", layerId: "headline", patch: { text: "Outro" } });
  assert.equal(edited.template?.detached, true);
  assert.equal(bannerConfigFromScene(edited), null);
});

test("post: parâmetros do formulário voltam do documento", () => {
  const post = Object.values(OFFICIAL_POST_PRESETS)[0];
  assert.deepEqual(postPackageFromScene(postPackageToScene(post)), JSON.parse(JSON.stringify(post)));
  assert.equal(postPackageFromScene(banner()), null);
});

// ---------------------------------------------------------------------------
// Histórico
// ---------------------------------------------------------------------------

test("desfazer e refazer", () => {
  let history = createHistory(minimalDoc());
  assert.equal(canUndo(history), false);
  history = commit(history, { op: "layer.update", pageId: "p1", layerId: "title", patch: { text: "A" } });
  history = commit(history, { op: "layer.update", pageId: "p1", layerId: "title", patch: { text: "B" } });
  const text = () => (history.present.pages[0].layers[1] as TextLayer).text;
  assert.equal(text(), "B");
  history = undo(history);
  assert.equal(text(), "A");
  assert.equal(canRedo(history), true);
  history = redo(history);
  assert.equal(text(), "B");
  history = undo(undo(history));
  assert.equal(text(), "Olá");
  history = commit(history, { op: "layer.update", pageId: "p1", layerId: "title", patch: { text: "C" } });
  assert.equal(canRedo(history), false, "operação nova descarta o refazer");
  assert.equal(undo(createHistory(minimalDoc())).present.pages[0].id, "p1", "desfazer sem passado não quebra");
});

test("histórico limitado", () => {
  let history = createHistory(minimalDoc());
  for (let i = 0; i < HISTORY_LIMIT + 20; i += 1) {
    history = commit(history, { op: "layer.update", pageId: "p1", layerId: "title", patch: { text: `v${i}` } });
  }
  assert.equal(history.past.length, HISTORY_LIMIT);
});
