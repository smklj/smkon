/**
 * Campos ligados a dados do produto (F3).
 *
 * Uma camada de texto com `bind` mostra um dado do catálogo: nome do produto ou uma
 * evidência verificada (preço, fonte do preço, avaliação). Regras:
 *   - o texto é sempre o dado formatado aqui; ninguém digita preço numa camada ligada
 *     (o servidor recalcula e compara ao salvar);
 *   - preço nunca aparece sozinho: a mesma página traz a fonte e a data, ligadas à
 *     mesma evidência;
 *   - só evidência verificada (revisão humana) alimenta uma peça.
 * Funções puras: o editor, o lote e a API usam as mesmas.
 */
import { ValidationError } from "../http/errors.ts";
import type { BindField, FieldBinding, SceneDocument, TextLayer } from "./types.ts";

export class BindingError extends ValidationError {
  constructor(message: string) {
    super(message);
    this.name = "BindingError";
  }
}

export const BIND_FIELD_LABEL: Record<BindField, string> = {
  "product.name": "Nome do produto",
  "price.value": "Preço verificado",
  "price.source": "Fonte e data do preço",
  "rating.value": "Avaliação verificada",
};

/** Tipo de evidência de cada campo (null = vem do cadastro do produto). */
export const BIND_FIELD_KIND: Record<BindField, "price" | "rating" | null> = {
  "product.name": null,
  "price.value": "price",
  "price.source": "price",
  "rating.value": "rating",
};

export type BindingProduct = { id: string; name: string; currency: string };

export type BindingEvidence = {
  id: string;
  productId: string;
  kind: string;
  value: number | null;
  sourceUrl: string;
  /** ISO 8601. */
  observedAt: string;
  reviewStatus: "pending" | "verified" | "rejected";
};

export type BindingData = {
  products: Record<string, BindingProduct>;
  evidence: Record<string, BindingEvidence>;
};

const CURRENCY_PREFIX: Record<string, string> = { BRL: "R$", USD: "US$", EUR: "€" };

/** Dinheiro no padrão brasileiro, sem depender do ICU do ambiente (servidor e navegador iguais). */
export function formatMoney(value: number, currency: string): string {
  const cents = Math.round(value * 100);
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fraction = String(abs % 100).padStart(2, "0");
  const prefix = CURRENCY_PREFIX[currency.toUpperCase()] ?? currency.toUpperCase();
  return `${sign}${prefix} ${whole},${fraction}`;
}

/** Data no fuso de Brasília (UTC-3, sem horário de verão desde 2019), dd/mm/aaaa. */
export function formatDateBr(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) throw new BindingError("Data da evidência inválida.");
  const day = new Date(time - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

/** Domínio da fonte, sem "www.", para a linha "Preço em loja.com em dd/mm/aaaa". */
export function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    throw new BindingError("Link da evidência inválido.");
  }
}

function product(binding: FieldBinding, data: BindingData): BindingProduct {
  const found = data.products[binding.productId];
  if (!found) throw new BindingError("Produto ligado ao design não existe neste workspace.");
  return found;
}

function evidence(binding: FieldBinding, data: BindingData): BindingEvidence {
  const kind = BIND_FIELD_KIND[binding.field];
  const found = binding.evidenceId ? data.evidence[binding.evidenceId] : undefined;
  if (!found || found.productId !== binding.productId) {
    throw new BindingError(`${BIND_FIELD_LABEL[binding.field]}: evidência não encontrada para este produto.`);
  }
  if (found.kind !== kind) throw new BindingError(`${BIND_FIELD_LABEL[binding.field]}: a evidência ligada não é do tipo certo.`);
  if (found.reviewStatus !== "verified") {
    throw new BindingError(`${BIND_FIELD_LABEL[binding.field]}: só evidência verificada entra numa peça.`);
  }
  if (found.value === null) throw new BindingError(`${BIND_FIELD_LABEL[binding.field]}: evidência sem valor.`);
  return found;
}

/** Texto exato que uma camada ligada mostra. Lança BindingError se o dado não pode ser usado. */
export function formatBinding(binding: FieldBinding, data: BindingData): string {
  switch (binding.field) {
    case "product.name":
      return product(binding, data).name.trim();
    case "price.value":
      return formatMoney(evidence(binding, data).value as number, product(binding, data).currency);
    case "price.source": {
      const item = evidence(binding, data);
      return `Preço em ${sourceHost(item.sourceUrl)} em ${formatDateBr(item.observedAt)}`;
    }
    case "rating.value": {
      const value = evidence(binding, data).value as number;
      return `★ ${value.toFixed(1).replace(".", ",")}/5`;
    }
  }
}

