import Link from "next/link";

const pillars = [
  { number: "01", title: "Product Intelligence", description: "Pesquisa, avaliação e comparação de produtos e ofertas." },
  { number: "02", title: "Content & Rights", description: "Conteúdo, versões, ativos, licenças e aprovação editorial." },
  { number: "03", title: "Growth", description: "Canais, calendário, distribuição e indicadores de desempenho." },
  { number: "04", title: "Finance", description: "Comissões, conciliação e visão financeira operacional." },
  { number: "05", title: "AI Workforce", description: "Agentes com permissões mínimas, auditoria e supervisão." }
];

export default function Home() {
  return (
    <main className="shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="SMKON início"><span className="brand-mark">S</span><span>SMKON</span></Link>
        <span className="environment"><i /> FOUNDATION / SPRINT 0</span>
      </header>

      <section className="hero">
        <p className="eyebrow">CONTROL CENTER · PRIVATE WORKSPACE</p>
        <h1>Achados inteligentes.<br /><span>Escolhas melhores.</span></h1>
        <p className="intro">A base operacional da SMKON para transformar curadoria em decisões úteis, conteúdo confiável e crescimento mensurável.</p>
        <div className="hero-meta"><span>PLATAFORMA EM CONSTRUÇÃO</span><span>v0.1.0</span></div>
        <div style={{marginTop:28}}><Link className="btn primary" href="/fila">Abrir fila de conteúdo</Link></div>
      </section>

      <section className="section-heading">
        <div><p className="eyebrow">WORKSPACE MODULES</p><h2>Fundação do sistema</h2></div>
        <span className="status">05 PILARES MAPEADOS</span>
      </section>

      <section className="modules" aria-label="Módulos planejados">
        {pillars.map((pillar) => (
          <article className="module" key={pillar.number}>
            <span className="module-number">{pillar.number}</span>
            <div><h3>{pillar.title}</h3><p>{pillar.description}</p></div>
            <span className="module-state">PLANEJADO</span>
          </article>
        ))}
      </section>

      <footer><span>SMKON © {new Date().getFullYear()}</span><span>UTILITY FIRST · EVIDENCE ALWAYS</span></footer>
    </main>
  );
}
