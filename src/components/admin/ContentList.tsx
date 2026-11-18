"use client";

import { useEffect, useState } from "react";
import type { ContentItemRow } from "@/lib/content/types";

export function ContentList() {
  const [items, setItems] = useState<ContentItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/content");
        if (res.status === 401) {
          setError("Autenticação necessária. Faça login para visualizar os conteúdos do Content Studio.");
          setItems([]);
          return;
        }
        if (!res.ok) {
          throw new Error("Falha ao carregar conteúdos da API.");
        }
        const data = await res.json();
        setItems(data.items ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar conteúdos.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="connection-row">
        <div>
          <h3>Carregando conteúdos...</h3>
          <p>Consultando /api/content.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="connection-row">
        <div>
          <h3>Conteúdos indisponíveis</h3>
          <p>{error}</p>
        </div>
        <span className="module-state">AUTH REQUERIDA</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="connection-row">
        <div>
          <h3>Nenhum conteúdo</h3>
          <p>Nenhum item encontrado. Crie no Content Studio após autenticação.</p>
        </div>
        <span className="module-state">VAZIO</span>
      </div>
    );
  }

  return (
    <>
      {items.map((item) => (
        <div className="connection-row" key={item.id}>
          <div>
            <h3>{item.title}</h3>
            <p>
              {item.product || "Sem produto"} · {item.channels?.join(", ") || "Sem canais"} · Atualizado{" "}
              {new Date(item.updated_at).toLocaleDateString("pt-BR")}
            </p>
          </div>
          <span className="module-state">{item.status?.toUpperCase()}</span>
        </div>
      ))}
    </>
  );
}
