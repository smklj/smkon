import type { Metadata } from "next";
import { AreaCard } from "@/components/admin/AreaCard";
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
        description="Modelo operacional de referência, domínios financeiros e estado das integrações. Esta tela é somente leitura."
      />

      <section className="panel" aria-labelledby="convites-titulo">
        <SectionHeading id="convites-titulo" title="Membros e convites" aside={<span className="muted">acesso somente por convite</span>} />
        <InvitationsPanel />
      </section>

      <section className="panel" aria-labelledby="areas-titulo">
        <SectionHeading id="areas-titulo" title="Modelo operacional" aside={<span className="muted">8 áreas</span>} />
        <ul className="rows">
          {AREAS.map((area) => (
            <AreaCard key={area.id} area={area} />
          ))}
        </ul>
      </section>

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
        <SectionHeading id="integracoes-titulo" title="Integrações" aside={<span className="muted">nenhuma conectada</span>} />
        <IntegrationPlaceholders />
      </section>
    </div>
  );
}
