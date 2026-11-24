/**
 * Renderizador SVG do documento de cena.
 *
 * Determinístico: o mesmo documento gera o mesmo SVG, na prévia e na exportação.
 * Todo texto vindo do documento é escapado (o SVG é injetado como HTML na prévia
 * e vira imagem na exportação). Fontes por classe, sem <style>, por causa da CSP
 * (ver media/svg-typography.ts).
 */
import { applySvgTypography } from "../media/svg-typography.ts";
import { BRAND_ELEMENTS } from "./elements.ts";
import type { BrandLayer, FontRole, ImageLayer, RectLayer, SceneDocument, SceneLayer, ScenePage, TextLayer } from "./types.ts";

export type RenderOptions = {
  /** Página do carrossel; 0 por padrão. */
  pageIndex?: number;
  /** URL assinada da mídia; sem ela a camada vira um marcador de posição. */
  resolveAsset?: (assetId: string) => string | undefined;
  /** Prefixo dos ids de gradientes: vários SVGs na mesma página (miniaturas) não colidem. */
  idPrefix?: string;
  /** Editor: envolve cada camada em <g data-layer="id"> para seleção e medida (não usar na exportação). */
  annotate?: boolean;
};

const FONT_CLASS: Record<FontRole, string> = {
  display: "sora-title",
  badge: "sora-badge",
  body: "inter-body",
};

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Número curto e estável no SVG (sem ruído de ponto flutuante). */
export function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function common(layer: SceneLayer, rotateAround: [number, number] | null): string {
  const parts: string[] = [];
  if (layer.opacity !== undefined && layer.opacity !== 1) parts.push(` opacity="${fmt(layer.opacity)}"`);
  if (rotateAround && layer.rotation) {
    parts.push(` transform="rotate(${fmt(layer.rotation)} ${fmt(rotateAround[0])} ${fmt(rotateAround[1])})"`);
  }
  return parts.join("");
}

/** Largura efetiva de um retângulo que acompanha um texto (selos e etiquetas). */
export function rectWidth(layer: RectLayer, page: ScenePage): number {
  if (!layer.fitText) return layer.width;
  const target = page.layers.find((item) => item.id === layer.fitText?.layerId);
  const length = target && target.type === "text" ? target.text.length : 0;
  return Math.max(layer.fitText.minWidth, length * layer.fitText.charWidth + layer.fitText.padding);
}

function renderText(layer: TextLayer): string {
  const attrs = [
    `class="${FONT_CLASS[layer.font]}"`,
    `x="${fmt(layer.x)}"`,
    `y="${fmt(layer.y)}"`,
    `font-size="${fmt(layer.size)}"`,
  ];
  if (layer.weight !== undefined) attrs.push(`font-weight="${layer.weight}"`);
  attrs.push(`fill="${layer.color}"`);
  if (layer.anchor && layer.anchor !== "start") attrs.push(`text-anchor="${layer.anchor}"`);
  if (layer.letterSpacing !== undefined) attrs.push(`letter-spacing="${fmt(layer.letterSpacing)}em"`);
  return `<text ${attrs.join(" ")}${common(layer, [layer.x, layer.y])}>${escapeXml(layer.text)}</text>`;
}

function renderRect(layer: RectLayer, page: ScenePage): string {
  const width = rectWidth(layer, page);
  const attrs = [`x="${fmt(layer.x)}"`, `y="${fmt(layer.y)}"`, `width="${fmt(width)}"`, `height="${fmt(layer.height)}"`];
  if (layer.radius) attrs.push(`rx="${fmt(layer.radius)}"`);
  attrs.push(`fill="${layer.fill ?? "none"}"`);
  if (layer.stroke) attrs.push(`stroke="${layer.stroke}"`, `stroke-width="${fmt(layer.strokeWidth ?? 1)}"`);
  const center: [number, number] = [layer.x + width / 2, layer.y + layer.height / 2];
  return `<rect ${attrs.join(" ")}${common(layer, center)} />`;
}

function renderImage(layer: ImageLayer, options: RenderOptions): string {
  const center: [number, number] = [layer.x + layer.width / 2, layer.y + layer.height / 2];
  const box = `x="${fmt(layer.x)}" y="${fmt(layer.y)}" width="${fmt(layer.width)}" height="${fmt(layer.height)}"`;
  const url = options.resolveAsset?.(layer.assetId);
  if (url) {
    const aspect = layer.fit === "contain" ? "xMidYMid meet" : "xMidYMid slice";
    return `<image href="${escapeXml(url)}" ${box} preserveAspectRatio="${aspect}"${common(layer, center)} />`;
  }
  return `<rect ${box} fill="#11161F" stroke="#64748B" stroke-width="2" stroke-dasharray="8 6"${common(layer, center)} />`;
}

function renderBrand(layer: BrandLayer, doc: SceneDocument, uidPrefix: string, defs: string[]): string {
  const spec = BRAND_ELEMENTS[layer.element];
  if (!spec) return "";
  const uid = `${uidPrefix}-${layer.id}`;
  const out = spec.render(layer.props, { width: doc.width, height: doc.height, uid });
  defs.push(...out.defs);
  const transform = [`translate(${fmt(layer.x)}, ${fmt(layer.y)})`];
  if (layer.rotation) transform.push(`rotate(${fmt(layer.rotation)})`);
  if (layer.scale !== undefined && layer.scale !== 1) transform.push(`scale(${fmt(layer.scale)})`);
  return `<g transform="${transform.join(" ")}"${common(layer, null)}>${out.body}</g>`;
}

/** SVG de uma página do documento. */
export function renderPageSvg(doc: SceneDocument, options: RenderOptions = {}): string {
  const pageIndex = options.pageIndex ?? 0;
  const page = doc.pages[pageIndex];
  if (!page) throw new RangeError(`Página ${pageIndex} não existe.`);

  const idPrefix = (options.idPrefix ?? "s").replace(/[^a-zA-Z0-9_-]/g, "") || "s";
  const defs: string[] = [];
  const body: string[] = [];
  for (const layer of page.layers) {
    if (layer.hidden) continue;
    let markup = "";
    switch (layer.type) {
      case "text":
        markup = renderText(layer);
        break;
      case "rect":
        markup = renderRect(layer, page);
        break;
      case "image":
        markup = renderImage(layer, options);
        break;
      case "brand":
        markup = renderBrand(layer, doc, `${idPrefix}${pageIndex}`, defs);
        break;
    }
    // O id da camada segue SCENE_ID_PATTERN ([a-z0-9-]), seguro em atributo.
    body.push(options.annotate ? `<g data-layer="${layer.id}">${markup}</g>` : markup);
  }
  const uniqueDefs = [...new Set(defs)];
  return applySvgTypography(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${doc.width} ${doc.height}" width="${doc.width}" height="${doc.height}">` +
      (uniqueDefs.length ? `<defs>${uniqueDefs.join("")}</defs>` : "") +
      body.join("\n") +
      `</svg>`,
  );
}
