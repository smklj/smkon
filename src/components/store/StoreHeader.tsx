"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import gsap from "gsap";
import { useCart } from "@/lib/store/cart-context";
import { useWishlist } from "@/lib/store/wishlist-context";
import { useSlidingPill } from "@/components/ui/SlidingPill";
import { Logo } from "@/components/brand/Logo";
import type { StoreProduct, StoreSettings } from "@/lib/store/types";
import {
  IconArrowUpRight,
  IconBag,
  IconClose,
  IconCode,
  IconHeart,
  IconHistory,
  IconPackage,
  IconSearch,
} from "./StoreIcons";

const RECENT_SEARCHES_KEY = "smkon_recent_searches_v1";

type SearchScope = "todos" | "fisico" | "digital" | "shopee";

const HEADER_NAV_ITEMS = [
  { key: "home", label: "Início", href: "/" },
  { key: "fisico", label: "Hardware", href: "/loja/produtos?tipo=fisico" },
  { key: "digital", label: "Infoprodutos", href: "/loja/produtos?tipo=digital" },
  { key: "shopee", label: "Achados Shopee", href: "/loja/produtos?tipo=shopee" },
  { key: "orcamentos", label: "Sites & APIs", href: "/loja/orcamentos" },
  { key: "todos", label: "Catálogo", href: "/loja/produtos" },
];

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

function resolveHeaderNavKey(pathname: string, tipo: string | null): string | null {
  if (pathname === "/" || pathname === "/loja") return "home";
  if (pathname.startsWith("/loja/orcamentos")) return "orcamentos";
  if (pathname.startsWith("/loja/produtos")) {
    if (tipo === "fisico") return "fisico";
    if (tipo === "digital") return "digital";
    if (tipo === "shopee") return "shopee";
    return "todos";
  }
  return null;
}

