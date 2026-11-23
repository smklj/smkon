/**
 * Template "smkon-post": posts e carrosséis de feed (1:1 ou 4:5) como documento de cena.
 *
 * Cada slide vira uma página com o layout do gerador anterior
 * (content/smart-post-generator.ts): fundo, halo, grade, logo, mascote compacto e
 * assinatura travados como marca; selo, título, destaque, corpo, tópicos e CTA editáveis.
 */
import { SMKON_BRAND_TOKENS } from "../../media/brand-system.ts";
import type { PostSlide, SmartPostPackage } from "../../content/smart-post-generator.ts";
import { parseSceneDocument } from "../schema.ts";
import type { JsonObject, SceneDocument, SceneLayer, ScenePage } from "../types.ts";

export const SMKON_POST_TEMPLATE = { id: "smkon-post", version: 1 } as const;

export type PostAspectRatio = "1:1" | "4:5";

export function postDimensions(aspectRatio: PostAspectRatio): { width: number; height: number } {
  return { width: 1080, height: aspectRatio === "4:5" ? 1350 : 1080 };
}

export function slideToPage(slide: PostSlide, aspectRatio: PostAspectRatio): ScenePage {
  const { width, height } = postDimensions(aspectRatio);
  const multi = slide.totalSlides > 1;
  const highlight = Boolean(slide.highlightText);
  const left = 80;
  const top = 160;

  const layers: SceneLayer[] = [
    { id: "backdrop", name: "Fundo", type: "brand", element: "smk-backdrop", x: 0, y: 0, locked: "brand", props: { variant: "post" } },
    {
      id: "halo",
      name: "Halo",
      type: "brand",
      element: "smk-halo",
      x: 820,
      y: height * 0.45,
      locked: "brand",
      props: { r: 360, accent: slide.accentColor, secondary: slide.secondaryColor, inner: 0.28, mid: 0.12 },
    },
    { id: "grid", name: "Grade", type: "brand", element: "smk-grid", x: 0, y: 0, locked: "brand", props: { rows: 8, cols: 10, opacity: 0.04 } },
    { id: "logo", name: "Logo SMKON", type: "brand", element: "smk-logo", x: 80, y: 50, locked: "brand", props: { variant: "post" } },
  ];

  if (multi) {
    layers.push({
      id: "dots",
      name: "Indicador do carrossel",
      type: "brand",
      element: "carousel-dots",
      x: width - 240,
      y: 65,
      locked: "brand",
      props: { index: slide.slideNumber, total: slide.totalSlides, accent: slide.accentColor },
    });
  }

  layers.push(
    {
      id: "mascot",
      name: "Mascote SMK",
      type: "brand",
      element: "smk-mascot",
      x: 840,
      y: height * 0.48,
      scale: 1.15,
      locked: "brand",
      props: { variant: "compact", expression: slide.mascotExpression, accent: slide.accentColor },
    },
    {
      id: "badge-bg",
      name: "Selo (fundo)",
      type: "rect",
      x: left,
      y: top,
      width: Math.max(160, slide.badge.length * 11 + 28),
      height: 36,
      radius: 8,
      fill: slide.accentColor,
      fitText: { layerId: "badge", charWidth: 11, padding: 28, minWidth: 160 },
    },
    { id: "badge", name: "Selo", type: "text", text: slide.badge, font: "badge", size: 13, weight: 800, color: "#080D12", x: left + 14, y: top + 23 },
    { id: "headline", name: "Título", type: "text", text: slide.headline, font: "display", size: 48, color: "#FFFFFF", x: left, y: top + 90 },
  );

  if (slide.highlightText) {
    layers.push(
      {
        id: "highlight-bg",
        name: "Destaque (fundo)",
        type: "rect",
        x: left,
        y: top + 115,
        width: Math.max(220, slide.highlightText.length * 24 + 30),
        height: 58,
        radius: 10,
        fill: slide.secondaryColor,
        fitText: { layerId: "highlight", charWidth: 24, padding: 30, minWidth: 220 },
      },
      { id: "highlight", name: "Destaque", type: "text", text: slide.highlightText, font: "display", size: 34, color: "#FFFFFF", x: left + 16, y: top + 157 },
    );
  }

  if (slide.bodyText) {
    layers.push({
      id: "body",
      name: "Texto",
      type: "text",
      text: slide.bodyText,
      font: "body",
      size: 22,
      weight: 500,
      color: "#CBD5E1",
      x: left,
      y: top + (highlight ? 210 : 135) + 20,
    });
  }

  const bulletsTop = top + (highlight ? 310 : 230);
  (slide.bulletPoints ?? []).forEach((point, index) => {
    const y = bulletsTop + index * 64;
    layers.push(
      { id: `bullet-${index + 1}-icon`, name: `Tópico ${index + 1} (ícone)`, type: "brand", element: "check-bullet", x: left, y, props: { accent: slide.accentColor } },
      {
        id: `bullet-${index + 1}`,
        name: `Tópico ${index + 1}`,
        type: "text",
        text: point,
        font: "body",
        size: 20,
        weight: 600,
        color: "#F1F5F9",
        x: left + 48,
        y: y + 24,
      },
    );
  });

  layers.push(
    {
      id: "cta",
      name: "Chamada",
      type: "text",
      text: slide.callToAction || (multi ? "Deslize para ver o próximo ➔" : SMKON_BRAND_TOKENS.slogan),
      font: "display",
      size: 18,
      color: slide.accentColor,
      x: left,
      y: height - 60,
    },
    {
      id: "handle",
      name: "Assinatura",
      type: "text",
      text: "@smkon.oficial",
      font: "body",
      size: 14,
      weight: 600,
      color: "#64748B",
      anchor: "end",
      x: left + width - 160,
      y: height - 60,
      locked: "brand",
    },
  );

  return { id: `slide-${slide.slideNumber}`, layers };
}

/** Um slide isolado (prévia e exportação PNG do slide ativo). */
export function postSlideToScene(slide: PostSlide, aspectRatio: PostAspectRatio = "1:1"): SceneDocument {
  const { width, height } = postDimensions(aspectRatio);
  return parseSceneDocument({ schema: 1, kind: "image", width, height, pages: [slideToPage(slide, aspectRatio)] });
}

/** O post inteiro: uma página por slide; a peça salva no Content Studio. */
export function postPackageToScene(post: SmartPostPackage): SceneDocument {
  const { width, height } = postDimensions(post.aspectRatio);
  return parseSceneDocument({
    schema: 1,
    kind: post.slides.length > 1 ? "carousel" : "image",
    width,
    height,
    template: { ...SMKON_POST_TEMPLATE, params: JSON.parse(JSON.stringify(post)) as JsonObject },
    pages: post.slides.map((slide) => slideToPage(slide, post.aspectRatio)),
  });
}

/** O post do formulário, quando o documento veio deste template e não foi editado à mão. */
export function postPackageFromScene(doc: SceneDocument): SmartPostPackage | null {
  const template = doc.template;
  if (!template || template.id !== SMKON_POST_TEMPLATE.id || template.detached) return null;
  const params = template.params as Partial<SmartPostPackage>;
  if (!Array.isArray(params.slides) || params.slides.length === 0 || typeof params.title !== "string") return null;
  // Parâmetros vêm do banco: só reabre no formulário se ainda geram um documento válido.
  try {
    postPackageToScene(params as SmartPostPackage);
    return params as SmartPostPackage;
  } catch {
    return null;
  }
}
