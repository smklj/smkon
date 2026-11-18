import type { Area } from "@/lib/admin/constants";
import { Badge } from "@/components/ui/PageHeader";

export function AreaCard({ area }: { area: Area }) {
  return (
    <li className="row row-top">
      <span className="row-index">{area.id}</span>
      <div className="row-main">
        <p className="row-title">{area.name}</p>
        <p className="row-meta">{area.description}</p>
        <div className="chips">
          {area.scope.map((item) => (
            <span className="chip" key={item}>{item}</span>
          ))}
        </div>
      </div>
      <Badge>{area.state}</Badge>
    </li>
  );
}
