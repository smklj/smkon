/**
 * Geometria do editor de camadas: transformar arrastos e alças em patches de operação,
 * e criar camadas novas. Funções puras (testadas sem navegador); o editor só mede a
 * caixa de cada camada no SVG renderizado e chama estas funções.
 */
import { BRAND_ELEMENTS } from "./elements.ts";
import type { LayerPatch } from "./operations.ts";
import { parseSceneDocument } from "./schema.ts";
import type { ImageLayer, RectLayer, SceneDocument, SceneLayer, ScenePage, TextLayer } from "./types.ts";

export type Box = { x: number; y: number; width: number; height: number };

/** Uma casa decimal: o documento não acumula ruído de ponto flutuante dos arrastos. */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function movePatch(layer: SceneLayer, dx: number, dy: number): LayerPatch {
  return { x: round1(layer.x + dx), y: round1(layer.y + dy) };
}

/** Menor caixa que uma alça aceita, em pixels do documento. */
export const MIN_SIZE = 8;

/**
 * Redimensionar pela alça do canto inferior direito, de `box` (caixa medida) para
 * `width` × `height`. Retângulos e imagens mudam largura/altura; texto muda o corpo
 * da fonte pela altura; elementos de marca mudam a escala pela largura.
 */
export function resizePatch(layer: SceneLayer, box: Box, width: number, height: number): LayerPatch {
  const w = Math.max(MIN_SIZE, width);
  const h = Math.max(MIN_SIZE, height);
  switch (layer.type) {
    case "rect":
    case "image":
      return layer.type === "rect" && layer.fitText ? { height: round1(h) } : { width: round1(w), height: round1(h) };
    case "text": {
      const ratio = box.height > 0 ? h / box.height : 1;
      return { size: Math.min(512, Math.max(1, round1(layer.size * ratio))) };
    }
    case "brand": {
      const ratio = box.width > 0 ? w / box.width : 1;
      return { scale: Math.min(100, Math.max(0.01, Math.round((layer.scale ?? 1) * ratio * 1000) / 1000)) };
    }
  }
}

/** Id novo e único na página, a partir de um prefixo ("texto", "texto-2", ...). */
export function nextLayerId(page: ScenePage, prefix: string): string {
  const ids = new Set(page.layers.map((layer) => layer.id));
  if (!ids.has(prefix)) return prefix;
  for (let n = 2; ; n += 1) {
    if (!ids.has(`${prefix}-${n}`)) return `${prefix}-${n}`;
  }
}

export function newTextLayer(doc: SceneDocument, page: ScenePage): TextLayer {
  return {
    id: nextLayerId(page, "texto"),
    name: "Texto",
    type: "text",
    text: "Novo texto",
    font: "display",
    size: Math.round(doc.width / 18),
    color: "#FFFFFF",
    x: round1(doc.width * 0.1),
    y: round1(doc.height * 0.5),
  };
}

export function newRectLayer(doc: SceneDocument, page: ScenePage): RectLayer {
  const width = round1(doc.width * 0.3);
  const height = round1(doc.height * 0.1);
  return {
    id: nextLayerId(page, "forma"),
    name: "Forma",
    type: "rect",
    x: round1((doc.width - width) / 2),
    y: round1((doc.height - height) / 2),
    width,
    height,
    radius: 12,
    fill: "#2563FF",
  };
}

/** Imagem da biblioteca centralizada, ocupando até 60% do lado menor, na proporção do arquivo. */
export function newImageLayer(doc: SceneDocument, page: ScenePage, assetId: string, natural?: { width: number; height: number }): ImageLayer {
  const side = Math.min(doc.width, doc.height) * 0.6;
  const aspect = natural && natural.width > 0 && natural.height > 0 ? natural.width / natural.height : 1;
  const width = round1(aspect >= 1 ? side : side * aspect);
  const height = round1(aspect >= 1 ? side / aspect : side);
  return {
    id: nextLayerId(page, "imagem"),
    name: "Imagem",
    type: "image",
    assetId,
    x: round1((doc.width - width) / 2),
    y: round1((doc.height - height) / 2),
    width,
    height,
    fit: "cover",
  };
}

/** Mídias da biblioteca usadas no documento (para assinar URLs e conferir licenças). */
export function sceneAssetIds(doc: SceneDocument | null): string[] {
  const ids = new Set<string>();
  for (const page of doc?.pages ?? []) {
    for (const layer of page.layers) if (layer.type === "image") ids.add(layer.assetId);
  }
  return [...ids];
}

/** Formatos de saída do editor (feed quadrado, feed retrato, stories/reels). */
export const SCENE_FORMATS = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
} as const;

export type SceneFormat = keyof typeof SCENE_FORMATS;

export function isSceneFormat(value: unknown): value is SceneFormat {
  return typeof value === "string" && Object.hasOwn(SCENE_FORMATS, value);
}

/** Proporção do documento, se for um dos formatos (aceita 720×1280 como 9:16). */
export function sceneFormatOf(doc: Pick<SceneDocument, "width" | "height">): SceneFormat | null {
  const ratio = doc.width / doc.height;
  for (const [format, size] of Object.entries(SCENE_FORMATS)) {
    if (Math.abs(ratio - size.width / size.height) < 0.01) return format as SceneFormat;
  }
  return null;
}

function scaleLayer(layer: SceneLayer, s: number, ox: number, oy: number): SceneLayer {
  if (layer.type === "brand" && BRAND_ELEMENTS[layer.element]?.fullBleed) return layer;
  const moved = { ...layer, x: round1(layer.x * s + ox), y: round1(layer.y * s + oy) };
  switch (moved.type) {
    case "text":
      return { ...moved, size: Math.min(512, Math.max(1, round1(moved.size * s))) };
    case "rect":
      return {
        ...moved,
        width: round1(moved.width * s),
        height: round1(moved.height * s),
        ...(moved.radius !== undefined ? { radius: round1(moved.radius * s) } : {}),
        ...(moved.strokeWidth !== undefined ? { strokeWidth: round1(moved.strokeWidth * s) } : {}),
        ...(moved.fitText
          ? {
              fitText: {
                ...moved.fitText,
                charWidth: round1(moved.fitText.charWidth * s),
                padding: round1(moved.fitText.padding * s),
                minWidth: round1(moved.fitText.minWidth * s),
              },
            }
          : {}),
      };
    case "image":
      return { ...moved, width: round1(moved.width * s), height: round1(moved.height * s) };
    case "brand":
      return { ...moved, scale: Math.min(100, Math.max(0.01, Math.round((moved.scale ?? 1) * s * 1000) / 1000)) };
  }
}

/**
 * Adapta o documento a outro tamanho sem template: escala uniforme (o conteúdo cabe
 * inteiro) e centraliza; fundo e grade ocupam a peça nova. É um ponto de partida —
 * o operador ajusta depois. Marca o template como editado à mão.
 */
export function reflowScene(doc: SceneDocument, width: number, height: number): SceneDocument {
  const s = Math.min(width / doc.width, height / doc.height);
  const ox = (width - doc.width * s) / 2;
  const oy = (height - doc.height * s) / 2;
  return parseSceneDocument({
    ...doc,
    width,
    height,
    ...(doc.template ? { template: { ...doc.template, detached: true } } : {}),
    pages: doc.pages.map((page) => ({ ...page, layers: page.layers.map((layer) => scaleLayer(layer, s, ox, oy)) })),
  });
}
