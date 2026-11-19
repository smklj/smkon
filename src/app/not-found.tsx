import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Página não encontrada" };

export default function NotFound() {
  return (
    <main className="standalone">
      <section className="panel state-panel">
        <p className="eyebrow">404</p>
        <h1 className="state-title">Esta página não existe.</h1>
        <p className="page-description">Confira o endereço ou volte para o início.</p>
        <div className="state-actions">
          <Link className="button button-primary" href="/">Ir para o SMKON</Link>
        </div>
      </section>
    </main>
  );
}