export type BoundLayer = { pageId: string; layer: TextLayer & { bind: FieldBinding } };

export function boundLayers(doc: SceneDocument | null): BoundLayer[] {
  const out: BoundLayer[] = [];
  for (const page of doc?.pages ?? []) {
    for (const layer of page.layers) {
      if (layer.type === "text" && layer.bind) out.push({ pageId: page.id, layer: layer as TextLayer & { bind: FieldBinding } });
    }
  }
  return out;
}

/** Produtos e evidências que o design usa (para buscar os dados e conferir). */
export function bindingRefs(doc: SceneDocument | null): { productIds: string[]; evidenceIds: string[] } {
  const productIds = new Set<string>();
  const evidenceIds = new Set<string>();
  for (const { layer } of boundLayers(doc)) {
    productIds.add(layer.bind.productId);
    if (layer.bind.evidenceId) evidenceIds.add(layer.bind.evidenceId);
  }
  return { productIds: [...productIds], evidenceIds: [...evidenceIds] };
}

/**
 * Regra sem dados: todo preço ligado tem, na mesma página, a fonte e a data da mesma
 * evidência, e nenhuma das duas camadas está oculta.
 */
export function assertBindingStructure(doc: SceneDocument | null): void {
  for (const page of doc?.pages ?? []) {
    const texts = page.layers.filter((layer): layer is TextLayer => layer.type === "text");
    for (const layer of texts) {
      if (layer.bind?.field !== "price.value") continue;
      if (layer.hidden) throw new BindingError(`Página "${page.id}": preço ligado não pode ficar oculto.`);
      const source = texts.find(
        (item) =>
          item.bind?.field === "price.source" &&
          item.bind.evidenceId === layer.bind?.evidenceId &&
          item.bind.productId === layer.bind?.productId &&
          !item.hidden,
      );
      if (!source) {
        throw new BindingError(`Página "${page.id}": preço sem a fonte e a data. Todo preço mostra de onde veio e quando foi visto.`);
      }
    }
  }
}

/** Estrutura + cada camada ligada mostra exatamente o dado (nada digitado à mão). */
export function assertBindingsMatch(doc: SceneDocument | null, data: BindingData): void {
  assertBindingStructure(doc);
  for (const { layer } of boundLayers(doc)) {
    const expected = formatBinding(layer.bind, data);
    if (layer.text !== expected) {
      throw new BindingError(
        `A camada "${layer.name ?? layer.id}" está ligada a ${BIND_FIELD_LABEL[layer.bind.field].toLowerCase()} e deve mostrar "${expected}". Atualize pelos dados do produto em vez de digitar.`,
      );
    }
  }
}

/** Evidência verificada mais recente de cada produto, por tipo (para atualizar o design). */
export type LatestEvidence = Record<string, { price?: string; rating?: string }>;

/**
 * Troca as evidências ligadas pelas verificadas mais recentes de cada produto e recalcula
 * os textos. Devolve o documento novo e quantas camadas mudaram.
 */
export function refreshBindings(doc: SceneDocument, data: BindingData, latest: LatestEvidence): { doc: SceneDocument; changed: number } {
  let changed = 0;
  const next = structuredClone(doc);
  for (const page of next.pages) {
    for (const layer of page.layers) {
      if (layer.type !== "text" || !layer.bind) continue;
      const kind = BIND_FIELD_KIND[layer.bind.field];
      const newest = kind ? latest[layer.bind.productId]?.[kind] : undefined;
      const bind: FieldBinding = kind && newest ? { ...layer.bind, evidenceId: newest } : layer.bind;
      const text = formatBinding(bind, data);
      if (text !== layer.text || bind.evidenceId !== layer.bind.evidenceId) changed += 1;
      layer.bind = bind;
      layer.text = text;
    }
  }
  return { doc: next, changed };
}

/** Preço escrito à mão (sem vínculo): a fila avisa. Mesmo padrão da checagem no banco. */
export const UNBOUND_PRICE_PATTERN = /(R\$|US\$|€)\s?\d/;

export function unboundPriceLayers(doc: SceneDocument | null): string[] {
  const out: string[] = [];
  for (const page of doc?.pages ?? []) {
    for (const layer of page.layers) {
      if (layer.type === "text" && !layer.bind && !layer.hidden && UNBOUND_PRICE_PATTERN.test(layer.text)) out.push(layer.name ?? layer.id);
    }
  }
  return out;
}
