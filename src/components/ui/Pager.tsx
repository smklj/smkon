import Link from "next/link";

/**
 * Navegação de listas paginadas por cursor (S16). Keyset só anda para a frente:
 * "Próxima página" leva o cursor da última linha; "Voltar ao início" limpa o cursor.
 */
export function Pager({ nextHref, firstHref, shown }: { nextHref: string | null; firstHref: string | null; shown: number }) {
  if (!nextHref && !firstHref) return null;
  return (
    <nav className="pager" aria-label="Paginação">
      <span className="muted">{shown} {shown === 1 ? "item nesta página" : "itens nesta página"}</span>
      <div className="pager-actions">
        {firstHref ? <Link className="button button-secondary button-small" href={firstHref}>Voltar ao início</Link> : null}
        {nextHref ? <Link className="button button-secondary button-small" href={nextHref} rel="next">Próxima página</Link> : null}
      </div>
    </nav>
  );
}

/** Monta o href da lista preservando os filtros e trocando só o cursor. */
export function pageHref(pathname: string, params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
}
