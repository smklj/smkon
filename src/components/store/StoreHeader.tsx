"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/store/cart-context";
import { useWishlist } from "@/lib/store/wishlist-context";
import { Logo } from "@/components/brand/Logo";
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

type SearchScope = "todos" | "fisico" | "digital" | "shopee";

const SCOPE_OPTIONS: Array<{ key: SearchScope; label: string }> = [
  { key: "todos", label: "Tudo" },
  { key: "fisico", label: "Hardware" },
  { key: "digital", label: "Digital" },
  { key: "shopee", label: "Shopee" },
];

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
  const { itemCount, subtotalCents, openCart } = useCart();
  const { favorites, openWishlist, trackView } = useWishlist();
  const [searchTerm, setSearchTerm] = useState("");
  const [scope, setScope] = useState<SearchScope>("todos");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [results, setResults] = useState<StoreProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
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

  // Atalho global "/" para focar a barra de comando da loja
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
      if (activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT") return;
      e.preventDefault();
      inputRef.current?.focus();
      setDropdownOpen(true);
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
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
        const tipoParam = scope !== "todos" ? `&tipo=${scope}` : "";
        const res = await fetch(`/api/store/products?q=${encodeURIComponent(q)}${tipoParam}&limite=5`);
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
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(debounce);
    };
  }, [searchTerm, scope]);

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

  const buildSearchHref = (query: string) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (scope !== "todos") params.set("tipo", scope);
    const qs = params.toString();
    return qs ? `/loja/produtos?${qs}` : "/loja/produtos";
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
    }
    router.push(buildSearchHref(searchTerm.trim()));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownOpen) return;
    if (e.key === "Escape") {
      setDropdownOpen(false);
      setSelectedIndex(-1);
      inputRef.current?.blur();
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
          {/* Lockup Editorial Compacto (Monograma aparece no mobile onde a sidebar oculta) */}
          <Link href="/" className="store-header-brand" aria-label={settings.store_name}>
            <Logo variant="symbol-gold" gradientId="smkon-header-gold" className="store-header-mobile-mark" title={settings.store_name} />
            <div className="store-header-wordmark-stack">
              <div className="store-header-wordmark-row">
                <span className="store-header-name">SMKON</span>
                <span className="store-header-edition">OFICIAL</span>
              </div>
              <span className="store-header-sub">
                <span className="store-header-dot" aria-hidden="true" />
                <span>Curadoria &amp; Engenharia</span>
              </span>
            </div>
          </Link>

          {/* Barra de Busca Arquitetural Estilo Command Bar */}
          <div ref={searchWrapRef} className="store-search-wrap">
            <form onSubmit={handleSearch} className="store-cmd-search">
              <span className="store-cmd-leading" aria-hidden="true">
                <IconSearch size={15} />
              </span>

              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-controls="store-search-listbox"
                placeholder="Buscar hardware, sistemas PDV, achados..."
                className="store-cmd-input"
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

              <div className="store-cmd-trailing">
                {searchTerm ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
                      setResults([]);
                      inputRef.current?.focus();
                    }}
                    className="store-cmd-clear"
                    aria-label="Limpar busca"
                  >
                    <IconClose size={13} />
                  </button>
                ) : (
                  <kbd className="store-cmd-kbd" title="Pressione / para buscar">/</kbd>
                )}

                <span className="store-cmd-sep" aria-hidden="true" />

                <button
                  type="submit"
                  className={searchTerm.trim() ? "store-cmd-submit active" : "store-cmd-submit"}
                  aria-label="Pesquisar no catálogo"
                >
                  <span className="store-hide-mobile">Buscar</span>
                  <IconArrowUpRight size={13} />
                </button>
              </div>
            </form>

            {dropdownOpen && (
              <div id="store-search-listbox" className="store-search-dropdown" role="listbox" aria-label="Sugestões de busca">
                {/* Escopo rápido dentro da busca */}
                <div className="store-cmd-scopes">
                  {SCOPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setScope(opt.key)}
                      className={scope === opt.key ? "store-cmd-scope active" : "store-cmd-scope"}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

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
                                router.push(buildSearchHref(term));
                              }}
                            >
                              <IconHistory size={11} />
                              <span>{term}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    <div className="store-search-section-label">Acesso rápido</div>
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
                      href={buildSearchHref(searchTerm.trim())}
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

          {/* Cluster de Ações com Hierarquia Refinada */}
          <div className="store-header-actions">
            <Link href="/loja/rastrear" className="store-action-ghost store-hide-mobile">
              <IconPackage size={14} />
              <span>Rastrear</span>
            </Link>

            <span className="store-action-divider store-hide-mobile" aria-hidden="true" />

            <button
              type="button"
              onClick={openWishlist}
              className="store-action-icon"
              title="Favoritos e vistos recentemente"
              aria-label="Abrir favoritos e histórico recente"
            >
              <IconHeart size={15} filled={favorites.length > 0} />
              {favorites.length > 0 && <span className="store-action-dot">{favorites.length}</span>}
            </button>

            <button onClick={openCart} className="store-action-cart" aria-label="Abrir carrinho de compras">
              <IconCart size={15} />
              <span>Carrinho</span>
              {itemCount > 0 ? (
                <span className="store-action-cart-pill">
                  {itemCount} · {formatBRL(subtotalCents)}
                </span>
              ) : (
                <span className="store-action-cart-empty">0</span>
              )}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
