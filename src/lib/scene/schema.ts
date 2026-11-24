/**
 * Validação estrita do documento de cena (v1).
 *
 * Devolve uma cópia só com as chaves conhecidas: o que chega do navegador ou do
 * agente de IA nunca é gravado como veio. Chave desconhecida, tipo errado ou valor
 * fora do limite → ValidationError (400 na API). Os limites espelham o check do
 * banco (content_items.scene, 256 KB).
 */
import { ValidationError } from "../http/errors.ts";
import { isPlainObject, isUuid } from "../validation/fields.ts";
import { BRAND_ELEMENTS, type PropSpec } from "./elements.ts";
import {
  SCENE_SCHEMA,
  type BindField,
  type FieldBinding,
  type BrandLayer,
  type BrandPropValue,
  type FitText,
  type ImageLayer,
  type JsonObject,
  type JsonValue,
  type RectLayer,
  type SceneDocument,
  type SceneKind,
  type SceneLayer,
  type ScenePage,
  type SceneTemplateRef,
  type TextLayer,
} from "./types.ts";

export const SCENE_LIMITS = {
  /** Tamanho do JSON serializado; o banco recusa acima disso. */
  maxBytes: 262_144,
  maxTemplateParamsBytes: 65_536,
  minSide: 64,
  maxSide: 4096,
  maxPages: 10,
  maxLayersPerPage: 120,
  maxTextLength: 2000,
  maxCoordinate: 10_000,
  maxBrandProps: 24,
  maxJsonDepth: 6,
} as const;

export const SCENE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,47}$/;
const COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const PROP_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9]{0,31}$/;
const TEMPLATE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const KINDS: readonly SceneKind[] = ["image", "carousel"];
const FONTS = ["display", "badge", "body"] as const;
const ANCHORS = ["start", "middle", "end"] as const;
const LOCKS = ["brand", "position"] as const;

type Raw = Record<string, unknown>;

/** Tamanho em bytes UTF-8, como o octet_length do banco. */
export function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

function fail(path: string, message: string): never {
  throw new ValidationError(`Documento de cena inválido em ${path}: ${message}`);
}

function onlyKeys(value: Raw, allowed: readonly string[], path: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(path, `campo desconhecido "${key}".`);
  }
}

function object(value: unknown, path: string): Raw {
  if (!isPlainObject(value)) fail(path, "esperado um objeto.");
  return value as Raw;
}

function number(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "esperado um número.");
  if (value < min || value > max) fail(path, `fora do intervalo ${min}..${max}.`);
  return value;
}

function optionalNumber(value: unknown, path: string, min: number, max: number): number | undefined {
  return value === undefined ? undefined : number(value, path, min, max);
}

function integer(value: unknown, path: string, min: number, max: number): number {
  const n = number(value, path, min, max);
  if (!Number.isInteger(n)) fail(path, "esperado um inteiro.");
  return n;
}

function text(value: unknown, path: string, max: number): string {
  if (typeof value !== "string") fail(path, "esperado um texto.");
  if (value.length > max) fail(path, `texto acima de ${max} caracteres.`);
  return value;
}

function oneOf<T extends string>(value: unknown, path: string, options: readonly T[]): T {
  if (typeof value !== "string" || !options.includes(value as T)) fail(path, `valor fora de: ${options.join(", ")}.`);
  return value as T;
}

function color(value: unknown, path: string): string {
  if (typeof value !== "string" || !COLOR_PATTERN.test(value)) fail(path, "cor deve ser hexadecimal (#RRGGBB).");
  return value;
}

function sceneId(value: unknown, path: string): string {
  if (typeof value !== "string" || !SCENE_ID_PATTERN.test(value)) fail(path, "id deve usar a-z, 0-9 e hífen.");
  return value;
}

const C = SCENE_LIMITS.maxCoordinate;

