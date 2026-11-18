import Link from "next/link";
import { AREAS, REVENUE_DOMAINS } from "@/lib/admin/constants";
import { AreaCard } from "@/components/admin/AreaCard";
import { DomainCard } from "@/components/admin/DomainCard";
import { ContentList } from "@/components/admin/ContentList";
import { IntegrationPlaceholders } from "@/components/admin/IntegrationPlaceholders";

export const metadata = {
  title: "Admin Panel | SMKON",
  description: "Painel administrativo de leitura — 8 áreas, 3 domínios financeiros e conteúdos.",
};

export default function AdminPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="SMKON início">
          <span className="brand-mark">S</span>
          <span>SMKON</span>
        </Link>
        <nav className="home-nav" style={{ display: "flex", gap: "24px", alignItems: "center" }}>
          <Link href="/">Control Center</Link>
          <Link href="/studio">Content Studio</Link>
          <Link href="/admin" style={{ color: "var(--blue-soft)" }}>
            Admin
          </Link>
          <span className="environment">
            <i /> ADMIN / LEITURA
          </span>
        </nav>
      </header>

      <section className="hero" style={{ padding: "64px 0 48px" }}>
        <p className="eyebrow">ADMIN PANEL · SOMENTE LEITURA</p>
        <h1>
          Visão operacional.
          <br />
          <span>8 áreas · 3 domínios.</span>
        </h1>
        <p className="intro">
          Dashboard consolidado das áreas operacionais, domínios financeiros e listagem de conteúdos do Content Studio.
          Placeholders claros para integrações futuras. Nenhum dado é publicado ou alterado. RLS e auth existentes preservados.
        </p>
        <div className="hero-meta">
          <span>MODO LEITURA</span>
          <span>SEM MERGE · SEM DEPLOY · SEM PUBLICAÇÃO</span>
        </div>
      </section>

      <section className="section-heading">
        <div>
          <p className="eyebrow">OPERATING MODEL / 01—08</p>
          <h2>Áreas principais</h2>
        </div>
        <span className="status">08 MÓDULOS · LEITURA</span>
      </section>
      <section className="area-grid" aria-label="Oito áreas operacionais">
        {AREAS.map((area) => (
          <AreaCard key={area.id} area={area} />
        ))}
      </section>

      <section className="section-heading integration-heading">
        <div>
          <p className="eyebrow">AREA 05 · FINANCE</p>
          <h2>Três domínios financeiros</h2>
        </div>
        <span className="status">CUSTO / VENDA / COMISSÃO</span>
      </section>
      <section className="streams" aria-label="Domínios financeiros">
        {REVENUE_DOMAINS.map((domain) => (
          <DomainCard key={domain.id} domain={domain} />
        ))}
      </section>

      <section className="section-heading integration-heading">
        <div>
          <p className="eyebrow">CONTENT / API</p>
          <h2>Listagem de conteúdos</h2>
        </div>
        <span className="status">VIA /api/content</span>
      </section>
      <section className="connections" style={{ marginBottom: "48px" }}>
        <ContentList />
      </section>

      <section className="section-heading integration-heading">
        <div>
          <p className="eyebrow">INTEGRAÇÕES FUTURAS</p>
          <h2>Placeholders claros</h2>
        </div>
        <span className="status">NÃO CONECTADO · SEM OAUTH</span>
      </section>
      <IntegrationPlaceholders />

      <footer style={{ marginTop: "48px" }}>
        <span>SMKON © {new Date().getFullYear()} · Admin Panel MVP</span>
        <span>LEITURA APENAS · SEM AÇÕES EXTERNAS</span>
      </footer>
    </main>
  );
}
