import Link from "next/link";

export default function ModuleNotFound() {
  return (
    <div className="page">
      <section className="panel state-panel">
        <p className="eyebrow">404</p>
        <h1 className="state-title">Não encontramos este item.</h1>
        <p className="page-description">Ele pode ter sido arquivado ou pertencer a outro workspace.</p>
        <div className="state-actions">
          <Link className="button button-primary" href="/">Visão geral</Link>
          <Link className="button button-secondary" href="/produtos">Produtos</Link>
        </div>
      </section>
    </div>
  );
}