function layerBase(raw: Raw, path: string) {
  const base: Pick<SceneLayer, "id" | "x" | "y" | "name" | "rotation" | "opacity" | "locked" | "hidden"> = {
    id: sceneId(raw.id, `${path}.id`),
    x: number(raw.x, `${path}.x`, -C, C),
    y: number(raw.y, `${path}.y`, -C, C),
  };
  if (raw.name !== undefined) base.name = text(raw.name, `${path}.name`, 80);
  const rotation = optionalNumber(raw.rotation, `${path}.rotation`, -360, 360);
  if (rotation !== undefined) base.rotation = rotation;
  const opacity = optionalNumber(raw.opacity, `${path}.opacity`, 0, 1);
  if (opacity !== undefined) base.opacity = opacity;
  if (raw.locked !== undefined) base.locked = oneOf(raw.locked, `${path}.locked`, LOCKS);
  if (raw.hidden !== undefined) {
    if (typeof raw.hidden !== "boolean") fail(`${path}.hidden`, "esperado true ou false.");
    base.hidden = raw.hidden;
  }
  return base;
}

const BASE_KEYS = ["id", "type", "name", "x", "y", "rotation", "opacity", "locked", "hidden"] as const;

const BIND_FIELDS: readonly BindField[] = ["product.name", "price.value", "price.source", "rating.value"];

function binding(value: unknown, path: string): FieldBinding {
  const raw = object(value, path);
  onlyKeys(raw, ["field", "productId", "evidenceId"], path);
  const field = oneOf(raw.field, `${path}.field`, BIND_FIELDS);
  if (!isUuid(raw.productId)) fail(`${path}.productId`, "produto inválido.");
  const result: FieldBinding = { field, productId: raw.productId };
  if (field === "product.name") {
    if (raw.evidenceId !== undefined) fail(`${path}.evidenceId`, "o nome vem do produto, sem evidência.");
  } else {
    if (!isUuid(raw.evidenceId)) fail(`${path}.evidenceId`, "este campo exige uma evidência verificada.");
    result.evidenceId = raw.evidenceId;
  }
  return result;
}

function textLayer(raw: Raw, path: string): TextLayer {
  onlyKeys(raw, [...BASE_KEYS, "text", "font", "size", "weight", "color", "anchor", "letterSpacing", "bind"], path);
  const layer: TextLayer = {
    ...layerBase(raw, path),
    type: "text",
    text: text(raw.text, `${path}.text`, SCENE_LIMITS.maxTextLength),
    font: oneOf(raw.font, `${path}.font`, FONTS),
    size: number(raw.size, `${path}.size`, 1, 512),
    color: color(raw.color, `${path}.color`),
  };
  if (raw.weight !== undefined) layer.weight = integer(raw.weight, `${path}.weight`, 100, 900);
  if (raw.anchor !== undefined) layer.anchor = oneOf(raw.anchor, `${path}.anchor`, ANCHORS);
  const spacing = optionalNumber(raw.letterSpacing, `${path}.letterSpacing`, -1, 2);
  if (spacing !== undefined) layer.letterSpacing = spacing;
  if (raw.bind !== undefined) layer.bind = binding(raw.bind, `${path}.bind`);
  return layer;
}

function fitText(value: unknown, path: string): FitText {
  const raw = object(value, path);
  onlyKeys(raw, ["layerId", "charWidth", "padding", "minWidth"], path);
  return {
    layerId: sceneId(raw.layerId, `${path}.layerId`),
    charWidth: number(raw.charWidth, `${path}.charWidth`, 0, 512),
    padding: number(raw.padding, `${path}.padding`, 0, C),
    minWidth: number(raw.minWidth, `${path}.minWidth`, 0, C),
  };
}

