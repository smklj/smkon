import type { Area } from "@/lib/admin/constants";
import { Badge } from "@/components/ui/PageHeader";
import { NAV_ITEMS, STATUS_LABEL } from "@/lib/navigation";

/** Estado do módulo vem de NAV_ITEMS, a mesma fonte da navegação e da visão geral. */
export function AreaCard({ area }: { area: Area }) {
  const status = NAV_ITEMS.find((item) => item.area === area.id)?.status ?? "planned";
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
      <Badge tone={status === "available" ? "ok" : status === "building" ? "info" : "neutral"}>{STATUS_LABEL[status]}</Badge>
    </li>
  );
}
