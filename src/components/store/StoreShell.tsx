"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import gsap from "gsap";
import { useSlidingPill } from "@/components/ui/SlidingPill";
import { Logo } from "@/components/brand/Logo";
import type { StoreSettings } from "@/lib/store/types";
import {
  IconBag,
  IconChevronLeft,
  IconChevronRight,
  IconCode,
  IconCpu,
  IconPackage,
  IconShield,
  IconStar,
} from "./StoreIcons";

type StoreSidebarItem = {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
};

const SIDEBAR_ITEMS: StoreSidebarItem[] = [
  { key: "home", label: "Início", href: "/", icon: <IconStar size={17} /> },
  { key: "todos", label: "Catálogo", href: "/loja/produtos", icon: <IconBag size={17} /> },
  { key: "digital", label: "Infoprodutos", href: "/loja/produtos?tipo=digital", icon: <IconCpu size={17} /> },
  { key: "shopee", label: "Shopee", href: "/loja/produtos?tipo=shopee", icon: <IconBag size={17} /> },
  { key: "orcamentos", label: "Sites & APIs", href: "/loja/orcamentos", icon: <IconCode size={17} /> },
  { key: "rastrear", label: "Rastrear", href: "/loja/rastrear", icon: <IconPackage size={17} /> },
];

function resolveStoreKey(pathname: string, tipo: string | null): string {
  if (pathname === "/" || pathname === "/loja") return "home";
  if (pathname.startsWith("/loja/orcamentos")) return "orcamentos";
  if (pathname.startsWith("/loja/rastrear") || pathname.startsWith("/loja/pedido")) return "rastrear";
  if (pathname.startsWith("/loja/produtos")) {
    if (tipo === "digital") return "digital";
    if (tipo === "shopee") return "shopee";
    return "todos";
  }
  return "home";
}

export function StoreShell({
  settings,
  header,
  children,
  overlays,
  footer,
}: {
  settings: StoreSettings;
  header: React.ReactNode;
  children: React.ReactNode;
  overlays: React.ReactNode;
  footer: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = resolveStoreKey(pathname, searchParams.get("tipo"));

  const [expanded, setExpanded] = useState(false);
  const [optimisticKey, setOptimisticKey] = useState<string | null>(null);
  const [syncedRouteKey, setSyncedRouteKey] = useState(routeKey);

  if (syncedRouteKey !== routeKey) {
    setSyncedRouteKey(routeKey);
    if (!optimisticKey || routeKey === optimisticKey) {
      setOptimisticKey(null);
    }
  }

  // Timeout de segurança para liberar estado otimista caso a navegação seja interrompida
  useEffect(() => {
    if (!optimisticKey || optimisticKey === routeKey) return;
    const t = window.setTimeout(() => setOptimisticKey(null), 1800);
    return () => window.clearTimeout(t);
  }, [optimisticKey, routeKey]);

  const activeKey = optimisticKey ?? routeKey;

  const { containerRef, pillRef, sheenRef } = useSlidingPill({
    activeKey,
    orientation: "vertical",
    onScrubKey: (scrubKey) => setOptimisticKey(scrubKey),
  });

  const mainRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.killTweensOf(el);
    gsap.fromTo(
      el,
      { opacity: 0, y: 8, scale: 0.995 },
      { opacity: 1, y: 0, scale: 1, duration: 0.34, ease: "power3.out", clearProps: "transform" },
    );
  }, [pathname, routeKey]);

  return (
    <div className={expanded ? "store-body store-shell sidebar-expanded" : "store-body store-shell"}>
      {/* Sidebar Inteligente Black & Gold com Sliding Pill GSAP */}
      <aside className="store-sidebar" aria-label="Navegação rápida da loja">
        <div className="store-sidebar-top">
          <Link
            href="/"
            draggable={false}
            className="store-sidebar-brand"
            aria-label={settings.store_name}
            onClick={() => setOptimisticKey("home")}
          >
            <Logo variant="symbol-gold" gradientId="smkon-sidebar-gold" className="store-sidebar-monogram" title={settings.store_name} />
          </Link>

          <button
            type="button"
            className="store-sidebar-toggle"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Recolher menu lateral" : "Expandir menu lateral"}
            title={expanded ? "Recolher" : "Expandir"}
          >
            {expanded ? <IconChevronLeft size={15} /> : <IconChevronRight size={15} />}
          </button>
        </div>

        <nav className="store-sidebar-nav" aria-label="Seções da loja">
          <div ref={containerRef} className="store-sidebar-track">
            <div ref={pillRef} className="sliding-pill store-sliding-pill" aria-hidden="true">
              <div ref={sheenRef} className="sliding-pill-sheen store-sliding-pill-sheen" />
            </div>

            <ul className="store-sidebar-list">
              {SIDEBAR_ITEMS.map((item) => {
                const isItemActive = activeKey === item.key;
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      draggable={false}
                      data-sliding-key={item.key}
                      data-tooltip={item.label}
                      onClick={() => setOptimisticKey(item.key)}
                      className={isItemActive ? "store-sidebar-item active" : "store-sidebar-item"}
                      aria-current={isItemActive ? "page" : undefined}
                    >
                      <span className="store-sidebar-icon">{item.icon}</span>
                      <span className="store-sidebar-label">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        <div className="store-sidebar-footer">
          <Link
            href="/painel"
            draggable={false}
            data-tooltip="Painel Admin"
            className="store-sidebar-item"
            title="Painel Administrativo"
          >
            <span className="store-sidebar-icon"><IconShield size={16} /></span>
            <span className="store-sidebar-label">Painel Admin</span>
          </Link>
        </div>
      </aside>

      {header}

      <main ref={mainRef} className="store-container">
        {children}
      </main>

      {overlays}
      {footer}

      {/* Dock Mobile */}
      <nav className="store-mobile-dock" aria-label="Navegação mobile">
        {SIDEBAR_ITEMS.slice(0, 5).map((item) => {
          const active = activeKey === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              draggable={false}
              onClick={() => setOptimisticKey(item.key)}
              className={active ? "store-mobile-dock-item active" : "store-mobile-dock-item"}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
