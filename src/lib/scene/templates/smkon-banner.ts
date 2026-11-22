/**
 * Template "smkon-banner": capa oficial SMKON (16:9, 1:1, 9:16) como documento de cena.
 *
 * Reproduz o layout do gerador anterior (media/smart-banner-engine.ts), agora em
 * camadas: fundo, grade, halo, logo e mascote ficam travados como marca; selo,
 * título, destaque, subtítulo, preço e rodapé são camadas editáveis.
 */
import type { BannerAspectRatio } from "../../media/brand-system.ts";
import type { SmartBannerConfig } from "../../media/smart-banner-engine.ts";
import { parseSceneDocument } from "../schema.ts";
import type { JsonObject, SceneDocument, SceneLayer } from "../types.ts";

export const SMKON_BANNER_TEMPLATE = { id: "smkon-banner", version: 1 } as const;

/** Dimensões canônicas em pixels por proporção. */
export function getBannerDimensions(ratio: BannerAspectRatio): { width: number; height: number } {
  switch (ratio) {
    case "16:9":
      return { width: 1280, height: 720 };
    case "9:16":
      return { width: 720, height: 1280 };
    case "1:1":
      return { width: 1080, height: 1080 };
  }
}

export function bannerConfigToScene(config: SmartBannerConfig): SceneDocument {
  const { width, height } = getBannerDimensions(config.aspectRatio);
  const vertical = config.aspectRatio === "9:16";
  const square = config.aspectRatio === "1:1";

  const mascotX = vertical ? width * 0.5 : width * 0.78;
  const mascotY = vertical ? height * 0.65 : height * 0.58;
  const mascotScale = vertical ? 1.35 : square ? 1.15 : 1.0;
  const contentX = vertical ? 60 : 70;
  const contentY = vertical ? 160 : 200;
  const highlight = Boolean(config.highlightWord);

  const layers: SceneLayer[] = [
    { id: "backdrop", name: "Fundo", type: "brand", element: "smk-backdrop", x: 0, y: 0, locked: "brand", props: { variant: "banner" } },
    { id: "grid", name: "Grade", type: "brand", element: "smk-grid", x: 0, y: 0, locked: "brand", props: { rows: 8, cols: 12, opacity: 0.05 } },
    {
      id: "halo",
      name: "Halo",
      type: "brand",
      element: "smk-halo",
      x: mascotX,
      y: mascotY,
      locked: "brand",
      props: { r: vertical ? 420 : 380, accent: config.accentColor, secondary: config.secondaryColor, inner: 0.32, mid: 0.14 },
    },
    { id: "logo", name: "Logo SMKON", type: "brand", element: "smk-logo", x: contentX, y: 60, locked: "brand", props: { variant: "banner" } },
    {
      id: "mascot",
      name: "Mascote SMK",
      type: "brand",
      element: "smk-mascot",
      x: mascotX,
      y: mascotY,
      scale: mascotScale,
      locked: "brand",
      props: {
        variant: "full",
        expression: config.mascotExpression,
        accent: config.accentColor,
        hud: config.showHolographicHud ? (config.hudContent ?? "tech") : "none",
        hudX: vertical ? 150 : -140,
        hudY: vertical ? -80 : -70,
      },
    },
    {
      id: "badge-bg",
      name: "Selo (fundo)",
      type: "rect",
      x: contentX,
      y: contentY,
      width: Math.max(160, config.badgeText.length * 11 + 30),
      height: 34,
      radius: 8,
      fill: config.accentColor,
      fitText: { layerId: "badge", charWidth: 11, padding: 30, minWidth: 160 },
    },
    { id: "badge", name: "Selo", type: "text", text: config.badgeText, font: "badge", size: 13, weight: 800, color: "#080D12", x: contentX + 14, y: contentY + 22 },
    {
      id: "headline",
      name: "Título",
      type: "text",
      text: config.headline,
      font: "display",
      size: vertical ? 46 : 56,
      color: "#FFFFFF",
      x: contentX,
      y: contentY + (vertical ? 85 : 80),
    },
  ];

  if (config.highlightWord) {
    const top = contentY + (vertical ? 115 : 105);
    layers.push(
      {
        id: "highlight-bg",
        name: "Destaque (fundo)",
        type: "rect",
        x: contentX,
        y: top,
        width: Math.max(180, config.highlightWord.length * 28 + 24),
        height: vertical ? 58 : 68,
        radius: 12,
        fill: config.secondaryColor,
        fitText: { layerId: "highlight", charWidth: 28, padding: 24, minWidth: 180 },
      },
      {
        id: "highlight",
        name: "Destaque",
        type: "text",
        text: config.highlightWord,
        font: "display",
        size: vertical ? 38 : 46,
        color: "#FFFFFF",
        x: contentX + 14,
        y: top + (vertical ? 42 : 50),
      },
    );
  }

  if (config.subheadline) {
    const offset = vertical ? (highlight ? 215 : 145) : highlight ? 215 : 135;
    layers.push({
      id: "subheadline",
      name: "Subtítulo",
      type: "text",
      text: config.subheadline,
      font: "body",
      size: vertical ? 18 : 20,
      weight: 600,
      color: "#94A3B8",
      x: contentX,
      y: contentY + offset,
    });
  }

  if (config.priceTag) {
    const top = contentY + (vertical ? (highlight ? 255 : 185) : highlight ? 250 : 170);
    layers.push(
      {
        id: "price-bg",
        name: "Preço (fundo)",
        type: "rect",
        x: contentX,
        y: top,
        width: Math.max(150, config.priceTag.length * 16 + 32),
        height: 46,
        radius: 10,
        fill: "#11161F",
        stroke: config.accentColor,
        strokeWidth: 2,
        fitText: { layerId: "price", charWidth: 16, padding: 32, minWidth: 150 },
      },
      { id: "price", name: "Preço", type: "text", text: config.priceTag, font: "display", size: 20, color: config.accentColor, x: contentX + 16, y: top + 30 },
    );
  }

  const category = config.categoryTag?.trim();
  layers.push({
    id: "footer",
    name: "Rodapé",
    type: "text",
    text: `${category ? `${category.toUpperCase()} · ` : ""}SMKON CURADORIA INTELIGENTE`,
    font: "body",
    size: 13,
    weight: 700,
    color: "#64748B",
    letterSpacing: 0.05,
    x: contentX,
    y: height - 40,
  });

  return parseSceneDocument({
    schema: 1,
    kind: "image",
    width,
    height,
    template: { ...SMKON_BANNER_TEMPLATE, params: JSON.parse(JSON.stringify(config)) as JsonObject },
    pages: [{ id: "capa", layers }],
  });
}

/** Parâmetros do formulário salvos na peça, quando o documento veio deste template e não foi editado à mão. */
export function bannerConfigFromScene(doc: SceneDocument): SmartBannerConfig | null {
  const template = doc.template;
  if (!template || template.id !== SMKON_BANNER_TEMPLATE.id || template.detached) return null;
  const params = template.params as Partial<SmartBannerConfig>;
  if (typeof params.headline !== "string" || typeof params.badgeText !== "string" || typeof params.aspectRatio !== "string") return null;
  // Parâmetros vêm do banco: só reabre no formulário se ainda geram um documento válido.
  try {
    bannerConfigToScene(params as SmartBannerConfig);
    return params as SmartBannerConfig;
  } catch {
    return null;
  }
}
