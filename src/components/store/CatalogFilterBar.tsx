"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSlidingPill } from "@/components/ui/SlidingPill";

type FilterOption = {
  key: string;
  label: string;
  href: string;
};

const FILTER_OPTIONS: FilterOption[] = [
  { key: "todos", label: "Todos", href: "/loja/produtos" },
  { key: "shopee", label: "Achados Shopee", href: "/loja/produtos?tipo=shopee" },
  { key: "digital", label: "Infoprodutos & Sistemas", href: "/loja/produtos?tipo=digital" },
  { key: "fisico", label: "Produtos Físicos", href: "/loja/produtos?tipo=fisico" },
];

export function CatalogFilterBar({ activeTipo }: { activeTipo?: string }) {
  const router = useRouter();
  const routeKey =
    activeTipo === "shopee" || activeTipo === "afiliado"
      ? "shopee"
      : activeTipo === "digital"
      ? "digital"
      : activeTipo === "fisico"
      ? "fisico"
      : "todos";

  const [optimisticKey, setOptimisticKey] = useState<string | null>(null);
  const [syncedRouteKey, setSyncedRouteKey] = useState(routeKey);

  if (syncedRouteKey !== routeKey) {
    setSyncedRouteKey(routeKey);
    if (!optimisticKey || routeKey === optimisticKey) {
      setOptimisticKey(null);
    }
  }

  useEffect(() => {
    if (!optimisticKey || optimisticKey === routeKey) return;
    const t = window.setTimeout(() => setOptimisticKey(null), 1800);
    return () => window.clearTimeout(t);
  }, [optimisticKey, routeKey]);

  const activeKey = optimisticKey ?? routeKey;

  const { containerRef, pillRef, sheenRef } = useSlidingPill({
    activeKey,
    orientation: "horizontal",
    onScrubKey: (key) => setOptimisticKey(key),
    onCommitKey: (key) => {
      const target = FILTER_OPTIONS.find((opt) => opt.key === key);
      if (target) {
        setOptimisticKey(key);
        router.push(target.href);
      }
    },
  });

  return (
    <div ref={containerRef} className="store-pill-tabs-wrap">
      <div ref={pillRef} className="store-pill-indicator" aria-hidden="true">
        <div ref={sheenRef} className="store-pill-indicator-sheen" />
      </div>
      <div className="store-pill-tabs-list">
        {FILTER_OPTIONS.map((opt) => {
          const active = activeKey === opt.key;
          return (
            <Link
              key={opt.key}
              href={opt.href}
              draggable={false}
              data-sliding-key={opt.key}
              onClick={() => setOptimisticKey(opt.key)}
              className={active ? "store-pill-tab active" : "store-pill-tab"}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
