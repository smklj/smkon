"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/PageHeader";
import { DATA_MODELS, type DataRow } from "@/lib/data-studio/types";

const STATUS_TONES = DATA_MODELS.content.columns.find((column) => column.key === "status")?.tones ?? {};

/** Painel lateral com os conteúdos ligados a um produto. Fecha com Esc ou clicando fora. */
export function RelationalDrawer({ open, title, rows, onClose }: {
  open: boolean;
  title: string;
  rows: DataRow[];
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ds-drawer-backdrop" onClick={onClose}>
      <aside
        className="ds-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ds-drawer-head">
          <div>
            <p className="eyebrow">Relacionados</p>
            <h2 className="ds-drawer-title">{title}</h2>
          </div>
          <button ref={closeRef} type="button" className="button button-secondary" onClick={onClose}>
            Fechar
          </button>
        </header>
        {rows.length === 0 ? (
          <p className="empty">Nenhum conteúdo com este produto.</p>
        ) : (
          <ul className="rows">
            {rows.map((row) => (
              <li key={String(row.id)} className="row">
                <div className="row-main">
                  <p className="row-title">{String(row.title)}</p>
                  <p className="row-meta">
                    {[row.version, Array.isArray(row.channels) ? row.channels.join(" · ") : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Badge tone={STATUS_TONES[String(row.status)] ?? "neutral"}>{String(row.status)}</Badge>
              </li>
            ))}
          </ul>
        )}
        <p className="ds-foot">
          <Link className="link" href="/studio">Abrir no Content Studio</Link>
        </p>
      </aside>
    </div>
  );
}
