"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { useSlidingPill } from "@/components/ui/SlidingPill";
import { useWishlist } from "@/lib/store/wishlist-context";
import type { StoreProduct } from "@/lib/store/types";
import { ProductCard } from "./ProductCard";
import {
  IconBag,
  IconCpu,
  IconHeart,
  IconHistory,
  IconSliders,
  IconStar,
  IconZap,
} from "./StoreIcons";

type VitrineTab = "todos" | "fisico" | "digital" | "shopee" | "ofertas" | "trilha";
type SortMode = "relevance" | "price_asc" | "score";

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function calcDiscountRatio(product: StoreProduct): number {
  if (!product.compare_at_price_cents || product.compare_at_price_cents <= product.price_cents) {
    return 0;
  }
  return (product.compare_at_price_cents - product.price_cents) / product.compare_at_price_cents;
}

export function SmartDiscoveryShelf({
  products,
  children,
}: {
  products: StoreProduct[];
  children: React.ReactNode;
}) {
  const { favorites, recentIds, openWishlist } = useWishlist();
  const [activeTab, setActiveTab] = useState<VitrineTab>("todos");
  const [sortMode, setSortMode] = useState<SortMode>("relevance");

  const trilhaCount = useMemo(() => {
    const merged = new Set([...favorites, ...recentIds]);
    return products.filter((p) => merged.has(p.id)).length;
  }, [products, favorites, recentIds]);

  const recentProducts = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    return recentIds
      .map((id) => byId.get(id))
      .filter((p): p is StoreProduct => Boolean(p))
      .slice(0, 4);
  }, [products, recentIds]);

  const handleSelectTab = (key: string | null) => {
    if (
      key === "todos" ||
      key === "fisico" ||
      key === "digital" ||
      key === "shopee" ||
      key === "ofertas" ||
      key === "trilha"
    ) {
      setActiveTab(key);
    }
  };

  const { containerRef, pillRef, sheenRef } = useSlidingPill({
    activeKey: activeTab,
    orientation: "horizontal",
    onScrubKey: handleSelectTab,
    onCommitKey: handleSelectTab,
  });

  const gridRef = useRef<HTMLDivElement | null>(null);
  const showInteractiveGrid = activeTab !== "todos" || sortMode !== "relevance";

  useEffect(() => {
    if (!showInteractiveGrid) return;
    const el = gridRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.killTweensOf(el);
    gsap.fromTo(
      el,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.28, ease: "power3.out", clearProps: "transform" },
    );
  }, [activeTab, sortMode, showInteractiveGrid]);

  const filteredProducts = useMemo(() => {
    let list = [...products];
    if (activeTab === "fisico") {
      list = list.filter((p) => p.fulfillment_mode === "internal_physical");
    } else if (activeTab === "digital") {
      list = list.filter((p) => p.fulfillment_mode === "internal_digital");
    } else if (activeTab === "shopee") {
      list = list.filter((p) => p.fulfillment_mode === "external_affiliate");
    } else if (activeTab === "ofertas") {
      list = list
        .filter((p) => calcDiscountRatio(p) > 0)
        .sort((a, b) => calcDiscountRatio(b) - calcDiscountRatio(a));
    } else if (activeTab === "trilha") {
      const merged = new Set([...favorites, ...recentIds]);
      list = list.filter((p) => merged.has(p.id));
    }

    if (sortMode === "price_asc") {
      list.sort((a, b) => a.price_cents - b.price_cents);
    } else if (sortMode === "score") {
      list.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    }
    return list;
  }, [products, activeTab, sortMode, favorites, recentIds]);

  return (
    <>
      {/* Barra Horizontal Deslizante Inteligente */}
      <section className="store-pill-toolbar" aria-label="Navegação inteligente da vitrine">
        <div ref={containerRef} className="store-pill-tabs-wrap">
          <div ref={pillRef} className="store-pill-indicator" aria-hidden="true">
            <div ref={sheenRef} className="store-pill-indicator-sheen" />
          </div>

          <div className="store-pill-tabs-list" role="tablist" aria-label="Filtrar vitrine">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "todos"}
              data-sliding-key="todos"
              onClick={() => setActiveTab("todos")}
              className={activeTab === "todos" ? "store-pill-tab active" : "store-pill-tab"}
            >
              <IconStar size={13} />
              <span>Vitrine Completa</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "fisico"}
              data-sliding-key="fisico"
              onClick={() => setActiveTab("fisico")}
              className={activeTab === "fisico" ? "store-pill-tab active" : "store-pill-tab"}
            >
              <IconBag size={13} />
              <span>Hardware</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "digital"}
              data-sliding-key="digital"
              onClick={() => setActiveTab("digital")}
              className={activeTab === "digital" ? "store-pill-tab active" : "store-pill-tab"}
            >
              <IconCpu size={13} />
              <span>Infoprodutos</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "shopee"}
              data-sliding-key="shopee"
              onClick={() => setActiveTab("shopee")}
              className={activeTab === "shopee" ? "store-pill-tab active" : "store-pill-tab"}
            >
              <IconBag size={13} />
              <span>Achados Shopee</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "ofertas"}
              data-sliding-key="ofertas"
              onClick={() => setActiveTab("ofertas")}
              className={activeTab === "ofertas" ? "store-pill-tab active" : "store-pill-tab"}
            >
              <IconZap size={13} />
              <span>Maiores Descontos</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "trilha"}
              data-sliding-key="trilha"
              onClick={() => setActiveTab("trilha")}
              className={activeTab === "trilha" ? "store-pill-tab active" : "store-pill-tab"}
            >
              <IconHeart size={13} filled={favorites.length > 0} />
              <span>Sua Trilha{trilhaCount > 0 ? ` (${trilhaCount})` : ""}</span>
            </button>
          </div>
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <IconSliders size={14} />
          <select
            aria-label="Ordenação rápida da vitrine"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            style={{
              height: "32px",
              background: "var(--store-card)",
              border: "1px solid var(--store-border)",
              borderRadius: "8px",
              color: "#fff",
              fontSize: "12px",
              padding: "0 10px",
              cursor: "pointer",
            }}
          >
            <option value="relevance">Relevância SMKON</option>
            <option value="price_asc">Menor preço primeiro</option>
            <option value="score">Maior avaliação</option>
          </select>
        </div>
      </section>

      {/* Faixa "Vistos Recentemente" só aparece se o usuário interagiu com produtos */}
      {!showInteractiveGrid && recentProducts.length > 0 && (
        <section className="store-recent-strip" aria-label="Produtos vistos recentemente">
          <div className="store-recent-header">
            <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "12px", fontWeight: 700, color: "var(--store-accent)" }}>
              <IconHistory size={14} />
              <span>Continuar de onde você parou</span>
            </span>
            <button
              type="button"
              onClick={openWishlist}
              style={{ background: "none", border: 0, color: "var(--store-muted)", fontSize: "11px", cursor: "pointer", textDecoration: "underline" }}
            >
              Ver salvos ({favorites.length})
            </button>
          </div>
          <div className="store-recent-row">
            {recentProducts.map((p) => (
              <Link key={p.id} href={`/loja/produtos/${p.slug}`} className="store-recent-item">
                <Image
                  src={p.image_urls[0] || "/brand/demo-keyboard.jpg"}
                  alt={p.name}
                  width={42}
                  height={42}
                  style={{ width: 42, height: 42, borderRadius: "8px", objectFit: "cover", flexShrink: 0 }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--store-accent)" }}>
                    {formatBRL(p.price_cents)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {showInteractiveGrid ? (
        <section ref={gridRef} className="store-section">
          <div className="store-section-header">
            <div>
              <span className="store-section-kicker">Filtro instantâneo · {filteredProducts.length} itens</span>
              <h2 className="store-section-title">
                {activeTab === "fisico"
                  ? "Hardware, Setup & Periféricos"
                  : activeTab === "digital"
                  ? "Infoprodutos & Sistemas PDV"
                  : activeTab === "shopee"
                  ? "Achados Verificados Shopee"
                  : activeTab === "ofertas"
                  ? "Maiores Descontos Agora"
                  : activeTab === "trilha"
                  ? "Seus Favoritos e Vistos Recentemente"
                  : "Vitrine Ordenada"}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveTab("todos");
                setSortMode("relevance");
              }}
              className="store-btn store-btn-secondary"
              style={{ padding: "6px 12px", fontSize: "12px" }}
            >
              Voltar para Vitrine Completa
            </button>
          </div>

          {filteredProducts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 20px", background: "var(--store-surface)", borderRadius: "14px", border: "1px solid var(--store-border)" }}>
              <p style={{ color: "var(--store-muted)", fontSize: "13px", marginBottom: "14px" }}>
                Você ainda não salvou ou visualizou produtos para montar sua trilha.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("todos")}
                className="store-btn store-btn-primary"
                style={{ fontSize: "12px", padding: "8px 16px" }}
              >
                Explorar Produtos
              </button>
            </div>
          ) : (
            <div className="store-grid">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      ) : (
        children
      )}
    </>
  );
}
