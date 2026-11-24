/**
 * Documento de cena do Content Studio (F1).
 *
 * Fonte única da verdade de uma peça visual: o editor humano e o agente de IA
 * escrevem nele por operações (operations.ts); a prévia e a exportação saem do
 * mesmo renderizador (render.ts). O JSON entra no content_hash da peça, então
 * qualquer edição cria versão nova e exige nova aprovação.
 *
 * v1 cobre imagem (1 página) e carrossel (N páginas). Vídeo entra na F4 com
 * trilhas; o validador recusa `kind: "video"` até lá.
 */

export const SCENE_SCHEMA = 1 as const;

export type SceneKind = "image" | "carousel";

/** "brand": só owner/admin altera. "position": conteúdo editável, posição e tamanho fixos. */
export type LayerLock = "brand" | "position";

/** Papel tipográfico; o renderizador traduz para as classes de svg-typography.ts. */
export type FontRole = "display" | "badge" | "body";

export type TextAnchor = "start" | "middle" | "end";

type LayerBase = {
  /** [a-z0-9-], único na página. Também prefixa os ids de gradientes do elemento. */
  id: string;
  name?: string;
  x: number;
  y: number;
  /** Graus, sentido horário. */
  rotation?: number;
  /** 0 a 1. */
  opacity?: number;
  locked?: LayerLock;
  hidden?: boolean;
};

/**
 * Texto que vem de um dado do produto (F3). O vínculo aponta para o produto e, nos campos
 * de evidência, para a evidência verificada: como a evidência é imutável depois da revisão,
 * a versão aprovada fica presa àquele valor, fonte e data. O texto da camada precisa ser
 * exatamente o dado formatado (bindings.ts), conferido no servidor ao salvar.
 */
export type BindField = "product.name" | "price.value" | "price.source" | "rating.value";

export type FieldBinding = {
  field: BindField;
  productId: string;
  /** Obrigatório em price.* e rating.value; ausente em product.name. */
  evidenceId?: string;
};

export type TextLayer = LayerBase & {
  type: "text";
  bind?: FieldBinding;
  text: string;
  font: FontRole;
  size: number;
  weight?: number;
  color: string;
  anchor?: TextAnchor;
  /** Em `em`, como no CSS. */
  letterSpacing?: number;
};

/** Largura que acompanha o texto de outra camada (selos, etiquetas de preço). */
export type FitText = { layerId: string; charWidth: number; padding: number; minWidth: number };

export type RectLayer = LayerBase & {
  type: "rect";
  width: number;
  height: number;
  radius?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fitText?: FitText;
};

/** Mídia da biblioteca (media_assets): licença rastreada, nunca URL externa. */
export type ImageLayer = LayerBase & {
  type: "image";
  assetId: string;
  width: number;
  height: number;
  fit?: "cover" | "contain";
};

export type BrandPropValue = string | number | boolean;

/** Elemento de marca (fundo, grade, logo, mascote...): desenho oficial parametrizado. */
export type BrandLayer = LayerBase & {
  type: "brand";
  element: string;
  scale?: number;
  props: Record<string, BrandPropValue>;
};

export type SceneLayer = TextLayer | RectLayer | ImageLayer | BrandLayer;
export type SceneLayerType = SceneLayer["type"];

export type ScenePage = {
  id: string;
  layers: SceneLayer[];
};

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

/**
 * Template que gerou o documento e os parâmetros do formulário, para reabrir a peça
 * no mesmo formulário. `detached` vira true quando uma camada é editada à mão: a partir
 * daí as camadas, e não os parâmetros, são a verdade.
 */
export type SceneTemplateRef = {
  id: string;
  version: number;
  params: JsonObject;
  detached?: boolean;
};

export type SceneDocument = {
  schema: typeof SCENE_SCHEMA;
  kind: SceneKind;
  width: number;
  height: number;
  template?: SceneTemplateRef;
  pages: ScenePage[];
};
