"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/store/cart-context";
import type { StoreSettings } from "@/lib/store/types";

export function StoreHeader({ settings }: { settings: StoreSettings }) {
  const { itemCount, openCart } = useCart();
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
            <Link href={settings.announcement_bar.link} className="link" style={{ color: "var(--store-accent)" }}>
              Saiba mais ↗
            </Link>
          )}
        </div>
      )}

      <header className="store-header">
        <div className="store-header-container">
          <Link href="/loja" className="store-logo">
            <Image
              src={settings.logo_url || "/brand/smkon-logo-horizontal-white.svg"}
              alt="SMKON"
              width={120}
              height={32}
              style={{ height: 32, width: "auto", objectFit: "contain" }}
            />
            <span className="store-logo-tagline">{settings.store_tagline}</span>
          </Link>

          <form onSubmit={handleSearch} className="store-search-form">
            <input
              type="text"
              placeholder="Buscar periféricos, achados Shopee, infoprodutos..."
              className="store-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button type="submit" className="store-search-btn" aria-label="Pesquisar">
              🔍
            </button>
          </form>

          <div className="store-header-actions">
            <Link href="/loja/produtos" className="store-btn store-btn-secondary" style={{ padding: "8px 14px", fontSize: "13px" }}>
              Catálogo
            </Link>

            <button onClick={openCart} className="store-cart-btn" aria-label="Abrir carrinho de compras">
              <span>🛒</span>
              <span>Carrinho</span>
              {itemCount > 0 && <span className="store-cart-badge">{itemCount}</span>}
            </button>
          </div>
        </div>

        <nav className="store-subnav" aria-label="Categorias da Loja">
          <ul className="store-subnav-list">
            <li>
              <Link href="/loja/produtos">⚡ Todos os Produtos</Link>
            </li>
            {settings.categories_nav.map((cat) => (
              <li key={cat.id} className="store-subnav-item">
                <Link href={`/loja/produtos?categoria=${cat.slug}`}>
                  {cat.name}
                  {cat.badge && (
                    <span
                      style={{
                        fontSize: "10px",
                        background: "rgba(0, 240, 255, 0.2)",
                        color: "var(--store-accent)",
                        padding: "1px 6px",
                        borderRadius: "999px",
                      }}
                    >
                      {cat.badge}
                    </span>
                  )}
                </Link>
              </li>
            ))}
            <li className="store-subnav-item">
              <Link href="/loja/produtos?tipo=shopee" style={{ color: "var(--store-shopee)" }}>
                🛍️ Achados da Shopee
              </Link>
            </li>
            <li className="store-subnav-item">
              <Link href="/loja/produtos?tipo=digital" style={{ color: "var(--store-secondary)" }}>
                💻 Infoprodutos & Soluções
              </Link>
            </li>
          </ul>
        </nav>
      </header>
    </>
  );
}
