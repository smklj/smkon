import Link from "next/link";

const streams = [
  { id: "01", name: "Mídia e anúncios", type: "CUSTO DE AQUISIÇÃO", description: "Investimento, campanhas, alcance, cliques e conversões atribuídas. Custos ficam separados de faturamento.", sources: ["Meta Ads", "Google Ads · fase posterior"], metric: "Gasto · CPC · CPM · CPA · ROAS" },
  { id: "02", name: "Vendas próprias", type: "RECEITA DE OPERAÇÃO", description: "Pedidos, pagamentos, taxas, frete, cancelamentos e margem de produtos vendidos pela própria SMKON.", sources: ["Mercado Livre · OAuth/API", "TikTok Shop · integração"], metric: "Pedidos · receita líquida · margem" },
  { id: "03", name: "Afiliados e comissões", type: "RECEITA DE PARCERIA", description: "Cliques rastreados, conversões atribuídas, comissão prevista, aprovada e efetivamente recebida.", sources: ["Amazon Associados", "TikTok Shop · afiliados"], metric: "Cliques · conversão · comissão · EPC" }
];
const controls = [
  "Cada origem mantém seus próprios identificadores e regras de atribuição.",
  "Receita bruta, taxas, custos, comissão prevista e comissão recebida não serão somadas como se fossem a mesma coisa.",
  "Eventos importados terão chave de idempotência para evitar duplicidade.",
  "Dados de integração só serão considerados ativos após OAuth, permissões e sincronização serem testados."
];

export default function Home() {
  return (
    <main className="shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="SMKON início"><span className="brand-mark">S</span><span>SMKON</span></Link>
        <span className="environment"><i /> CONTROL CENTER / SPLIT 01</span>
      </header>
      <section className="hero">
        <p className="eyebrow">CONTROL CENTER · REVENUE ARCHITECTURE</p>
        <h1>Três operações.<br /><span>Uma visão central.</span></h1>
        <p className="intro">A operação SMKON agora está organizada em três frentes independentes. Cada uma tem seus próprios eventos, indicadores e regras financeiras; o painel consolida os resultados sem misturar conceitos.</p>
        <div className="hero-meta"><span>SPRINT 1 · MODELAGEM INICIAL</span><span>v0.2.0</span></div>
      </section>
      <section className="section-heading">
        <div><p className="eyebrow">OPERATIONAL SPLIT / 01</p><h2>Frentes de operação</h2></div>
        <span className="status">03 DOMÍNIOS SEPARADOS</span>
      </section>
      <section className="streams" aria-label="Frentes de operação">
        {streams.map((stream) => (
          <article className="stream" key={stream.id}>
            <div className="stream-top"><span className="module-number">{stream.id}</span><span className="stream-type">{stream.type}</span></div>
            <h3>{stream.name}</h3>
            <p className="stream-description">{stream.description}</p>
            <div className="stream-sources"><span className="field-label">FONTES PLANEJADAS</span><div className="source-list">{stream.sources.map((source) => <span className="source-chip" key={source}>{source}</span>)}</div></div>
            <div className="stream-bottom"><span>{stream.metric}</span><span className="module-state">ESTRUTURA DEFINIDA</span></div>
          </article>
        ))}
      </section>
      <section className="section-heading integration-heading">
        <div><p className="eyebrow">DATA GOVERNANCE</p><h2>Regras de separação</h2></div>
        <span className="status">SEM DADOS FICTÍCIOS</span>
      </section>
      <section className="controls">
        {controls.map((control, index) => <div className="control-row" key={control}><span>{String(index + 1).padStart(2, "0")}</span><p>{control}</p></div>)}
      </section>
      <section className="integration-note">
        <span className="eyebrow">INTEGRAÇÕES</span>
        <p>Este split é a estrutura funcional inicial. Meta Ads, Amazon Associados, Mercado Livre e TikTok Shop ainda precisam de credenciais, permissões e testes específicos antes de qualquer dado ser marcado como sincronizado. Nenhuma campanha, compra ou gasto foi autorizado.</p>
      </section>
      <footer><span>SMKON © {new Date().getFullYear()}</span><span>UTILITY FIRST · EVIDENCE ALWAYS</span></footer>
    </main>
  );
}
