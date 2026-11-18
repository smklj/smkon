import type { RevenueDomain } from "@/lib/admin/constants";

export function DomainCard({ domain }: { domain: RevenueDomain }) {
  return (
    <article className="domain">
      <p className="eyebrow">{domain.id} · {domain.type}</p>
      <h3>{domain.name}</h3>
      <p className="row-meta">{domain.description}</p>
      <p className="domain-label">Fontes planejadas</p>
      <div className="chips">
        {domain.sources.map((source) => (
          <span className="chip" key={source}>{source}</span>
        ))}
      </div>
      <p className="domain-metric">{domain.metric}</p>
    </article>
  );
}
