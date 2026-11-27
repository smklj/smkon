"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/store/cart-context";
import { useWishlist } from "@/lib/store/wishlist-context";
import type { StoreSettings } from "@/lib/store/types";
import {
  IconArrowUpRight,
  IconCart,
  IconHeart,
  IconPackage,
  IconSearch,
} from "./StoreIcons";

export function StoreHeader({ settings }: { settings: StoreSettings }) {
  const { itemCount, openCart } = useCart();
  const { favorites } = useWishlist();
  const [searchTerm, setSearchTerm] = useState("");
  const router = useRouter();

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
              width={116}
              height={28}
              style={{ height: 26, width: "auto", objectFit: "contain" }}
            />
            <span className="store-logo-tagline">{settings.store_tagline}</span>
          </Link>

          <form onSubmit={handleSearch} className="store-search-form">
            <input
              type="text"
              placeholder="Buscar produtos, infoprodutos ou códigos..."
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
      </header>
    </>
  );
}
