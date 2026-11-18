import { INTEGRATION_PLACEHOLDERS } from "@/lib/admin/constants";
import { Badge } from "@/components/ui/PageHeader";

export function IntegrationPlaceholders() {
  return (
    <ul className="rows">
      {INTEGRATION_PLACEHOLDERS.map((item) => (
        <li className="row" key={item.name}>
          <div className="row-main">
            <p className="row-title">{item.name}</p>
            <p className="row-meta">{item.detail}</p>
          </div>
          <Badge>Não conectado</Badge>
        </li>
      ))}
    </ul>
  );
}
