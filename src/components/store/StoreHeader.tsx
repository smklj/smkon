"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/store/cart-context";
import { useWishlist } from "@/lib/store/wishlist-context";
import type { StoreProduct, StoreSettings } from "@/lib/store/types";
import {
  IconArrowUpRight,
  IconCart,
  IconClose,
  IconCode,
  IconHeart,
  IconHistory,
  IconPackage,
  IconSearch,
} from "./StoreIcons";

const RECENT_SEARCHES_KEY = "smkon_recent_searches_v1";

const QUICK_CATEGORIES = [
  { label: "Hardware & Setup", href: "/loja/produtos?tipo=fisico" },
  { label: "Sistemas PDV & Digital", href: "/loja/produtos?tipo=digital" },
  { label: "Achados Shopee", href: "/loja/produtos?tipo=shopee" },
  { label: "Sites & APIs", href: "/loja/orcamentos" },
];

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function StoreHeader({ settings }: { settings: StoreSettings }) {
  const { itemCount, openCart } = useCart();
  const { favorites, openWishlist, trackView } = useWishlist();
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [results, setResults] = useState<StoreProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.filter((s): s is string => typeof s === "string").slice(0, 5));
        }
      } catch {
        // Ignora erro de storage
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    const q = searchTerm.trim();
    if (q.length < 2) {
      const clearTimer = window.setTimeout(() => {
        setResults([]);
        setSearching(false);
        setSelectedIndex(-1);
      }, 0);
      return () => window.clearTimeout(clearTimer);
    }

    let cancelled = false;
    const debounce = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/store/products?q=${encodeURIComponent(q)}&limite=5`);
        const data = await res.json();
        if (!cancelled && res.ok && Array.isArray(data.products)) {
          setResults(data.products);
          setSelectedIndex(-1);
        }
      } catch {
        // Mantém estado silencioso em falha de rede
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(debounce);
    };
  }, [searchTerm]);

  const saveSearchTerm = (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    const next = [clean, ...recentSearches.filter((x) => x.toLowerCase() !== clean.toLowerCase())].slice(0, 5);
    setRecentSearches(next);
    try {
      window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    } catch {
      // Ignora erro de storage
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setDropdownOpen(false);
    if (selectedIndex >= 0 && results[selectedIndex]) {
      const chosen = results[selectedIndex];
      trackView(chosen.id);
      router.push(`/loja/produtos/${chosen.slug}`);
      return;
    }
    if (searchTerm.trim()) {
      saveSearchTerm(searchTerm);
      router.push(`/loja/produtos?q=${encodeURIComponent(searchTerm.trim())}`);
    } else {
      router.push("/loja/produtos");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownOpen) return;
    if (e.key === "Escape") {
      setDropdownOpen(false);
      setSelectedIndex(-1);
    } else if (e.key === "ArrowDown" && results.length > 0) {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length > 0) {
      e.preventDefault();
      setSelectedIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
    }
  };

  const hasQuery = searchTerm.trim().length >= 2;

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

          <div ref={searchWrapRef} className="store-search-wrap">
            <form onSubmit={handleSearch} className="store-search-form" style={{ maxWidth: "100%" }}>
              <input
                type="text"
                role="combobox"
                aria-controls="store-search-listbox"
                placeholder="Buscar produtos, infoprodutos ou códigos..."
                className="store-search-input"
                value={searchTerm}
                onFocus={() => setDropdownOpen(true)}
                onKeyDown={handleKeyDown}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setDropdownOpen(true);
                }}
                aria-expanded={dropdownOpen}
                aria-autocomplete="list"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setResults([]);
                  }}
                  aria-label="Limpar busca"
                  style={{
                    position: "absolute",
                    right: "44px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--store-muted)",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                    padding: "4px",
                  }}
                >
                  <IconClose size={13} />
                </button>
              )}
              <button type="submit" className="store-search-btn" aria-label="Pesquisar">
                <IconSearch size={15} />
              </button>
            </form>

            {dropdownOpen && (
              <div id="store-search-listbox" className="store-search-dropdown" role="listbox" aria-label="Sugestões de busca">
                {!hasQuery ? (
                  <>
                    {recentSearches.length > 0 && (
                      <>
                        <div className="store-search-section-label">Buscas recentes</div>
                        <div className="store-search-chips">
                          {recentSearches.map((term) => (
                            <button
                              key={term}
                              type="button"
                              className="store-search-chip"
                              onClick={() => {
                                setDropdownOpen(false);
                                router.push(`/loja/produtos?q=${encodeURIComponent(term)}`);
                              }}
                            >
                              <IconHistory size={11} />
                              <span>{term}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    <div className="store-search-section-label">Explorar rápido</div>
                    <div className="store-search-chips">
                      {QUICK_CATEGORIES.map((cat) => (
                        <Link
                          key={cat.href}
                          href={cat.href}
                          className="store-search-chip"
                          onClick={() => setDropdownOpen(false)}
                        >
                          <span>{cat.label}</span>
                          <IconArrowUpRight size={11} />
                        </Link>
                      ))}
                    </div>
                  </>
                ) : searching && results.length === 0 ? (
                  <div style={{ padding: "12px", fontSize: "12px", color: "var(--store-muted)" }}>
                    Buscando no catálogo...
                  </div>
                ) : results.length > 0 ? (
                  <>
                    <div className="store-search-section-label">Resultados sugeridos</div>
                    {results.map((prod, idx) => {
                      const img = prod.image_urls[0] || "/brand/demo-keyboard.jpg";
                      return (
                        <Link
                          key={prod.id}
                          href={`/loja/produtos/${prod.slug}`}
                          role="option"
                          aria-selected={idx === selectedIndex}
                          onClick={() => {
                            saveSearchTerm(searchTerm);
                            trackView(prod.id);
                            setDropdownOpen(false);
                          }}
                          className={idx === selectedIndex ? "store-search-result selected" : "store-search-result"}
                        >
                          <Image
                            src={img}
                            alt={prod.name}
                            width={42}
                            height={42}
                            style={{ width: 42, height: 42, borderRadius: "8px", objectFit: "cover", flexShrink: 0 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {prod.name}
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--store-muted)" }}>
                              {prod.category}
                              {prod.fulfillment_mode === "external_affiliate" ? " · Shopee" : prod.fulfillment_mode === "internal_digital" ? " · Entrega imediata" : ""}
                            </div>
                          </div>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--store-accent)", flexShrink: 0 }}>
                            {formatBRL(prod.price_cents)}
                          </span>
                        </Link>
                      );
                    })}
                    <Link
                      href={`/loja/produtos?q=${encodeURIComponent(searchTerm.trim())}`}
                      onClick={() => {
                        saveSearchTerm(searchTerm);
                        setDropdownOpen(false);
                      }}
                      style={{
                        padding: "8px 10px",
                        fontSize: "12px",
                        color: "var(--store-accent)",
                        textDecoration: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        borderTop: "1px solid var(--store-border)",
                      }}
                    >
                      <span>Ver todos os resultados para &ldquo;{searchTerm.trim()}&rdquo;</span>
                      <IconArrowUpRight size={13} />
                    </Link>
                  </>
                ) : (
                  <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <span style={{ fontSize: "12px", color: "var(--store-muted)" }}>
                      Nenhum produto exato encontrado para &ldquo;{searchTerm.trim()}&rdquo;.
                    </span>
                    <Link
                      href="/loja/orcamentos"
                      onClick={() => setDropdownOpen(false)}
                      className="store-search-chip"
                      style={{ alignSelf: "flex-start" }}
                    >
                      <IconCode size={12} />
                      <span>Precisa sob medida? Simular orçamento</span>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="store-header-actions">
            <Link
              href="/loja/rastrear"
              className="store-btn store-btn-secondary store-hide-mobile"
              style={{ padding: "8px 12px", fontSize: "12px" }}
            >
              <IconPackage size={14} />
              <span>Rastrear</span>
            </Link>

            <button
              type="button"
              onClick={openWishlist}
              className="store-btn store-btn-secondary"
              style={{ padding: "8px 12px", fontSize: "12px" }}
              title="Favoritos e vistos recentemente"
              aria-label="Abrir favoritos e histórico recente"
            >
              <IconHeart size={14} filled={favorites.length > 0} />
              {favorites.length > 0 && <span className="store-cart-badge">{favorites.length}</span>}
            </button>

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
