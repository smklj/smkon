/**
 * Barra segmentada de estados ordenados (ex.: ciclo da comissão). Monocromática: o estágio mais avançado
 * é o mais claro; só o estado de problema usa a cor de estado. A legenda traz rótulo e valor em texto,
 * então a identidade nunca depende só da cor.
 */
export type StateSegment = { key: string; label: string; value: number; display: string; tone: "s1" | "s2" | "s3" | "s4" | "danger" };

export function StateBar({ segments, label }: { segments: StateSegment[]; label: string }) {
  const visible = segments.filter((segment) => segment.value > 0);
  const total = visible.reduce((sum, segment) => sum + segment.value, 0);
  return (
    <div className="statebar">
      {total > 0 ? (
        <div className="statebar-track" role="img" aria-label={`${label}: ${visible.map((s) => `${s.label} ${s.display}`).join(", ")}`}>
          {visible.map((segment) => (
            <span
              key={segment.key}
              className={`statebar-seg tone-${segment.tone}`}
              style={{ flexGrow: segment.value }}
              data-tip={`${segment.label} · ${segment.display}`}
            />
          ))}
        </div>
      ) : (
        <div className="statebar-track is-empty" aria-hidden="true" />
      )}
      <ul className="statebar-legend">
        {segments.map((segment) => (
          <li key={segment.key}>
            <span className={`statebar-dot tone-${segment.tone}`} aria-hidden="true" />
            <span className="statebar-name">{segment.label}</span>
            <span className="statebar-value">{segment.display}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
