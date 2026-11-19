/** Esqueleto de página no formato real dos módulos (cabeçalho, indicadores e painéis com linhas). */
export function PageSkeleton({ metrics = false, panels = 2 }: { metrics?: boolean; panels?: number }) {
  return (
    <div className="page" aria-busy="true" aria-live="polite">
      <p className="sr-only">Carregando…</p>
      <div className="skeleton-header" aria-hidden="true">
        <span className="skeleton skeleton-eyebrow" />
        <span className="skeleton skeleton-title" />
        <span className="skeleton skeleton-text" />
      </div>
      {metrics ? (
        <div className="metrics" aria-hidden="true">
          {[0, 1, 2, 3].map((key) => (
            <div className="metric" key={key}>
              <span className="skeleton skeleton-label" />
              <span className="skeleton skeleton-number" />
            </div>
          ))}
        </div>
      ) : null}
      <div className={panels > 1 ? "split" : undefined} aria-hidden="true">
        {Array.from({ length: panels }, (_, panel) => (
          <div className="panel" key={panel}>
            <span className="skeleton skeleton-heading" />
            {[0, 1, 2, 3].map((row) => (
              <div className="skeleton-row" key={row}>
                <span className="skeleton skeleton-icon" />
                <span className="skeleton-lines">
                  <span className="skeleton skeleton-line" />
                  <span className="skeleton skeleton-line short" />
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
