import type { Metadata } from "next";
import { AreaCard } from "@/components/admin/AreaCard";
import { ConnectionsPanel } from "@/components/admin/ConnectionsPanel";
import { ContentList } from "@/components/admin/ContentList";
import { DomainCard } from "@/components/admin/DomainCard";
import { IntegrationPlaceholders } from "@/components/admin/IntegrationPlaceholders";
import { InvitationsPanel } from "@/components/admin/InvitationsPanel";
import { PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { AREAS, REVENUE_DOMAINS } from "@/lib/admin/constants";

export const metadata: Metadata = {
  title: "Segurança e admin",
  description: "Modelo operacional, domínios financeiros, conteúdos e integrações.",
};

export default function AdminPage() {
  return (
    <div className="page">
      <PageHeader
        eyebrow="08 · Segurança e admin"
        title="Administração"
        description="Membros, modelo operacional, domínios financeiros e conexões reais do workspace."
      />

      <section className="panel" aria-labelledby="convites-titulo">
        <SectionHeading id="convites-titulo" title="Membros e convites" aside={<span className="muted">acesso somente por convite</span>} />
        <InvitationsPanel />
      </section>

      <details className="panel panel-collapsible">
        <summary>
          <SectionHeading id="areas-titulo" title="Modelo operacional" aside={<span className="muted">8 áreas · referência</span>} />
        </summary>
        <ul className="rows">
          {AREAS.map((area) => (
            <AreaCard key={area.id} area={area} />
          ))}
        </ul>
      </details>

      <section className="panel" aria-labelledby="dominios-titulo">
        <SectionHeading id="dominios-titulo" title="Domínios financeiros" aside={<span className="muted">custo · venda · comissão</span>} />
        <div className="domains">
          {REVENUE_DOMAINS.map((domain) => (
            <DomainCard key={domain.id} domain={domain} />
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="conteudos-titulo">
        <SectionHeading id="conteudos-titulo" title="Conteúdos do workspace" />
        <ContentList />
      </section>

      <section className="panel" aria-labelledby="integracoes-titulo">
        <SectionHeading id="integracoes-titulo" title="Conexões do workspace" aside={<span className="muted">dados reais</span>} />
        <ConnectionsPanel />
      </section>

      <details className="panel panel-collapsible">
        <summary>
          <SectionHeading id="planejadas-titulo" title="Integrações planejadas" aside={<span className="muted">ainda não validadas</span>} />
        </summary>
        <IntegrationPlaceholders />
      </details>
    </div>
  );
}