function rectLayer(raw: Raw, path: string): RectLayer {
  onlyKeys(raw, [...BASE_KEYS, "width", "height", "radius", "fill", "stroke", "strokeWidth", "fitText"], path);
  const layer: RectLayer = {
    ...layerBase(raw, path),
    type: "rect",
    width: number(raw.width, `${path}.width`, 0, C),
    height: number(raw.height, `${path}.height`, 0, C),
  };
  const radius = optionalNumber(raw.radius, `${path}.radius`, 0, C);
  if (radius !== undefined) layer.radius = radius;
  if (raw.fill !== undefined) layer.fill = color(raw.fill, `${path}.fill`);
  if (raw.stroke !== undefined) layer.stroke = color(raw.stroke, `${path}.stroke`);
  const strokeWidth = optionalNumber(raw.strokeWidth, `${path}.strokeWidth`, 0, 256);
  if (strokeWidth !== undefined) layer.strokeWidth = strokeWidth;
  if (raw.fitText !== undefined) layer.fitText = fitText(raw.fitText, `${path}.fitText`);
  return layer;
}

function imageLayer(raw: Raw, path: string): ImageLayer {
  onlyKeys(raw, [...BASE_KEYS, "assetId", "width", "height", "fit"], path);
  if (!isUuid(raw.assetId)) fail(`${path}.assetId`, "mídia deve ser um id da biblioteca.");
  const layer: ImageLayer = {
    ...layerBase(raw, path),
    type: "image",
    assetId: raw.assetId as string,
    width: number(raw.width, `${path}.width`, 1, C),
    height: number(raw.height, `${path}.height`, 1, C),
  };
  if (raw.fit !== undefined) layer.fit = oneOf(raw.fit, `${path}.fit`, ["cover", "contain"] as const);
  return layer;
}

function brandProp(spec: PropSpec, value: unknown, path: string): BrandPropValue {
  switch (spec.type) {
    case "enum":
      return oneOf(value, path, spec.values);
    case "number":
      return number(value, path, spec.min, spec.max);
    case "int":
      return integer(value, path, spec.min, spec.max);
    case "color":
      return color(value, path);
  }
}

function brandLayer(raw: Raw, path: string): BrandLayer {
  onlyKeys(raw, [...BASE_KEYS, "element", "scale", "props"], path);
  const element = typeof raw.element === "string" ? raw.element : "";
  const spec = Object.prototype.hasOwnProperty.call(BRAND_ELEMENTS, element) ? BRAND_ELEMENTS[element] : undefined;
  if (!spec) fail(`${path}.element`, "elemento de marca desconhecido.");
  const rawProps = object(raw.props ?? {}, `${path}.props`);
  if (Object.keys(rawProps).length > SCENE_LIMITS.maxBrandProps) fail(`${path}.props`, "parâmetros demais.");
  const props: Record<string, BrandPropValue> = {};
  for (const key of Object.keys(rawProps)) {
    if (!PROP_KEY_PATTERN.test(key) || !Object.prototype.hasOwnProperty.call(spec.props, key)) {
      fail(`${path}.props`, `parâmetro desconhecido "${key}".`);
    }
    props[key] = brandProp(spec.props[key], rawProps[key], `${path}.props.${key}`);
  }
  for (const [key, propSpec] of Object.entries(spec.props)) {
    if (propSpec.required && !(key in props)) fail(`${path}.props.${key}`, "parâmetro obrigatório.");
  }
  const layer: BrandLayer = { ...layerBase(raw, path), type: "brand", element, props };
  const scale = optionalNumber(raw.scale, `${path}.scale`, 0.01, 100);
  if (scale !== undefined) layer.scale = scale;
  return layer;
}

export function parseSceneLayer(value: unknown, path = "camada"): SceneLayer {
  const raw = object(value, path);
  switch (raw.type) {
    case "text":
      return textLayer(raw, path);
    case "rect":
      return rectLayer(raw, path);
    case "image":
      return imageLayer(raw, path);
    case "brand":
      return brandLayer(raw, path);
    default:
      return fail(`${path}.type`, "tipo de camada desconhecido.");
  }
}