export function StoreHeader({ settings }: { settings: StoreSettings }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = resolveHeaderNavKey(pathname, searchParams.get("tipo"));

  const { itemCount, openCart } = useCart();
  const { favorites, openWishlist, trackView } = useWishlist();

  const [optimisticNav, setOptimisticNav] = useState<string | null>(null);
  const [syncedRouteKey, setSyncedRouteKey] = useState(routeKey);
  if (syncedRouteKey !== routeKey) {
    setSyncedRouteKey(routeKey);
    if (!optimisticNav || routeKey === optimisticNav) {
      setOptimisticNav(null);
    }
  }

  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [scope, setScope] = useState<SearchScope>("todos");
  const [results, setResults] = useState<StoreProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const headerRef = useRef<HTMLElement | null>(null);
  const searchFormPanelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  const activeNavKey = optimisticNav ?? routeKey;
  const {
    containerRef: navRef,
    pillRef: navPillRef,
    sheenRef: navSheenRef,
  } = useSlidingPill({
    activeKey: searchExpanded ? null : activeNavKey,
    orientation: "horizontal",
    onScrubKey: (key) => setOptimisticNav(key),
    onCommitKey: (key) => {
      const target = HEADER_NAV_ITEMS.find((item) => item.key === key);
      if (target) {
        setOptimisticNav(key);
        router.push(target.href);
      }
    },
  });

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

  // Animação suave ao expandir o modo de busca
  useEffect(() => {
    if (!searchExpanded) return;
    const panel = searchFormPanelRef.current;
    if (panel && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.fromTo(
        panel,
        { opacity: 0, y: -4, scale: 0.985 },
        { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: "power3.out", clearProps: "transform" },
      );
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [searchExpanded]);

  // Atalho global "/" para expandir a busca
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
        if (activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT") return;
        e.preventDefault();
        setSearchExpanded(true);
      } else if (e.key === "Escape" && searchExpanded) {
        setSearchExpanded(false);
        setSelectedIndex(-1);
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [searchExpanded]);

  // Fecha ao clicar fora do cabeçalho quando busca expandida
  useEffect(() => {
    if (!searchExpanded) return;
    const handleOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setSearchExpanded(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [searchExpanded]);

  // Busca preditiva com debounce
  useEffect(() => {
    const q = searchTerm.trim();
    if (!searchExpanded || q.length < 2) {
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
  }, [searchTerm, scope, searchExpanded]);

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
    setSearchExpanded(false);
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
    if (e.key === "Escape") {
      setSearchExpanded(false);
      setSelectedIndex(-1);
    } else if (e.key === "ArrowDown" && results.length > 0) {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length > 0) {
      e.preventDefault();
      setSelectedIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
    }
  };

  const isDefaultLogo =
    !settings.logo_url ||
    settings.logo_url === "/brand/smkon-logo-horizontal-white.svg" ||
    settings.logo_url === "/brand/smkon-logo-horizontal-gold.svg" ||
    settings.logo_url === "/brand/smkon-icon-light.jpg";

  const hasQuery = searchTerm.trim().length >= 2;

  return (
    <header ref={headerRef} className="store-header">
      <div className="store-header-container">
        {/* Esquerda: Logo Horizontal Oficial Toda Branca */}
        <Link href="/" className="store-logo" aria-label={settings.store_name}>
          {isDefaultLogo || !settings.logo_url ? (
            <Logo
              variant="horizontal-white"
              className="store-header-official-svg"
              title={settings.store_name}
            />
          ) : (
            <Image
              src={settings.logo_url}
              alt={settings.store_name}
              width={140}
              height={32}
              style={{ height: 28, width: "auto", objectFit: "contain" }}
            />
          )}
        </Link>

        {searchExpanded ? (
          /* Modo Busca Expandida Limpa (Estilo Apple/Farfetch) */
          <div ref={searchFormPanelRef} className="store-search-expanded-panel">
            <form onSubmit={handleSearch} className="store-lux-search-form">
              <span className="store-lux-search-icon" aria-hidden="true">
                <IconSearch size={16} />
              </span>

              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-controls="store-search-listbox"
                placeholder="Buscar produtos, sistemas PDV ou achados na SMKON..."
                className="store-lux-search-input"
                value={searchTerm}
                onKeyDown={handleKeyDown}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-expanded={searchExpanded}
                aria-autocomplete="list"
              />

              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setResults([]);
                    inputRef.current?.focus();
                  }}
                  className="store-lux-search-clear"
                  aria-label="Limpar busca"
                >
                  Limpar
                </button>
              )}

              <button
                type="button"
                onClick={() => setSearchExpanded(false)}
                className="store-lux-search-close"
                aria-label="Fechar busca"
              >
                <IconClose size={16} />
              </button>
            </form>

            {/* Painel Preditivo Logo Abaixo */}
            <div id="store-search-listbox" className="store-search-dropdown" role="listbox" aria-label="Sugestões de busca">
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
                              setSearchExpanded(false);
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
                  <div className="store-search-section-label">Explorar coleções</div>
                  <div className="store-search-chips">
                    {QUICK_CATEGORIES.map((cat) => (
                      <Link
                        key={cat.href}
                        href={cat.href}
                        className="store-search-chip"
                        onClick={() => setSearchExpanded(false)}
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
                          setSearchExpanded(false);
                        }}
                        className={idx === selectedIndex ? "store-search-result selected" : "store-search-result"}
                      >
                        <Image
                          src={img}
                          alt={prod.name}
                          width={40}
                          height={40}
                          style={{ width: 40, height: 40, borderRadius: "8px", objectFit: "cover", flexShrink: 0 }}
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
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#fff", flexShrink: 0 }}>
                          {formatBRL(prod.price_cents)}
                        </span>
                      </Link>
                    );
                  })}
                  <Link
                    href={buildSearchHref(searchTerm.trim())}
                    onClick={() => {
                      saveSearchTerm(searchTerm);
                      setSearchExpanded(false);
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
                    onClick={() => setSearchExpanded(false)}
                    className="store-search-chip"
                    style={{ alignSelf: "flex-start" }}
                  >
                    <IconCode size={12} />
                    <span>Precisa sob medida? Simular orçamento</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Centro: Navegação Editorial Minimalista com GSAP Sliding Pill */}
            <nav className="store-header-nav" aria-label="Navegação principal">
              <div ref={navRef} className="store-header-nav-track">
                <div ref={navPillRef} className="store-header-nav-pill" aria-hidden="true">
                  <div ref={navSheenRef} className="store-header-nav-sheen" />
                </div>
                <div className="store-header-nav-list">
                  {HEADER_NAV_ITEMS.map((item) => {
                    const active = activeNavKey === item.key;
                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        draggable={false}
                        data-sliding-key={item.key}
                        onClick={() => setOptimisticNav(item.key)}
                        className={active ? "store-header-nav-link active" : "store-header-nav-link"}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </nav>

            {/* Direita: Ferramentas Minimalistas (Lupa Discreta, Rastrear, Favoritos, Sacola) */}
            <div className="store-header-tools">
              <button
                type="button"
                onClick={() => setSearchExpanded(true)}
                className="store-tool-btn"
                title="Buscar (tecla /)"
                aria-label="Abrir busca"
              >
                <IconSearch size={16} />
              </button>

              <Link
                href="/loja/rastrear"
                className="store-tool-btn store-hide-mobile"
                title="Rastrear pedido"
                aria-label="Rastrear pedido"
              >
                <IconPackage size={16} />
              </Link>

              <button
                type="button"
                onClick={openWishlist}
                className="store-tool-btn"
                title="Favoritos e vistos recentemente"
                aria-label="Abrir favoritos e histórico recente"
              >
                <IconHeart size={16} filled={favorites.length > 0} />
                {favorites.length > 0 && <span className="store-tool-count">{favorites.length}</span>}
              </button>

              <button
                type="button"
                onClick={openCart}
                className="store-tool-bag"
                aria-label="Abrir sacola de compras"
                title="Abrir carrinho"
              >
                <IconBag size={16} />
                {itemCount > 0 && <span className="store-tool-bag-count">{itemCount}</span>}
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
