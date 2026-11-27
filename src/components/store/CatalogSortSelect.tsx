"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function CatalogSortSelect({ currentSort }: { currentSort: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = new URLSearchParams(searchParams.toString());
    if (e.target.value && e.target.value !== "newest") {
      next.set("ordem", e.target.value);
    } else {
      next.delete("ordem");
    }
    const qs = next.toString();
    router.push(qs ? `/loja/produtos?${qs}` : "/loja/produtos");
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <label htmlFor="catalog-sort" style={{ fontSize: "12px", color: "var(--store-muted)", whiteSpace: "nowrap" }}>
        Ordenar por:
      </label>
      <select
        id="catalog-sort"
        value={currentSort}
        onChange={handleChange}
        style={{
          height: "34px",
          background: "var(--store-card)",
          border: "1px solid var(--store-border-strong)",
          borderRadius: "8px",
          color: "#fff",
          fontSize: "12px",
          padding: "0 10px",
          cursor: "pointer",
        }}
      >
        <option value="newest">Mais recentes</option>
        <option value="score">Melhor avaliação SMKON</option>
        <option value="price_asc">Menor preço</option>
        <option value="price_desc">Maior preço</option>
      </select>
    </div>
  );
}
