import { test } from "node:test";
import assert from "node:assert/strict";

import {
  assertBindingsMatch,
  assertBindingStructure,
  BindingError,
  bindingRefs,
  formatBinding,
  formatDateBr,
  formatMoney,
  refreshBindings,
  sourceHost,
  unboundPriceLayers,
  type BindingData,
} from "../../src/lib/scene/bindings.ts";
import { applyOperation, SceneOperationError } from "../../src/lib/scene/operations.ts";
import { parseSceneDocument } from "../../src/lib/scene/schema.ts";
import { reformatScene } from "../../src/lib/scene/templates/index.ts";
import { offerFromScene, offerTexts, offerToScene, OFFER_DEFAULTS, parseOfferOptions, type OfferParams } from "../../src/lib/scene/templates/smkon-oferta.ts";
import { parseOfferBatchInput, planOfferBatch } from "../../src/lib/content/offer-batch.ts";
import { renderPageSvg } from "../../src/lib/scene/render.ts";
import type { SceneDocument, TextLayer } from "../../src/lib/scene/types.ts";

const P1 = "aaaaaaaa-0000-4000-8000-000000000001";
const P2 = "aaaaaaaa-0000-4000-8000-000000000002";
const PRICE = "bbbbbbbb-0000-4000-8000-000000000001";
const PRICE_NEW = "bbbbbbbb-0000-4000-8000-000000000002";
const RATING = "bbbbbbbb-0000-4000-8000-000000000003";
const PENDING = "bbbbbbbb-0000-4000-8000-000000000004";

function data(): BindingData {
  return {
    products: { [P1]: { id: P1, name: "Fone Bluetooth X1", currency: "BRL" } },
    evidence: {
      [PRICE]: { id: PRICE, productId: P1, kind: "price", value: 1299.9, sourceUrl: "https://www.loja.com.br/x1", observedAt: "2026-11-20T02:30:00Z", reviewStatus: "verified" },
      [PRICE_NEW]: { id: PRICE_NEW, productId: P1, kind: "price", value: 1199, sourceUrl: "https://outra.com/x1", observedAt: "2026-11-23T15:00:00Z", reviewStatus: "verified" },
      [RATING]: { id: RATING, productId: P1, kind: "rating", value: 4.7, sourceUrl: "https://loja.com.br/x1#reviews", observedAt: "2026-11-20T12:00:00Z", reviewStatus: "verified" },
      [PENDING]: { id: PENDING, productId: P1, kind: "price", value: 10, sourceUrl: "https://loja.com.br/x1", observedAt: "2026-11-20T12:00:00Z", reviewStatus: "pending" },
    },
  };
}

const params = (extra: Partial<OfferParams> = {}): OfferParams => ({
  ...OFFER_DEFAULTS,
  productId: P1,
  priceEvidenceId: PRICE,
  ratingEvidenceId: RATING,
  ...extra,
});

const offer = () => offerToScene(params(), offerTexts(params(), data()));
const layer = (doc: SceneDocument, id: string) => doc.pages[0].layers.find((item) => item.id === id) as TextLayer;

test("formatação: dinheiro, data em Brasília e domínio da fonte", () => {
  assert.equal(formatMoney(1299.9, "BRL"), "R$ 1.299,90");
  assert.equal(formatMoney(0.5, "brl"), "R$ 0,50");
  assert.equal(formatMoney(1234567.891, "USD"), "US$ 1.234.567,89");
  assert.equal(formatMoney(10, "GBP"), "GBP 10,00");
  assert.equal(formatDateBr("2026-11-20T02:30:00Z"), "19/11/2026", "UTC-3: ainda é dia 19 em Brasília");
  assert.equal(sourceHost("https://www.loja.com.br/x?y=1"), "loja.com.br");
  assert.throws(() => formatDateBr("ontem"), BindingError);
});

test("formatBinding: só evidência verificada, do produto certo e do tipo certo", () => {
  const d = data();
  assert.equal(formatBinding({ field: "product.name", productId: P1 }, d), "Fone Bluetooth X1");
  assert.equal(formatBinding({ field: "price.value", productId: P1, evidenceId: PRICE }, d), "R$ 1.299,90");
  assert.equal(formatBinding({ field: "price.source", productId: P1, evidenceId: PRICE }, d), "Preço em loja.com.br em 19/11/2026");
  assert.equal(formatBinding({ field: "rating.value", productId: P1, evidenceId: RATING }, d), "★ 4,7/5");
  assert.throws(() => formatBinding({ field: "price.value", productId: P1, evidenceId: PENDING }, d), /só evidência verificada/);
  assert.throws(() => formatBinding({ field: "price.value", productId: P1, evidenceId: RATING }, d), /tipo certo/);
  assert.throws(() => formatBinding({ field: "price.value", productId: P2, evidenceId: PRICE }, d), /não encontrada para este produto/);
  assert.throws(() => formatBinding({ field: "product.name", productId: P2 }, d), /não existe/);
});

