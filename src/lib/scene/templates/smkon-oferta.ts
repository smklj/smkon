/**
 * Template "smkon-oferta" (F3): card de oferta montado a partir do produto.
 *
 * Nome, preço, fonte/data do preço e avaliação são camadas ligadas (bindings.ts): o
 * texto vem do catálogo e das evidências verificadas, nunca digitado. Selo e chamada
 * são texto livre da campanha. Fundo, grade, halo, logo e mascote ficam travados como
 * marca. Funciona em 1:1, 4:5 e 9:16.
 */
import type { MascotExpression } from "../../media/brand-system.ts";
import { ValidationError } from "../../http/errors.ts";
import { isUuid } from "../../validation/fields.ts";
import { BindingError, formatBinding, type BindingData } from "../bindings.ts";
import { isSceneFormat, SCENE_FORMATS, type SceneFormat } from "../geometry.ts";
import { parseSceneDocument } from "../schema.ts";
import type { FieldBinding, JsonObject, SceneDocument, SceneLayer, TextLayer } from "../types.ts";

export const SMKON_OFFER_TEMPLATE = { id: "smkon-oferta", version: 1 } as const;

export const OFFER_EXPRESSIONS: readonly MascotExpression[] = ["oferta", "confirmado", "feliz", "padrao", "pensativo", "surpreso"];

export type OfferParams = {
  productId: string;
  priceEvidenceId: string;
  ratingEvidenceId?: string;
  aspectRatio: SceneFormat;
  badgeText: string;
  headline: string;
  mascotExpression: MascotExpression;
  accentColor: string;
};

/** Textos já formatados das camadas ligadas (vindos dos dados ou do próprio documento). */
export type OfferTexts = { name: string; price: string; priceSource: string; rating?: string };

