"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Icon } from "@/components/ui/Icon";
import { Toaster } from "@/components/ui/Toaster";
import { useSlidingPill } from "@/components/ui/SlidingPill";
import { WorkspaceSwitcher, type WorkspaceOption } from "@/components/shell/WorkspaceSwitcher";
import { PageTransition } from "@/components/shell/PageTransition";
import { NAV_ITEMS, STATUS_LABEL, isActive } from "@/lib/navigation";

type AppShellProps = {
  children: React.ReactNode;
  userEmail: string | null;
  workspaces: WorkspaceOption[];
  activeWorkspaceId: string | null;
  signOutAction: () => Promise<void>;
};

const COMPACT_STORAGE_KEY = "smkon_sidebar_compact_v1";

function readInitialCompact(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const saved = window.localStorage.getItem(COMPACT_STORAGE_KEY);
    if (saved === "true") return true;
    if (saved === "false") return false;
    return window.innerWidth <= 1180 && window.innerWidth > 960;
  } catch {
    return false;
  }
}

export function AppShell({ children, userEmail, workspaces, activeWorkspaceId, signOutAction }: AppShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);
  const [compact, setCompact] = useState<boolean>(readInitialCompact);

  // Fecha o menu móvel ao navegar (ajuste durante o render, sem efeito).
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }

  const activeItem = NAV_ITEMS.find((item) => item.href && isActive(pathname, item.href));
  const activeKey = activeItem?.area ?? null;

  const { containerRef, pillRef, sheenRef } = useSlidingPill({
    activeKey: `${activeKey ?? ""}-${compact ? "c" : "e"}`,
    orientation: "vertical",
  });

  const toggleCompact = () => {
    setCompact((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COMPACT_STORAGE_KEY, String(next));
      } catch {
        // Ignora falha de storage
      }
      return next;
    });
  };

  const mobileDockItems = NAV_ITEMS.filter((item) =>
    ["01", "02", "03", "09", "08"].includes(item.area) && item.href,
  );

  return (
    <div className={compact ? "app sidebar-compact" : "app"}>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>

      <header className="app-mobilebar">
        <Link href="/painel" className="app-logo" aria-label="SMKON — visão geral">
          <Logo variant="horizontal" />
        </Link>
        <button
          type="button"
          className="icon-button"
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Icon name={menuOpen ? "close" : "menu"} size={20} />
        </button>
      </header>

      <aside id="app-sidebar" className={menuOpen ? "app-sidebar open" : "app-sidebar"}>
        <div className="app-sidebar-top">
          <Link href="/painel" className="app-logo app-logo-desktop" aria-label="SMKON — visão geral">
            <Logo variant="horizontal" />
          </Link>
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={toggleCompact}
            aria-label={compact ? "Expandir barra lateral" : "Recolher barra lateral"}
            title={compact ? "Expandir barra lateral" : "Recolher barra lateral"}
          >
            <Icon name={compact ? "chevron-right" : "chevron-left"} size={16} />
          </button>
        </div>

        <nav className="app-nav" aria-label="Módulos">
          <p className="app-nav-title">Operação</p>
          <div ref={containerRef} className="app-nav-track">
            <div ref={pillRef} className="sliding-pill" aria-hidden="true">
              <div ref={sheenRef} className="sliding-pill-sheen" />
            </div>
            <ul className="app-nav-list">
              {NAV_ITEMS.map((item) => {
                const active = item.href ? isActive(pathname, item.href) : false;
                const slidingKey = `${item.area}-${compact ? "c" : "e"}`;
                const content = (
                  <>
                    <span className="app-nav-icon" style={{ "--accent": item.accent } as React.CSSProperties}>
                      <Icon name={item.icon} />
                    </span>
                    <span className="app-nav-label">{item.label}</span>
                    {item.status !== "available" ? (
                      <span className={`app-nav-tag app-nav-tag-${item.status}`}>
                        {item.status === "building" ? "Beta" : "Planejado"}
                      </span>
                    ) : null}
                  </>
                );
                return (
                  <li key={item.area}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        data-sliding-key={slidingKey}
                        data-tooltip={item.label}
                        className={active ? "app-nav-item active" : "app-nav-item"}
                        aria-current={active ? "page" : undefined}
                      >
                        {content}
                      </Link>
                    ) : (
                      <span
                        className="app-nav-item disabled"
                        aria-disabled="true"
                        title={`${item.label}: ${STATUS_LABEL[item.status]}`}
                      >
                        {content}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        <div className="app-sidebar-footer">
          <WorkspaceSwitcher workspaces={workspaces} activeId={activeWorkspaceId} />
          {userEmail ? <p className="app-user" title={userEmail}>{userEmail}</p> : null}
          <form action={signOutAction}>
            <button
              type="submit"
              data-tooltip="Sair"
              className="app-nav-item app-signout"
            >
              <span className="app-nav-icon"><Icon name="logout" /></span>
              <span className="app-nav-label">Sair</span>
            </button>
          </form>
        </div>
      </aside>

      {menuOpen ? <button type="button" className="app-scrim" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} /> : null}

      <main id="conteudo" className="app-main">
        <PageTransition>{children}</PageTransition>
      </main>

      <nav className="app-mobile-dock" aria-label="Atalhos inferiores">
        {mobileDockItems.map((item) => {
          const active = item.href ? isActive(pathname, item.href) : false;
          return (
            <Link
              key={item.area}
              href={item.href!}
              className={active ? "app-mobile-dock-item active" : "app-mobile-dock-item"}
              aria-current={active ? "page" : undefined}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>

      <Toaster />
    </div>
  );
}
