"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/store/cart-context";
import { useWishlist } from "@/lib/store/wishlist-context";
import { useSlidingPill } from "@/components/ui/SlidingPill";
import type { StoreProduct } from "@/lib/store/types";
import { IconArrowUpRight, IconCart, IconClose, IconHeart, IconHistory } from "./StoreIcons";

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

type DrawerTab = "salvos" | "recentes";

export function WishlistDrawer() {
  const {
    favorites,
    recentIds,
    isWishlistOpen,
    closeWishlist,
    toggleFavorite,
    clearRecent,
  } = useWishlist();
  const { addItem } = useCart();

  const [tab, setTab] = useState<DrawerTab>("salvos");
  const [catalog, setCatalog] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(false);

  const { containerRef, pillRef, sheenRef } = useSlidingPill({
    activeKey: isWishlistOpen ? tab : null,
    orientation: "horizontal",
    onScrubKey: (key) => {
      if (key === "salvos" || key === "recentes") setTab(key);
    },
    onCommitKey: (key) => {
      if (key === "salvos" || key === "recentes") setTab(key);
    },
  });

  useEffect(() => {
    if (!isWishlistOpen || catalog.length > 0) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/store/products?limite=60");
        const data = await res.json();
        if (active && res.ok && Array.isArray(data.products)) {
          setCatalog(data.products);
        }
      } catch {
        // Ignora falha temporária de rede
      } finally {
        if (active) setLoading(false);
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [isWishlistOpen, catalog.length]);

  if (!isWishlistOpen) return null;

  const byId = new Map(catalog.map((p) => [p.id, p]));
  const targetIds = tab === "salvos" ? favorites : recentIds;
  const resolvedProducts = targetIds
    .map((id) => byId.get(id))
    .filter((p): p is StoreProduct => Boolean(p));

  return (
    <div className="store-drawer-overlay" onClick={closeWishlist}>
      <aside
        className="store-drawer"
        aria-label="Favoritos e histórico recente"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="store-drawer-header">
          <h2 className="store-drawer-title" style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <IconHeart size={16} filled />
            <span>Sua Seleção</span>
          </h2>
          <button
            type="button"
            onClick={closeWishlist}
            aria-label="Fechar janela"
            style={{
              background: "none",
              border: "none",
              color: "var(--store-muted)",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
          >
            <IconClose size={18} />
          </button>
        </div>

        <div style={{ padding: "12px 18px 4px", borderBottom: "1px solid var(--store-border)" }}>
          <div ref={containerRef} className="store-pill-tabs-wrap" style={{ width: "100%" }}>
            <div ref={pillRef} className="store-pill-indicator" aria-hidden="true">
              <div ref={sheenRef} className="store-pill-indicator-sheen" />
            </div>
            <div className="store-pill-tabs-list" style={{ width: "100%" }}>
              <button
                type="button"
                data-sliding-key="salvos"
                onClick={() => setTab("salvos")}
                className={tab === "salvos" ? "store-pill-tab active" : "store-pill-tab"}
                style={{ flex: 1, justifyContent: "center" }}
              >
                <IconHeart size={13} filled={tab === "salvos"} />
                <span>Salvos ({favorites.length})</span>
              </button>
              <button
                type="button"
                data-sliding-key="recentes"
                onClick={() => setTab("recentes")}
                className={tab === "recentes" ? "store-pill-tab active" : "store-pill-tab"}
                style={{ flex: 1, justifyContent: "center" }}
              >
                <IconHistory size={13} />
                <span>Vistos ({recentIds.length})</span>
              </button>
            </div>
          </div>
        </div>

        {loading && resolvedProducts.length === 0 ? (
          <div style={{ flex: 1, display: "grid", placeContent: "center", color: "var(--store-muted)", fontSize: "13px" }}>
            Carregando seleção...
          </div>
        ) : resolvedProducts.length === 0 ? (
          <div style={{ flex: 1, display: "grid", placeContent: "center", textAlign: "center", padding: "36px" }}>
            <div style={{ color: "var(--store-accent)", margin: "0 auto 12px" }}>
              {tab === "salvos" ? <IconHeart size={32} /> : <IconHistory size={32} />}
            </div>
            <h3 style={{ fontSize: "15px", color: "#fff", marginBottom: "6px" }}>
              {tab === "salvos" ? "Nenhum item favoritado ainda" : "Nenhum produto visto recentemente"}
            </h3>
            <p style={{ fontSize: "12px", color: "var(--store-muted)", marginBottom: "18px", lineHeight: 1.5 }}>
              {tab === "salvos"
                ? "Toque no coração de qualquer produto para salvar e comparar preços depois."
                : "Abra a visualização rápida ou visite qualquer item para montar seu histórico."}
            </p>
            <Link
              href="/loja/produtos"
              onClick={closeWishlist}
              className="store-btn store-btn-primary"
              style={{ padding: "10px 18px", fontSize: "13px" }}
            >
              Explorar Catálogo
            </Link>
          </div>
        ) : (
          <div className="store-drawer-items">
            {tab === "recentes" && recentIds.length > 0 && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "4px" }}>
                <button
                  type="button"
                  onClick={clearRecent}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--store-muted)",
                    fontSize: "11px",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Limpar histórico
                </button>
              </div>
            )}

            {resolvedProducts.map((product) => {
              const isShopee = product.fulfillment_mode === "external_affiliate";
              const img = product.image_urls[0] || "/brand/demo-keyboard.jpg";
              return (
                <div key={product.id} className="store-drawer-item">
                  <Link href={`/loja/produtos/${product.slug}`} onClick={closeWishlist} style={{ flexShrink: 0 }}>
                    <Image
                      src={img}
                      alt={product.name}
                      className="store-drawer-item-img"
                      width={64}
                      height={64}
                      style={{ objectFit: "cover", borderRadius: "6px" }}
                    />
                  </Link>
                  <div className="store-drawer-item-info">
                    <Link
                      href={`/loja/produtos/${product.slug}`}
                      onClick={closeWishlist}
                      className="store-drawer-item-title"
                      style={{ textDecoration: "none" }}
                    >
                      {product.name}
                    </Link>
                    <span className="store-drawer-item-price">{formatBRL(product.price_cents)}</span>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "auto" }}>
                      {isShopee ? (
                        <a
                          href={product.affiliate_url || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="store-btn store-btn-shopee"
                          style={{ padding: "5px 10px", fontSize: "11px", borderRadius: "6px" }}
                        >
                          <span>Shopee</span>
                          <IconArrowUpRight size={11} />
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            addItem(product, 1);
                            closeWishlist();
                          }}
                          className="store-btn store-btn-primary"
                          style={{ padding: "5px 10px", fontSize: "11px", borderRadius: "6px" }}
                        >
                          <IconCart size={12} />
                          <span>Comprar</span>
                        </button>
                      )}

                      {tab === "salvos" && (
                        <button
                          type="button"
                          onClick={() => toggleFavorite(product.id)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--store-muted)",
                            fontSize: "11px",
                            cursor: "pointer",
                            textDecoration: "underline",
                          }}
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </aside>
    </div>
  );
}
