"use client";

import { useCallback, useEffect, useState } from "react";
import { LICENSE_STATUS_LABEL, LICENSE_STATUS_TONE, type LicenseStatus } from "@/lib/media/types";

export type PickedMedia = { id: string; name: string; url: string; licenseStatus: LicenseStatus };

type Item = PickedMedia & { kind: string };
type MediaPage = { items: Item[]; nextCursor: string | null };

async function fetchMediaPage(from: string | null): Promise<MediaPage> {
  const res = await fetch(`/api/media?signed=1${from ? `&cursor=${encodeURIComponent(from)}` : ""}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Não foi possível carregar a biblioteca.");
  return {
    items: ((body.items ?? []) as Item[]).filter((item) => item.kind === "image" && typeof item.url === "string"),
    nextCursor: typeof body.nextCursor === "string" ? body.nextCursor : null,
  };
}

/**
 * Imagens da biblioteca do workspace. Só mídia da biblioteca entra no design (licença
 * rastreada); sem licença comercial válida a imagem entra, mas a fila de publicação
 * bloqueia a peça até a licença ser registrada.
 */
export function MediaPicker({ onPick, onClose }: { onPick: (media: PickedMedia) => void; onClose: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((page: MediaPage, from: string | null) => {
    setItems((prev) => (from ? [...prev, ...page.items] : page.items));
    setCursor(page.nextCursor);
  }, []);

  useEffect(() => {
    let active = true;
    fetchMediaPage(null)
      .then((page) => active && apply(page, null))
      .catch((err: unknown) => active && setError(err instanceof Error ? err.message : "Não foi possível carregar a biblioteca."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [apply]);

  async function loadMore(from: string) {
    setLoading(true);
    setError(null);
    try {
      apply(await fetchMediaPage(from), from);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar a biblioteca.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="scene-picker" role="dialog" aria-modal="false" aria-label="Imagens da biblioteca">
      <div className="scene-picker-head">
        <strong>Imagens da biblioteca</strong>
        <button type="button" className="btn-canvas-action" onClick={onClose}>
          Fechar
        </button>
      </div>
      {error && <p className="scene-save-error" role="alert">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="scene-save-hint">Nenhuma imagem na biblioteca. Envie imagens em Mídia e registre a licença.</p>
      )}
      <ul className="scene-picker-grid">
        {items.map((item) => (
          <li key={item.id}>
            <button type="button" className="scene-picker-item" onClick={() => onPick(item)} title={item.name}>
              {/* URL assinada do Supabase (img-src da CSP permite a origem). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt="" loading="lazy" />
              <span className="scene-picker-name">{item.name}</span>
              <span className={`scene-license scene-license-${LICENSE_STATUS_TONE[item.licenseStatus]}`}>
                {LICENSE_STATUS_LABEL[item.licenseStatus]}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {loading && <p className="scene-save-hint" aria-live="polite">Carregando…</p>}
      {cursor && !loading && (
        <button type="button" className="btn-canvas-action" onClick={() => loadMore(cursor)}>
          Carregar mais
        </button>
      )}
    </div>
  );
}
