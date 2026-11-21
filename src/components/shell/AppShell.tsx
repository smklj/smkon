"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Icon } from "@/components/ui/Icon";
import { Toaster } from "@/components/ui/Toaster";
import { WorkspaceSwitcher, type WorkspaceOption } from "@/components/shell/WorkspaceSwitcher";
import { NAV_ITEMS, STATUS_LABEL, isActive } from "@/lib/navigation";

type AppShellProps = {
  children: React.ReactNode;
  userEmail: string | null;
  workspaces: WorkspaceOption[];
  activeWorkspaceId: string | null;
  signOutAction: () => Promise<void>;
};

export function AppShell({ children, userEmail, workspaces, activeWorkspaceId, signOutAction }: AppShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);

  // Fecha o menu móvel ao navegar (ajuste durante o render, sem efeito).
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }

  return (
    <div className="app">
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>

      <header className="app-mobilebar">
        <Link href="/" className="app-logo" aria-label="SMKON — visão geral">
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
        <Link href="/" className="app-logo app-logo-desktop" aria-label="SMKON — visão geral">
          <Logo variant="horizontal" />
        </Link>

        <nav className="app-nav" aria-label="Módulos">
          <p className="app-nav-title">Operação</p>
          <ul>
            {NAV_ITEMS.map((item) => {
              const active = item.href ? isActive(pathname, item.href) : false;
              const content = (
                <>
                  <span className="app-nav-icon" style={{ "--accent": item.accent } as React.CSSProperties}>
                    <Icon name={item.icon} />
                  </span>
                  <span className="app-nav-label">{item.label}</span>
                  {item.status !== "available" ? (
                    <span className={`app-nav-tag app-nav-tag-${item.status}`}>{item.status === "building" ? "Beta" : "Planejado"}</span>
                  ) : null}
                </>
              );
              return (
                <li key={item.area}>
                  {item.href ? (
                    <Link
                      href={item.href}
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
        </nav>

        <div className="app-sidebar-footer">
          <WorkspaceSwitcher workspaces={workspaces} activeId={activeWorkspaceId} />
          {userEmail ? <p className="app-user" title={userEmail}>{userEmail}</p> : null}
          <form action={signOutAction}>
            <button type="submit" className="app-nav-item app-signout">
              <span className="app-nav-icon"><Icon name="logout" /></span>
              <span className="app-nav-label">Sair</span>
            </button>
          </form>
        </div>
      </aside>

      {menuOpen ? <button type="button" className="app-scrim" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} /> : null}

      <main id="conteudo" className="app-main">
        {children}
      </main>

      <Toaster />
    </div>
  );
}
