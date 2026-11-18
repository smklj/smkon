"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/PageHeader";
import type { ContentItemRow } from "@/lib/content/types";

const STATUS: Record<ContentItemRow["status"], { label: string; tone: "ok" | "warn" | "neutral" }> = {
  draft: { label: "Rascunho", tone: "warn" },
  approved: { label: "Aprovado", tone: "ok" },
  archived: { label: "Arquivado", tone: "neutral" },
};

export function ContentList() {
  const [items, setItems] = useState<ContentItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/content")
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Falha ao carregar conteúdos.");
        if (!cancelled) setItems(body.items ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao carregar conteúdos.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="skeleton-list" aria-busy="true" aria-label="Carregando conteúdos">
        <span /><span /><span />
      </div>
    );
  }

  if (error) {
    return <p className="feedback feedback-error" role="alert">{error}</p>;
  }

  if (items.length === 0) {
    return (
      <div className="empty">
        <p className="empty-title">Nenhum conteúdo</p>
        <p>Crie o primeiro no <Link className="link" href="/studio">Content Studio</Link>.</p>
      </div>
    );
  }

  return (
    <ul className="rows">
      {items.map((item) => {
        const status = STATUS[item.status] ?? STATUS.draft;
        return (
          <li className="row" key={item.id}>
            <div className="row-main">
              <p className="row-title">{item.title}</p>
              <p className="row-meta">
                {item.product || "Sem produto"} · {item.channels?.join(", ") || "Sem canais"} · v{item.version} ·{" "}
                {new Date(item.updated_at).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <Badge tone={status.tone}>{status.label}</Badge>
          </li>
        );
      })}
    </ul>
  );
}
