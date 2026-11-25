import type { Metadata } from "next";
import Link from "next/link";
import { AreaCard } from "@/components/admin/AreaCard";
import { ConnectionsPanel } from "@/components/admin/ConnectionsPanel";
import { ContentList } from "@/components/admin/ContentList";
import { DomainCard } from "@/components/admin/DomainCard";
import { ExternalActionsPanel } from "@/components/admin/ExternalActionsPanel";
import { IntegrationHubPanel } from "@/components/admin/IntegrationHubPanel";
import { InvitationsPanel } from "@/components/admin/InvitationsPanel";
import { MembersPanel } from "@/components/admin/MembersPanel";
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
        actions={
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <Link className="link" href="/admin/loja" style={{ color: "#00F0FF" }}>
              🛍️ Gestão da Loja Virtual
            </Link>
            <Link className="link" href="/admin/studio">
              🗄️ Abrir Data Studio (Prisma REA)
            </Link>
          </div>
        }
      />

      <section className="panel" aria-labelledby="membros-titulo">
        <SectionHeading id="membros-titulo" title="Membros" aside={<span className="muted">papéis e acesso</span>} />
        <MembersPanel />
      </section>

      <section className="panel" aria-labelledby="convites-titulo">
        <SectionHeading id="convites-titulo" title="Convites" aside={<span className="muted">acesso somente por convite</span>} />
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

      <section className="panel" aria-labelledby="acoes-externas-titulo">
        <SectionHeading
          id="acoes-externas-titulo"
          title="Ações externas e publicações"
          aside={<span className="muted">aprovação humana por hash exato</span>}
        />
        <ExternalActionsPanel />
      </section>

      <section className="panel" aria-labelledby="hub-titulo">
        <SectionHeading id="hub-titulo" title="Hub de integrações" aside={<span className="muted">redes e plataformas</span>} />
        <IntegrationHubPanel />
      </section>
    </div>
  );
}