export const OFFER_DEFAULTS = {
  badgeText: "ACHADO VERIFICADO",
  headline: "OFERTA DO DIA",
  mascotExpression: "oferta" as MascotExpression,
  accentColor: "#F59E0B",
  aspectRatio: "4:5" as SceneFormat,
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Valida os parâmetros vindos do formulário ou da API (o lote usa os mesmos). */
export function parseOfferOptions(raw: Record<string, unknown>): Omit<OfferParams, "productId" | "priceEvidenceId" | "ratingEvidenceId"> {
  const text = (value: unknown, fallback: string, label: string) => {
    const result = typeof value === "string" ? value.trim() : fallback;
    if (!result || result.length > 40) throw new ValidationError(`${label}: de 1 a 40 caracteres.`);
    return result;
  };
  const aspectRatio = raw.aspectRatio ?? OFFER_DEFAULTS.aspectRatio;
  if (!isSceneFormat(aspectRatio)) throw new ValidationError("Formato deve ser 1:1, 4:5 ou 9:16.");
  const expression = raw.mascotExpression ?? OFFER_DEFAULTS.mascotExpression;
  if (!OFFER_EXPRESSIONS.includes(expression as MascotExpression)) throw new ValidationError("Expressão do mascote inválida.");
  const accent = raw.accentColor ?? OFFER_DEFAULTS.accentColor;
  if (typeof accent !== "string" || !HEX.test(accent)) throw new ValidationError("Cor de destaque inválida.");
  return {
    aspectRatio,
    badgeText: text(raw.badgeText, OFFER_DEFAULTS.badgeText, "Selo"),
    headline: text(raw.headline, OFFER_DEFAULTS.headline, "Chamada"),
    mascotExpression: expression as MascotExpression,
    accentColor: accent.toUpperCase(),
  };
}

/** Textos das camadas ligadas a partir dos dados (lança BindingError se faltar evidência verificada). */
export function offerTexts(params: OfferParams, data: BindingData): OfferTexts {
  const bind = (field: FieldBinding["field"], evidenceId?: string): FieldBinding =>
    evidenceId ? { field, productId: params.productId, evidenceId } : { field, productId: params.productId };
  return {
    name: formatBinding(bind("product.name"), data),
    price: formatBinding(bind("price.value", params.priceEvidenceId), data),
    priceSource: formatBinding(bind("price.source", params.priceEvidenceId), data),
    ...(params.ratingEvidenceId ? { rating: formatBinding(bind("rating.value", params.ratingEvidenceId), data) } : {}),
  };
}

/** Corpo do nome cabendo na largura útil (o nome é o do catálogo, não é cortado). */
function nameSize(name: string): number {
  return Math.max(28, Math.min(56, Math.floor(920 / (Math.max(1, name.length) * 0.58))));
}

export function offerToScene(params: OfferParams, texts: OfferTexts): SceneDocument {
  if (!isUuid(params.productId) || !isUuid(params.priceEvidenceId)) throw new BindingError("Oferta sem produto ou preço verificado.");
  const { width, height } = SCENE_FORMATS[params.aspectRatio];
  const vertical = params.aspectRatio === "9:16";
  const left = 80;
  const top = Math.round(height * (vertical ? 0.22 : 0.2));
  const accent = params.accentColor;
  const productId = params.productId;
  const priceBind: FieldBinding = { field: "price.value", productId, evidenceId: params.priceEvidenceId };
  const sourceBind: FieldBinding = { field: "price.source", productId, evidenceId: params.priceEvidenceId };
  const pillTop = top + 250;
  const mascotY = height - (vertical ? 420 : 230);

  const layers: SceneLayer[] = [
    { id: "backdrop", name: "Fundo", type: "brand", element: "smk-backdrop", x: 0, y: 0, locked: "brand", props: { variant: "post" } },
    { id: "grid", name: "Grade", type: "brand", element: "smk-grid", x: 0, y: 0, locked: "brand", props: { rows: 8, cols: 10, opacity: 0.04 } },
    {
      id: "halo",
      name: "Halo",
      type: "brand",
      element: "smk-halo",
      x: 860,
      y: mascotY,
      locked: "brand",
      props: { r: 340, accent, secondary: "#2563FF", inner: 0.28, mid: 0.12 },
    },
    { id: "logo", name: "Logo SMKON", type: "brand", element: "smk-logo", x: left, y: 60, locked: "brand", props: { variant: "post" } },
    {
      id: "mascot",
      name: "Mascote SMK",
      type: "brand",
      element: "smk-mascot",
      x: 860,
      y: mascotY,
      scale: vertical ? 1.3 : 1.1,
      locked: "brand",
      props: { variant: "compact", expression: params.mascotExpression, accent },
    },
    {
      id: "badge-bg",
      name: "Selo (fundo)",
      type: "rect",
      x: left,
      y: top,
      width: Math.max(180, params.badgeText.length * 13 + 32),
      height: 40,
      radius: 8,
      fill: accent,
      fitText: { layerId: "badge", charWidth: 13, padding: 32, minWidth: 180 },
    },
    { id: "badge", name: "Selo", type: "text", text: params.badgeText, font: "badge", size: 16, weight: 800, color: "#080D12", x: left + 16, y: top + 27 },
    { id: "headline", name: "Chamada", type: "text", text: params.headline, font: "display", size: 64, color: "#FFFFFF", x: left, y: top + 120 },
    {
      id: "name",
      name: "Nome do produto",
      type: "text",
      text: texts.name,
      font: "display",
      size: nameSize(texts.name),
      weight: 800,
      color: "#E2E8F0",
      x: left,
      y: top + 195,
      bind: { field: "product.name", productId },
    },
    {
      id: "price-bg",
      name: "Preço (fundo)",
      type: "rect",
      x: left,
      y: pillTop,
      width: Math.max(260, texts.price.length * 38 + 56),
      height: 96,
      radius: 16,
      fill: accent,
      fitText: { layerId: "price", charWidth: 38, padding: 56, minWidth: 260 },
    },
    { id: "price", name: "Preço", type: "text", text: texts.price, font: "display", size: 64, color: "#080D12", x: left + 28, y: pillTop + 72, bind: priceBind },
    {
      id: "price-source",
      name: "Fonte e data do preço",
      type: "text",
      text: texts.priceSource,
      font: "body",
      size: 24,
      color: "#94A3B8",
      x: left,
      y: pillTop + 140,
      bind: sourceBind,
    },
  ];

  if (params.ratingEvidenceId && texts.rating) {
    layers.push({
      id: "rating",
      name: "Avaliação",
      type: "text",
      text: texts.rating,
      font: "badge",
      size: 30,
      color: accent,
      x: left,
      y: pillTop + 196,
      bind: { field: "rating.value", productId, evidenceId: params.ratingEvidenceId },
    });
  }

  layers.push({
    id: "footer",
    name: "Rodapé",
    type: "text",
    text: "SMKON CURADORIA INTELIGENTE",
    font: "body",
    size: 18,
    weight: 700,
    color: "#64748B",
    letterSpacing: 0.05,
    x: left,
    y: height - 60,
  });

  const params_: JsonObject = {
    productId,
    priceEvidenceId: params.priceEvidenceId,
    aspectRatio: params.aspectRatio,
    badgeText: params.badgeText,
    headline: params.headline,
    mascotExpression: params.mascotExpression,
    accentColor: accent,
    ...(params.ratingEvidenceId ? { ratingEvidenceId: params.ratingEvidenceId } : {}),
  };

  return parseSceneDocument({
    schema: 1,
    kind: "image",
    width,
    height,
    template: { ...SMKON_OFFER_TEMPLATE, params: params_ },
    pages: [{ id: "oferta", layers }],
  });
}

/** Parâmetros e textos de um documento gerado por este template e não editado à mão. */
export function offerFromScene(doc: SceneDocument): { params: OfferParams; texts: OfferTexts } | null {
  const template = doc.template;
  if (!template || template.id !== SMKON_OFFER_TEMPLATE.id || template.detached) return null;
  const layers = doc.pages[0]?.layers ?? [];
  const textOf = (id: string) => (layers.find((layer) => layer.id === id && layer.type === "text") as TextLayer | undefined)?.text;
  const name = textOf("name");
  const price = textOf("price");
  const priceSource = textOf("price-source");
  if (name === undefined || price === undefined || priceSource === undefined) return null;
  try {
    const raw = template.params as Record<string, unknown>;
    const options = parseOfferOptions(raw);
    if (!isUuid(raw.productId) || !isUuid(raw.priceEvidenceId)) return null;
    const params: OfferParams = {
      ...options,
      productId: raw.productId,
      priceEvidenceId: raw.priceEvidenceId,
      ...(isUuid(raw.ratingEvidenceId) ? { ratingEvidenceId: raw.ratingEvidenceId } : {}),
    };
    const rating = textOf("rating");
    const texts: OfferTexts = { name, price, priceSource, ...(rating !== undefined ? { rating } : {}) };
    offerToScene(params, texts);
    return { params, texts };
  } catch {
    return null;
  }
}
