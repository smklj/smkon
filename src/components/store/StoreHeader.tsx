"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/store/cart-context";
import type { StoreSettings } from "@/lib/store/types";
import {
  IconArrowUpRight,
  IconBag,
  IconCart,
  IconCode,
  IconCpu,
  IconPackage,
  IconSearch,
} from "./StoreIcons";

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
              style={{ height: 30, width: "auto", objectFit: "contain" }}
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
              className="store-btn store-btn-secondary"
              style={{ padding: "8px 14px", fontSize: "12px" }}
            >
              <IconPackage size={14} />
              <span>Rastrear</span>
            </Link>
            <Link
              href="/loja/produtos"
              className="store-btn store-btn-secondary"
              style={{ padding: "8px 14px", fontSize: "12px" }}
            >
              <span>Catálogo</span>
            </Link>

            <button onClick={openCart} className="store-cart-btn" aria-label="Abrir carrinho de compras">
              <IconCart size={15} />
              <span>Carrinho</span>
              {itemCount > 0 && <span className="store-cart-badge">{itemCount}</span>}
            </button>
          </div>
        </div>

        <nav className="store-subnav" aria-label="Categorias da Loja">
          <ul className="store-subnav-list">
            <li className="store-subnav-item">
              <Link href="/loja/produtos">Todos os Produtos</Link>
            </li>
            {settings.categories_nav.map((cat) => (
              <li key={cat.id} className="store-subnav-item">
                <Link href={`/loja/produtos?categoria=${cat.slug}`}>
                  <span>{cat.name}</span>
                  {cat.badge && (
                    <span
                      style={{
                        fontSize: "10px",
                        background: "rgba(212, 175, 55, 0.16)",
                        color: "var(--store-accent)",
                        border: "1px solid rgba(212, 175, 55, 0.28)",
                        padding: "1px 6px",
                        borderRadius: "999px",
                        fontWeight: 600,
                      }}
                    >
                      {cat.badge}
                    </span>
                  )}
                </Link>
              </li>
            ))}
            <li className="store-subnav-item">
              <Link href="/loja/produtos?tipo=shopee" style={{ color: "#fdba74" }}>
                <IconBag size={13} />
                <span>Curadoria Shopee</span>
              </Link>
            </li>
            <li className="store-subnav-item">
              <Link href="/loja/produtos?tipo=digital" style={{ color: "#e4e4e7" }}>
                <IconCpu size={13} />
                <span>Infoprodutos & Sistemas</span>
              </Link>
            </li>
            <li className="store-subnav-item">
              <Link href="/loja/orcamentos" style={{ color: "var(--store-accent)", fontWeight: 600 }}>
                <IconCode size={13} />
                <span>Sites, APIs & Orçamentos</span>
              </Link>
            </li>
          </ul>
        </nav>
      </header>
    </>
  );
}