function page(value: unknown, path: string): ScenePage {
  const raw = object(value, path);
  onlyKeys(raw, ["id", "layers"], path);
  if (!Array.isArray(raw.layers)) fail(`${path}.layers`, "esperada uma lista.");
  if (raw.layers.length > SCENE_LIMITS.maxLayersPerPage) fail(`${path}.layers`, `no máximo ${SCENE_LIMITS.maxLayersPerPage} camadas.`);
  const layers = raw.layers.map((layer, index) => parseSceneLayer(layer, `${path}.layers[${index}]`));
  const ids = new Set<string>();
  for (const layer of layers) {
    if (ids.has(layer.id)) fail(`${path}.layers`, `id repetido "${layer.id}".`);
    ids.add(layer.id);
  }
  for (const layer of layers) {
    if (layer.type === "rect" && layer.fitText) {
      const target = layers.find((item) => item.id === layer.fitText?.layerId);
      if (!target || target.type !== "text") fail(`${path}.layers`, `"${layer.id}" acompanha uma camada de texto inexistente.`);
    }
  }
  return { id: sceneId(raw.id, `${path}.id`), layers };
}

function json(value: unknown, path: string, depth: number): JsonValue {
  if (depth > SCENE_LIMITS.maxJsonDepth) fail(path, "estrutura profunda demais.");
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail(path, "número inválido.");
    return value;
  }
  if (Array.isArray(value)) return value.map((item, index) => json(item, `${path}[${index}]`, depth + 1));
  if (isPlainObject(value)) {
    const out: JsonObject = {};
    for (const [key, item] of Object.entries(value)) out[key] = json(item, `${path}.${key}`, depth + 1);
    return out;
  }
  return fail(path, "valor não serializável.");
}

function template(value: unknown, path: string): SceneTemplateRef {
  const raw = object(value, path);
  onlyKeys(raw, ["id", "version", "params", "detached"], path);
  if (typeof raw.id !== "string" || !TEMPLATE_ID_PATTERN.test(raw.id)) fail(`${path}.id`, "id de template inválido.");
  const params = json(object(raw.params ?? {}, `${path}.params`), `${path}.params`, 1) as JsonObject;
  if (utf8Bytes(JSON.stringify(params)) > SCENE_LIMITS.maxTemplateParamsBytes) fail(`${path}.params`, "parâmetros grandes demais.");
  const ref: SceneTemplateRef = { id: raw.id, version: integer(raw.version, `${path}.version`, 1, 1000), params };
  if (raw.detached !== undefined) {
    if (typeof raw.detached !== "boolean") fail(`${path}.detached`, "esperado true ou false.");
    ref.detached = raw.detached;
  }
  return ref;
}

/** Valida e normaliza um documento de cena v1. */
export function parseSceneDocument(value: unknown): SceneDocument {
  const raw = object(value, "documento");
  onlyKeys(raw, ["schema", "kind", "width", "height", "template", "pages"], "documento");
  if (raw.schema !== SCENE_SCHEMA) fail("documento.schema", `versão suportada: ${SCENE_SCHEMA}.`);
  const kind = oneOf(raw.kind, "documento.kind", KINDS);
  if (!Array.isArray(raw.pages) || raw.pages.length === 0) fail("documento.pages", "ao menos uma página.");
  if (raw.pages.length > SCENE_LIMITS.maxPages) fail("documento.pages", `no máximo ${SCENE_LIMITS.maxPages} páginas.`);
  if (kind === "image" && raw.pages.length !== 1) fail("documento.pages", "imagem tem exatamente uma página.");

  const doc: SceneDocument = {
    schema: SCENE_SCHEMA,
    kind,
    width: integer(raw.width, "documento.width", SCENE_LIMITS.minSide, SCENE_LIMITS.maxSide),
    height: integer(raw.height, "documento.height", SCENE_LIMITS.minSide, SCENE_LIMITS.maxSide),
    pages: raw.pages.map((item, index) => page(item, `documento.pages[${index}]`)),
  };
  const pageIds = new Set<string>();
  for (const item of doc.pages) {
    if (pageIds.has(item.id)) fail("documento.pages", `id de página repetido "${item.id}".`);
    pageIds.add(item.id);
  }
  if (raw.template !== undefined) doc.template = template(raw.template, "documento.template");

  if (utf8Bytes(JSON.stringify(doc)) > SCENE_LIMITS.maxBytes) fail("documento", "maior que 256 KB.");
  return doc;
}
