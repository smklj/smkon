import type { RevenueDomain } from "@/lib/admin/constants";

type Props = {
  domain: RevenueDomain;
};

export function DomainCard({ domain }: Props) {
  return (
    <article className="stream">
      <div className="stream-top">
        <span className="module-number">{domain.id}</span>
        <span className="stream-type">{domain.type}</span>
      </div>
      <h3>{domain.name}</h3>
      <p className="stream-description">{domain.description}</p>
      <div className="stream-sources">
        <span className="field-label">FONTES PLANEJADAS</span>
        <div className="source-list">
          {domain.sources.map((source) => (
            <span className="source-chip" key={source}>
              {source}
            </span>
          ))}
        </div>
      </div>
      <div className="stream-bottom">
        <span>{domain.metric}</span>
        <span className="module-state">MODELAGEM INICIAL</span>
      </div>
    </article>
  );
}
