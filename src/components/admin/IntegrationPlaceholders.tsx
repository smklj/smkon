import { INTEGRATION_PLACEHOLDERS } from "@/lib/admin/constants";

export function IntegrationPlaceholders() {
  return (
    <section className="connections">
      {INTEGRATION_PLACEHOLDERS.map((item) => (
        <div className="connection-row" key={item.name}>
          <div>
            <h3>{item.name}</h3>
            <p>{item.detail}</p>
          </div>
          <span className="module-state">{item.state}</span>
        </div>
      ))}
    </section>
  );
}
