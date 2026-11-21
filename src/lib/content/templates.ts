import type { ContentPresetType } from "./autonomous-generator.ts";
import type { PostKind } from "./smart-post-generator.ts";

/** Modelos de partida do Content Studio. Preenchem o rascunho; nada é publicado nem aprovado. */
export type ContentTemplate =
  | { id: string; label: string; group: "video"; preset: ContentPresetType }
  | { id: string; label: string; group: "post"; kind: PostKind };

export const CONTENT_TEMPLATE_GROUPS: Record<ContentTemplate["group"], string> = {
  video: "Vídeo curto 9:16",
  post: "Post e carrossel",
};

export const CONTENT_TEMPLATES: readonly ContentTemplate[] = [
  { id: "video-achadinho", label: "Achadinho de marketplace", group: "video", preset: "shopee-viral" },
  { id: "video-moda", label: "Moda e look", group: "video", preset: "shein-fashion" },
  { id: "video-infoproduto", label: "Infoproduto digital", group: "video", preset: "digital-infoproduct" },
  { id: "video-curso", label: "Curso online", group: "video", preset: "hotmart-course" },
  { id: "post-carrossel", label: "Carrossel de 5 slides", group: "post", kind: "carousel-tips" },
  { id: "post-unico", label: "Post único", group: "post", kind: "feed-single" },
  { id: "post-batalha", label: "Comparativo A vs B", group: "post", kind: "battle-poll" },
  { id: "post-pergunta", label: "Pergunta para a comunidade", group: "post", kind: "question-box" },
  { id: "post-oferta", label: "Alerta de oferta", group: "post", kind: "offer-alert" },
];

export function findTemplate(id: string): ContentTemplate | undefined {
  return CONTENT_TEMPLATES.find((template) => template.id === id);
}

/** Usa o produto ou o título do rascunho; sem nenhum dos dois, deixa um marcador visível para trocar. */
export function templateSubject(draft: { product: string; title: string }, group: ContentTemplate["group"]): string {
  const product = draft.product.trim();
  if (product) return product;
  if (group === "post" && draft.title.trim()) return draft.title.trim();
  return group === "post" ? "[tema do post]" : "[nome do produto]";
}

/** true quando aplicar um modelo substituiria texto já escrito. */
export function draftHasWriting(draft: { script: string; caption: string; cta: string; hashtags: string }): boolean {
  return [draft.script, draft.caption, draft.cta, draft.hashtags].some((value) => value.trim().length > 0);
}
