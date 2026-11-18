import type { Area } from "@/lib/admin/constants";

type Props = {
  area: Area;
};

export function AreaCard({ area }: Props) {
  return (
    <article className="area-card">
      <div className="stream-top">
        <span className="module-number">{area.id}</span>
        <span className="stream-type">{area.type}</span>
      </div>
      <h3>{area.name}</h3>
      <p className="stream-description">{area.description}</p>
      <div className="source-list">
        {area.scope.map((item) => (
          <span className="source-chip" key={item}>
            {item}
          </span>
        ))}
      </div>
      <div className="stream-bottom">
        <span className="module-state">{area.state}</span>
      </div>
    </article>
  );
}
