/**
 * Lote de ofertas (F3): um rascunho por produto, com o design do template "smkon-oferta"
 * montado a partir do catálogo e das evidências verificadas. Nada é digitado: produto
 * sem preço verificado fica de fora, com o motivo.
 *
 * Função pura (planOfferBatch): a rota busca os dados, este módulo decide o que criar.
 */
import { ValidationError } from "../http/errors.ts";
import { isPlainObject, isUuid } from "../validation/fields.ts";
import { assertBindingsMatch, type BindingData, type BindingEvidence, type LatestEvidence } from "../scene/bindings.ts";
import { offerTexts, offerToScene, parseOfferOptions, type OfferParams } from "../scene/templates/smkon-oferta.ts";
import type { SceneDocument } from "../scene/types.ts";
import type { ContentWrite } from "./schema.ts";
import { CHANNELS } from "./types.ts";

export const OFFER_BATCH_MAX = 20;

export type OfferBatchInput = {
  productIds: string[];
  options: Omit<OfferParams, "productId" | "priceEvidenceId" | "ratingEvidenceId">;
  includeRating: boolean;
  channels: string[];
};

export function parseOfferBatchInput(body: unknown): OfferBatchInput {
  if (!isPlainObject(body)) throw new ValidationError("Corpo da requisição inválido.");
  const raw = body as Record<string, unknown>;
  const ids = Array.isArray(raw.productIds) ? [...new Set(raw.productIds)] : [];
  if (ids.length === 0 || ids.length > OFFER_BATCH_MAX || !ids.every(isUuid)) {
    throw new ValidationError(`Escolha de 1 a ${OFFER_BATCH_MAX} produtos.`);
  }
  const channels = Array.isArray(raw.channels) ? [...new Set(raw.channels)] : [];
  if (channels.length === 0 || !channels.every((channel) => (CHANNELS as readonly unknown[]).includes(channel))) {
    throw new ValidationError("Selecione ao menos um canal válido.");
  }
  const options = isPlainObject(raw.options) ? (raw.options as Record<string, unknown>) : {};
  return {
    productIds: ids as string[],
    options: parseOfferOptions(options),
    includeRating: raw.includeRating !== false,
    channels: channels as string[],
  };
}

export type ProductForBatch = { id: string; name: string; currency: string; status: string; affiliateUrl: string | null };

export type PlannedOffer = { productId: string; name: string; row: ContentWrite; scene: SceneDocument };
export type SkippedOffer = { productId: string; name: string | null; reason: string };

export function planOfferBatch(
  input: OfferBatchInput,
  products: Record<string, ProductForBatch>,
  evidence: Record<string, BindingEvidence>,
  latest: LatestEvidence,
): { items: PlannedOffer[]; skipped: SkippedOffer[] } {
  const items: PlannedOffer[] = [];
  const skipped: SkippedOffer[] = [];
  const data: BindingData = { products, evidence };

  for (const productId of input.productIds) {
    const product = products[productId];
    if (!product) {
      skipped.push({ productId, name: null, reason: "Produto não encontrado neste workspace." });
      continue;
    }
    if (product.status === "archived") {
      skipped.push({ productId, name: product.name, reason: "Produto arquivado." });
      continue;
    }
    const priceId = latest[productId]?.price;
    if (!priceId) {
      skipped.push({ productId, name: product.name, reason: "Sem preço verificado: registre e verifique uma evidência de preço." });
      continue;
    }
    const ratingId = input.includeRating ? latest[productId]?.rating : undefined;
    const params: OfferParams = {
      ...input.options,
      productId,
      priceEvidenceId: priceId,
      ...(ratingId ? { ratingEvidenceId: ratingId } : {}),
    };
    try {
      const texts = offerTexts(params, data);
      const scene = offerToScene(params, texts);
      assertBindingsMatch(scene, data);
      const affiliate = product.affiliateUrl && product.affiliateUrl.startsWith("https://") ? product.affiliateUrl : "";
      items.push({
        productId,
        name: product.name,
        scene,
        row: {
          title: `${input.options.headline} — ${product.name}`.slice(0, 180),
          product: product.name.slice(0, 180),
          source_url: "",
          asset_url: affiliate.slice(0, 2048),
          script: "",
          // Preço na legenda sempre com a fonte e a data, como no design.
          caption: `${texts.name}\n${texts.price} · ${texts.priceSource}.`,
          cta: "",
          hashtags: "",
          channels: input.channels,
          rights_confirmed: false,
          media_asset_id: null,
          status: "draft",
        },
      });
    } catch (error) {
      skipped.push({ productId, name: product.name, reason: error instanceof Error ? error.message : "Dados do produto inválidos." });
    }
  }
  return { items, skipped };
}
