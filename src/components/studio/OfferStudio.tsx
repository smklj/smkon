"use client";

import { useEffect, useMemo, useState } from "react";
import type { MascotExpression } from "@/lib/media/brand-system";
import type { BindingData, LatestEvidence } from "@/lib/scene/bindings";
import { SCENE_FORMATS, type SceneFormat } from "@/lib/scene/geometry";
import { renderPageSvg } from "@/lib/scene/render";
import { OFFER_DEFAULTS, OFFER_EXPRESSIONS, offerTexts, offerToScene, type OfferParams } from "@/lib/scene/templates/smkon-oferta";
import type { SceneDocument } from "@/lib/scene/types";
import { CHANNELS, type ContentChannel } from "@/lib/content/types";
import { SceneSaveControl, type SavedScene, type ScenePiece } from "./SceneSaveControl";

type ProductItem = { id: string; name: string; status: string; score: number | null };
type BatchResult = {
  created: { id: string; productId: string; title: string }[];
  skipped: { productId: string; name: string | null; reason: string }[];
};

const EXPRESSION_LABEL: Record<MascotExpression, string> = {
  oferta: "Oferta",
  confirmado: "Confirmado",
  feliz: "Feliz",
  padrao: "Padrão",
  pensativo: "Pensativo",
  surpreso: "Surpreso",
};

const BINDINGS_CHUNK = 50;

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Falha na requisição.");
  return body;
}

/**
 * Ofertas a partir do catálogo (F3): escolhe produtos, o design sai do template
 * "smkon-oferta" com nome, preço (com fonte e data) e avaliação ligados às evidências
 * verificadas. Gera um rascunho por produto, sem digitação de preço.
 */