test("schema: vínculo validado (evidência obrigatória no preço, proibida no nome)", () => {
  const base = offer();
  const bad = (bind: unknown) => {
    const raw = structuredClone(base) as unknown as { pages: { layers: Record<string, unknown>[] }[] };
    raw.pages[0].layers.find((item) => item.id === "name")!.bind = bind;
    return () => parseSceneDocument(raw);
  };
  assert.throws(bad({ field: "price.value", productId: P1 }), /exige uma evidência/);
  assert.throws(bad({ field: "product.name", productId: P1, evidenceId: PRICE }), /sem evidência/);
  assert.throws(bad({ field: "preco", productId: P1 }), /Documento de cena inválido/);
  assert.throws(bad({ field: "product.name", productId: "x" }), /produto inválido/);
});

test("template oferta: camadas ligadas, preço sempre com fonte e data, texto bate com o dado", () => {
  const doc = offer();
  assert.equal(doc.template?.id, "smkon-oferta");
  assert.equal(layer(doc, "price").text, "R$ 1.299,90");
  assert.deepEqual(layer(doc, "price-source").bind, { field: "price.source", productId: P1, evidenceId: PRICE });
  assert.equal(layer(doc, "rating").text, "★ 4,7/5");
  assertBindingsMatch(doc, data());
  assert.deepEqual(bindingRefs(doc), { productIds: [P1], evidenceIds: [PRICE, RATING] });
  const svg = renderPageSvg(doc);
  assert.ok(svg.includes("Preço em loja.com.br em 19/11/2026"));
  assert.equal(unboundPriceLayers(doc).length, 0);
  // Sem avaliação: a camada não existe.
  const noRating = offerToScene(params({ ratingEvidenceId: undefined }), offerTexts(params({ ratingEvidenceId: undefined }), data()));
  assert.equal(noRating.pages[0].layers.some((item) => item.id === "rating"), false);
});

test("preço digitado: recusado no editor (operação) e na conferência do servidor", () => {
  const doc = offer();
  assert.throws(
    () => applyOperation(doc, { op: "layer.update", pageId: "oferta", layerId: "price", patch: { text: "R$ 9,90" } }),
    (error: unknown) => error instanceof SceneOperationError && /vem dos dados do produto/.test(error.message),
  );
  assert.throws(() => applyOperation(doc, { op: "layer.update", pageId: "oferta", layerId: "price", patch: { bind: null } }), SceneOperationError);
  // Pela API: documento inteiro com o texto trocado.
  const forged = structuredClone(doc);
  layer(forged, "price").text = "R$ 9,90";
  assert.throws(() => assertBindingsMatch(forged, data()), /deve mostrar "R\$ 1\.299,90"/);
  // Cor e tamanho continuam editáveis.
  const styled = applyOperation(doc, { op: "layer.update", pageId: "oferta", layerId: "price", patch: { color: "#FFFFFF", size: 70 } });
  assertBindingsMatch(styled, data());
});

test("preço sem fonte: remover ou ocultar a linha de fonte é recusado", () => {
  const doc = offer();
  const removed = applyOperation(doc, { op: "layer.remove", pageId: "oferta", layerId: "price-source" });
  assert.throws(() => assertBindingStructure(removed), /preço sem a fonte e a data/);
  const hidden = applyOperation(doc, { op: "layer.update", pageId: "oferta", layerId: "price-source", patch: { hidden: true } });
  assert.throws(() => assertBindingStructure(hidden), /preço sem a fonte/);
  const priceHidden = applyOperation(doc, { op: "layer.update", pageId: "oferta", layerId: "price", patch: { hidden: true } });
  assert.throws(() => assertBindingStructure(priceHidden), /não pode ficar oculto/);
  // Fonte apontando para outra evidência também não vale.
  const other = applyOperation(doc, {
    op: "layer.rebind",
    pageId: "oferta",
    layerId: "price-source",
    bind: { field: "price.source", productId: P1, evidenceId: PRICE_NEW },
    text: "Preço em outra.com em 23/11/2026",
  });
  assert.throws(() => assertBindingStructure(other), /preço sem a fonte/);
  // Remover preço e fonte juntos é permitido.
  assert.throws(() => applyOperation(removed, { op: "layer.remove", pageId: "oferta", layerId: "price" }), /remova "Preço \(fundo\)" primeiro/);
  const noPill = applyOperation(removed, { op: "layer.remove", pageId: "oferta", layerId: "price-bg" });
  const both = applyOperation(noPill, { op: "layer.remove", pageId: "oferta", layerId: "price" });
  assertBindingStructure(both);
});

