import type { DailyPoint } from "@/lib/overview/types";

const dayLabel = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", timeZone: "UTC" });

function label(day: string, long = false): string {
  const date = new Date(`${day}T00:00:00Z`);
  return (long ? weekday : dayLabel).format(date).replace(".", "");
}

/**
 * Barras diárias de uma única série (monocromáticas; o título nomeia a série, sem legenda).
 * Escala começa em zero. Hover mostra dia e valor; leitores de tela recebem uma tabela.
 * `today` destaca o dia atual (o mais claro).
 */
export function DailyBars({
  title,
  points,
  unit,
  today,
  emptyText,
}: {
  title: string;
  points: { day: string; count: number }[] | DailyPoint[];
  unit: [singular: string, plural: string];
  today?: string;
  emptyText: string;
}) {
  const total = points.reduce((sum, point) => sum + point.count, 0);
  const max = Math.max(1, ...points.map((point) => point.count));
  const word = (n: number) => (n === 1 ? unit[0] : unit[1]);

  return (
    <figure className="trend">
      <figcaption className="trend-head">
        <span className="trend-title">{title}</span>
        <span className="trend-total">{total} {word(total)}</span>
      </figcaption>
      {points.length === 0 ? (
        <p className="row-meta trend-empty">Sem dados para o período.</p>
      ) : (
        <>
          <div className="trend-bars" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
            {points.map((point) => (
              <div
                key={point.day}
                className={point.day === today ? "trend-col is-today" : "trend-col"}
                data-tip={`${label(point.day, true)} · ${point.count} ${word(point.count)}`}
              >
                <span className={point.count === 0 ? "trend-bar is-zero" : "trend-bar"} style={{ height: `${(point.count / max) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="trend-axis" aria-hidden="true">
            <span>{label(points[0].day)}</span>
            <span>{label(points[points.length - 1].day)}</span>
          </div>
          {total === 0 ? <p className="row-meta trend-empty">{emptyText}</p> : null}
          <table className="sr-only">
            <caption>{title}</caption>
            <thead><tr><th scope="col">Dia</th><th scope="col">{unit[1]}</th></tr></thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.day}><td>{label(point.day, true)}</td><td>{point.count}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </figure>
  );
}