export function OfferStudio({
  piece,
  onSceneSaved,
  onEditLayers,
  onBatchCreated,
}: {
  piece: ScenePiece | null;
  onSceneSaved?: (saved: SavedScene) => void;
  onEditLayers: (doc: SceneDocument) => void;
  onBatchCreated?: () => void;
}) {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [data, setData] = useState<BindingData>({ products: {}, evidence: {} });
  const [latest, setLatest] = useState<LatestEvidence>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [format, setFormat] = useState<SceneFormat>(OFFER_DEFAULTS.aspectRatio);
  const [badgeText, setBadgeText] = useState(OFFER_DEFAULTS.badgeText);
  const [headline, setHeadline] = useState(OFFER_DEFAULTS.headline);
  const [expression, setExpression] = useState<MascotExpression>(OFFER_DEFAULTS.mascotExpression);
  const [includeRating, setIncludeRating] = useState(true);
  const [channels, setChannels] = useState<ContentChannel[]>(["Instagram"]);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const list = await fetchJson(`/api/products?limit=100${query ? `&q=${encodeURIComponent(query)}` : ""}`);
      const items = ((list.items ?? []) as ProductItem[]).filter((item) => item.status !== "archived");
      const merged: BindingData = { products: {}, evidence: {} };
      const newest: LatestEvidence = {};
      for (let i = 0; i < items.length; i += BINDINGS_CHUNK) {
        const ids = items.slice(i, i + BINDINGS_CHUNK).map((item) => item.id);
        const body = await fetchJson(`/api/products/bindings?ids=${ids.join(",")}`);
        Object.assign(merged.products, body.products);
        Object.assign(merged.evidence, body.evidence);
        Object.assign(newest, body.latest);
      }
      return { items, merged, newest };
    })()
      .then(({ items, merged, newest }) => {
        if (!active) return;
        setProducts(items);
        // Mescla: produtos escolhidos numa busca anterior continuam com seus dados.
        setData((current) => ({ products: { ...current.products, ...merged.products }, evidence: { ...current.evidence, ...merged.evidence } }));
        setLatest((current) => ({ ...current, ...newest }));
      })
      .catch((err: unknown) => active && setError(err instanceof Error ? err.message : "Não foi possível carregar o catálogo."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [query]);

  const options = { aspectRatio: format, badgeText: badgeText.trim(), headline: headline.trim(), mascotExpression: expression, accentColor: OFFER_DEFAULTS.accentColor };
  const optionsValid = options.badgeText.length > 0 && options.badgeText.length <= 40 && options.headline.length > 0 && options.headline.length <= 40;

  /** Design do primeiro produto escolhido que tem preço verificado (prévia e "abrir no editor"). */
  const previewProduct = selected.find((id) => latest[id]?.price) ?? null;
  const preview = useMemo(() => {
    if (!previewProduct || !optionsValid) return null;
    const ratingId = includeRating ? latest[previewProduct]?.rating : undefined;
    const params: OfferParams = {
      ...options,
      productId: previewProduct,
      priceEvidenceId: latest[previewProduct]?.price as string,
      ...(ratingId ? { ratingEvidenceId: ratingId } : {}),
    };
    try {
      return offerToScene(params, offerTexts(params, data));
    } catch {
      return null;
    }
    // options é derivado dos estados listados abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewProduct, format, badgeText, headline, expression, includeRating, latest, data, optionsValid]);
  const previewSvg = useMemo(() => (preview ? renderPageSvg(preview, { idPrefix: "of" }) : ""), [preview]);

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : current.length >= 20 ? current : [...current, id]));
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const body = (await fetchJson("/api/content/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: selected, channels, includeRating, options }),
      })) as BatchResult;
      setResult(body);
      if (body.created.length > 0) onBatchCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar o lote.");
    } finally {
      setGenerating(false);
    }
  }

  const priceOf = (id: string) => {
    const evidenceId = latest[id]?.price;
    const item = evidenceId ? data.evidence[evidenceId] : undefined;
    if (!item) return null;
    try {
      const texts = offerTexts({ ...options, productId: id, priceEvidenceId: item.id }, data);
      return `${texts.price} · ${texts.priceSource}`;
    } catch {
      return null;
    }
  };

  return (
    <div className="offer-studio">
      <div className="offer-pane">
        <h3 className="scene-panel-title">Produtos</h3>
        <p className="scene-save-hint">
          Nome, preço e avaliação vêm do catálogo e das evidências verificadas. Produto sem preço verificado não entra: registre a
          evidência de preço em Produtos e verifique.
        </p>
        <form
          className="offer-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setLoading(true);
            setError(null);
            setQuery(search.trim());
          }}
        >
          <label className="scene-field">
            <span>Buscar produto pelo nome</span>
            <input type="search" value={search} maxLength={100} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <button type="submit" className="btn-canvas-action">Buscar</button>
        </form>
        {error && <p className="scene-save-error" role="alert">{error}</p>}
        {loading && <p className="scene-save-hint" aria-live="polite">Carregando catálogo…</p>}
        {!loading && products.length === 0 && !error && <p className="scene-save-hint">Nenhum produto no catálogo.</p>}
        <ul className="offer-products" aria-label="Produtos do catálogo">
          {products.map((product) => {
            const price = priceOf(product.id);
            return (
              <li key={product.id}>
                <label className={price ? "offer-product" : "offer-product disabled"}>
                  <input
                    type="checkbox"
                    checked={selected.includes(product.id)}
                    onChange={() => toggle(product.id)}
                    disabled={!price && !selected.includes(product.id)}
                  />
                  <span className="offer-product-name">{product.name}</span>
                  <span className={price ? "offer-product-price" : "offer-product-price missing"}>{price ?? "Sem preço verificado"}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <p className="scene-save-hint">{selected.length} de até 20 produtos escolhidos.</p>
      </div>

      <div className="offer-pane">
        <h3 className="scene-panel-title">Design</h3>
        <div className="scene-fields">
          <label className="scene-field">
            <span>Formato</span>
            <select value={format} onChange={(event) => setFormat(event.target.value as SceneFormat)}>
              {Object.keys(SCENE_FORMATS).map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="scene-field">
            <span>Mascote</span>
            <select value={expression} onChange={(event) => setExpression(event.target.value as MascotExpression)}>
              {OFFER_EXPRESSIONS.map((item) => (
                <option key={item} value={item}>{EXPRESSION_LABEL[item]}</option>
              ))}
            </select>
          </label>
          <label className="scene-field scene-field-wide">
            <span>Selo</span>
            <input value={badgeText} maxLength={40} onChange={(event) => setBadgeText(event.target.value)} />
          </label>
          <label className="scene-field scene-field-wide">
            <span>Chamada</span>
            <input value={headline} maxLength={40} onChange={(event) => setHeadline(event.target.value)} />
          </label>
          <label className="offer-check scene-field-wide">
            <input type="checkbox" checked={includeRating} onChange={(event) => setIncludeRating(event.target.checked)} />
            Mostrar avaliação verificada, quando houver
          </label>
          <fieldset className="offer-channels scene-field-wide">
            <legend>Canais dos rascunhos</legend>
            {CHANNELS.map((channel) => (
              <label key={channel} className="offer-check">
                <input
                  type="checkbox"
                  checked={channels.includes(channel)}
                  onChange={() => setChannels((current) => (current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]))}
                />
                {channel}
              </label>
            ))}
          </fieldset>
        </div>

        <div className="offer-actions">
          <button
            type="button"
            className="btn-canvas-action primary"
            onClick={generate}
            disabled={generating || selected.length === 0 || channels.length === 0 || !optionsValid}
          >
            {generating ? "Gerando…" : `Gerar ${selected.length} rascunho${selected.length === 1 ? "" : "s"}`}
          </button>
          {preview && (
            <button type="button" className="btn-canvas-action" onClick={() => onEditLayers(preview)}>
              Abrir no editor de camadas
            </button>
          )}
        </div>

        {result && (
          <div className="offer-result" aria-live="polite">
            <p className="scene-save-ok">
              {result.created.length} rascunho(s) criado(s) na lista de conteúdos. Cada um precisa de aprovação antes de publicar.
            </p>
            {result.skipped.length > 0 && (
              <ul className="offer-skipped">
                {result.skipped.map((skip) => (
                  <li key={skip.productId}>
                    <strong>{skip.name ?? "Produto"}</strong>: {skip.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="offer-pane offer-preview-pane">
        <h3 className="scene-panel-title">Prévia</h3>
        {preview ? (
          <>
            <div
              className="offer-preview"
              style={{ aspectRatio: `${preview.width} / ${preview.height}` }}
              data-testid="offer-preview"
              dangerouslySetInnerHTML={{ __html: previewSvg }}
            />
            <SceneSaveControl piece={piece} what="oferta" buildScene={() => preview} onSaved={(saved) => onSceneSaved?.(saved)} />
          </>
        ) : (
          <p className="scene-save-hint">Escolha um produto com preço verificado para ver a prévia.</p>
        )}
      </div>
    </div>
  );
}