test("refreshBindings troca para a evidência verificada mais nova e recalcula os textos", () => {
  const { doc, changed } = refreshBindings(offer(), data(), { [P1]: { price: PRICE_NEW, rating: RATING } });
  assert.equal(changed, 2);
  assert.equal(layer(doc, "price").text, "R$ 1.199,00");
  assert.equal(layer(doc, "price-source").text, "Preço em outra.com em 23/11/2026");
  assert.equal(layer(doc, "price").bind?.evidenceId, PRICE_NEW);
  assertBindingsMatch(doc, data());
  assert.equal(refreshBindings(doc, data(), { [P1]: { price: PRICE_NEW, rating: RATING } }).changed, 0);
});

test("oferta reabre e troca de formato pelo template, mantendo os vínculos", () => {
  const doc = offer();
  const reopened = offerFromScene(doc);
  assert.ok(reopened);
  assert.equal(reopened.texts.price, "R$ 1.299,90");
  for (const format of ["1:1", "9:16"] as const) {
    const result = reformatScene(doc, format);
    assert.equal(result.via, "template");
    assertBindingsMatch(result.doc, data());
  }
  assert.equal(reformatScene(doc, "9:16").doc.height, 1920);
  const edited = applyOperation(doc, { op: "layer.update", pageId: "oferta", layerId: "headline", patch: { text: "OUTRA" } });
  assert.equal(offerFromScene(edited), null, "editado à mão não volta ao template");
  assert.throws(() => parseOfferOptions({ aspectRatio: "16:9" }), /1:1, 4:5 ou 9:16/);
  assert.throws(() => parseOfferOptions({ headline: "x".repeat(41) }), /1 a 40/);
});

test("lote: um rascunho por produto com preço verificado; os demais saem com o motivo", () => {
  const input = parseOfferBatchInput({ productIds: [P1, P2, "cccccccc-0000-4000-8000-000000000009"], channels: ["Instagram"], options: { aspectRatio: "1:1" } });
  const products = {
    [P1]: { id: P1, name: "Fone Bluetooth X1", currency: "BRL", status: "active", affiliateUrl: "https://loja.com.br/afiliado" },
    [P2]: { id: P2, name: "Teclado Y", currency: "BRL", status: "selected", affiliateUrl: null },
  };
  const plan = planOfferBatch(input, products, data().evidence, { [P1]: { price: PRICE, rating: RATING } });
  assert.equal(plan.items.length, 1);
  const [item] = plan.items;
  assert.equal(item.row.title, "OFERTA DO DIA — Fone Bluetooth X1");
  assert.equal(item.row.status, "draft");
  assert.equal(item.row.asset_url, "https://loja.com.br/afiliado");
  assert.match(item.row.caption, /R\$ 1\.299,90 · Preço em loja\.com\.br em 19\/11\/2026/);
  assert.equal(item.scene.width, 1080);
  assert.equal(item.scene.height, 1080);
  assertBindingsMatch(item.scene, data());
  assert.deepEqual(
    plan.skipped.map((skip) => skip.reason),
    ["Sem preço verificado: registre e verifique uma evidência de preço.", "Produto não encontrado neste workspace."],
  );
  const archived = planOfferBatch(input, { ...products, [P1]: { ...products[P1], status: "archived" } }, data().evidence, { [P1]: { price: PRICE } });
  assert.equal(archived.items.length, 0);
  assert.throws(() => parseOfferBatchInput({ productIds: [], channels: ["Instagram"] }), /1 a 20/);
  assert.throws(() => parseOfferBatchInput({ productIds: [P1], channels: ["Orkut"] }), /canal/);
});

test("preço digitado sem vínculo é detectado (a fila avisa)", () => {
  const doc = parseSceneDocument({
    schema: 1,
    kind: "image",
    width: 1080,
    height: 1080,
    pages: [{ id: "p", layers: [
      { id: "a", type: "text", text: "ATÉ R$300", font: "display", size: 40, color: "#FFFFFF", x: 0, y: 0 },
      { id: "b", type: "text", text: "Sem preço", font: "display", size: 40, color: "#FFFFFF", x: 0, y: 0 },
    ] }],
  });
  assert.deepEqual(unboundPriceLayers(doc), ["a"]);
});
