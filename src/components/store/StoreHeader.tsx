"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCart } from "@/lib/store/cart-context";
import { useWishlist } from "@/lib/store/wishlist-context";
import { useSlidingPill } from "@/components/ui/SlidingPill";
import type { StoreSettings } from "@/lib/store/types";
import {
  IconArrowUpRight,
  IconBag,
  IconCart,
  IconCode,
  IconCpu,
  IconHeart,
  IconPackage,
  IconSearch,
} from "./StoreIcons";

export function StoreHeader({ settings }: { settings: StoreSettings }) {
  const { itemCount, openCart } = useCart();
  const { favorites } = useWishlist();
  const [searchTerm, setSearchTerm] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentTipo = searchParams.get("tipo");
  const currentCat = searchParams.get("categoria");
  const activeNavKey = pathname.startsWith("/loja/orcamentos")
    ? "orcamentos"
    : currentTipo
    ? `tipo-${currentTipo}`
    : currentCat
    ? `cat-${currentCat}`
    : pathname.startsWith("/loja/produtos")
    ? "todos"
    : null;

  const { containerRef, pillRef, sheenRef } = useSlidingPill({
    activeKey: activeNavKey,
    orientation: "horizontal",
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/loja/produtos?q=${encodeURIComponent(searchTerm.trim())}`);
    } else {
      router.push("/loja/produtos");
    }
  };

  return (
    <>
      {settings.announcement_bar?.enabled && (
        <div className="store-announcement">
          <span>{settings.announcement_bar.text}</span>
          {settings.announcement_bar.link && (
            <Link
              href={settings.announcement_bar.link}
              className="link"
              style={{ color: "var(--store-accent)", display: "inline-flex", alignItems: "center", gap: "3px" }}
            >
              <span>Explorar</span>
              <IconArrowUpRight size={12} />
            </Link>
          )}
        </div>
      )}

      <header className="store-header">
        <div className="store-header-container">
          <Link href="/" className="store-logo">
            <Image
              src={settings.logo_url || "/brand/smkon-logo-horizontal-white.svg"}
              alt="SMKON"
              width={120}
              height={32}
              style={{ height: 28, width: "auto", objectFit: "contain" }}
            />
            <span className="store-logo-tagline">{settings.store_tagline}</span>
          </Link>

          <form onSubmit={handleSearch} className="store-search-form">
            <input
              type="text"
              placeholder="Buscar hardware, infoprodutos, achados..."
              className="store-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button type="submit" className="store-search-btn" aria-label="Pesquisar">
              <IconSearch size={15} />
            </button>
          </form>

          <div className="store-header-actions">
            <Link
              href="/loja/rastrear"
              className="store-btn store-btn-secondary store-hide-mobile"
              style={{ padding: "8px 12px", fontSize: "12px" }}
            >
              <IconPackage size={14} />
              <span>Rastrear</span>
            </Link>

            <Link
              href="/loja/produtos"
              className="store-btn store-btn-secondary"
              style={{ padding: "8px 12px", fontSize: "12px" }}
              title="Favoritos salvos"
            >
              <IconHeart size={14} filled={favorites.length > 0} />
              {favorites.length > 0 && <span className="store-cart-badge">{favorites.length}</span>}
            </Link>

            <button onClick={openCart} className="store-cart-btn" aria-label="Abrir carrinho de compras">
              <IconCart size={15} />
              <span>Carrinho</span>
              {itemCount > 0 && <span className="store-cart-badge">{itemCount}</span>}
            </button>
          </div>
        </div>

        <nav className="store-subnav" aria-label="Categorias da Loja">
          <div ref={containerRef} className="store-subnav-track">
            <div
              ref={pillRef}
              className="sliding-pill store-subnav-pill"
              aria-hidden="true"
            >
              <div ref={sheenRef} className="sliding-pill-sheen" />
            </div>
            <ul className="store-subnav-list">
              <li className="store-subnav-item">
                <Link
                  href="/loja/produtos"
                  data-sliding-key="todos"
                  className={activeNavKey === "todos" ? "active" : ""}
                >
                  Catálogo Geral
                </Link>
              </li>
              {settings.categories_nav.map((cat) => {
                const k = `cat-${cat.slug}`;
                return (
                  <li key={cat.id} className="store-subnav-item">
                    <Link
                      href={`/loja/produtos?categoria=${cat.slug}`}
                      data-sliding-key={k}
                      className={activeNavKey === k ? "active" : ""}
                    >
                      <span>{cat.name}</span>
                      {cat.badge && (
                        <span className="store-subnav-badge">{cat.badge}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
              <li className="store-subnav-item">
                <Link
                  href="/loja/produtos?tipo=shopee"
                  data-sliding-key="tipo-shopee"
                  className={activeNavKey === "tipo-shopee" ? "active" : ""}
                  style={{ color: "#fdba74" }}
                >
                  <IconBag size={13} />
                  <span>Shopee Oficial</span>
                </Link>
              </li>
              <li className="store-subnav-item">
                <Link
                  href="/loja/produtos?tipo=digital"
                  data-sliding-key="tipo-digital"
                  className={activeNavKey === "tipo-digital" ? "active" : ""}
                >
                  <IconCpu size={13} />
                  <span>Infoprodutos</span>
                </Link>
              </li>
              <li className="store-subnav-item">
                <Link
                  href="/loja/orcamentos"
                  data-sliding-key="orcamentos"
                  className={activeNavKey === "orcamentos" ? "active" : ""}
                  style={{ color: "var(--store-accent)", fontWeight: 600 }}
                >
                  <IconCode size={13} />
                  <span>Sites & APIs</span>
                </Link>
              </li>
            </ul>
          </div>
        </nav>
      </header>
    </>
  );
}
