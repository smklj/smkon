import Link from "next/link";

const areas = [
  { id: "01", name: "Estratégia e gestão", type: "DIREÇÃO", description: "Metas, prioridades, roadmap, indicadores executivos e decisões do Owner.", scope: ["OKRs", "Roadmap", "Decisões"], state: "BASE A DEFINIR" },
  { id: "02", name: "Inteligência de produtos", type: "PESQUISA", description: "Descoberta, comparação e avaliação de produtos, ofertas, vendedores, preço e potencial de conteúdo.", scope: ["Catálogo", "Ofertas", "Scoring"], state: "EM MODELAGEM" },
  { id: "03", name: "Conteúdo e distribuição", type: "MÍDIA PRÓPRIA", description: "Pautas, roteiros, ativos, direitos, versões, aprovação, calendário e publicação permitida.", scope: ["Conteúdo", "Direitos", "Canais"], state: "EM MODELAGEM" },
  { id: "04", name: "IA e agentes", type: "AUTOMAÇÃO CONTROLADA", description: "Agentes, tarefas, ferramentas allowlist, execução verificável, limites, logs e aprovação humana.", scope: ["Planner", "Executor", "Verifier"], state: "EM MODELAGEM" },
  { id: "05", name: "Financeiro", type: "CONTROLE FINANCEIRO", description: "Conciliação, ledger, custos, receita, comissões, caixa e relatórios por domínio e consolidados.", scope: ["Ledger", "Conciliação", "Relatórios"], state: "3 DOMÍNIOS DEFINIDOS" },
  { id: "06", name: "Jurídico e conformidade", type: "GOVERNANÇA", description: "Regras de plataforma, contratos, direitos de uso, disclosure, privacidade e obrigações fiscais.", scope: ["Licenças", "Disclosure", "Políticas"], state: "REQUISITOS MAPEADOS" },
  { id: "07", name: "Audiência e relacionamento", type: "CRESCIMENTO ORGÂNICO", description: "Comunidade, relacionamento, feedback, atendimento, parcerias e análise de audiência.", scope: ["Audiência", "Feedback", "CRM"], state: "EM MODELAGEM" },
  { id: "08", name: "Segurança e infraestrutura", type: "PLATAFORMA", description: "Identidade, permissões, RLS, integrações, segredos, observabilidade, backup e kill switch.", scope: ["Supabase", "Vercel", "RLS"], state: "FUNDAÇÃO INICIAL" }
];
const revenueDomains = [
  { id: "R1", name: "Mídia e anúncios", type: "CUSTO DE AQUISIÇÃO", description: "Investimento e desempenho de campanhas. Gasto é custo, não receita.", sources: ["Meta Ads", "Google Ads", "GA4"], metric: "Spend · CPC · CPM · CPA · ROAS" },
  { id: "R2", name: "Vendas próprias", type: "RECEITA DE OPERAÇÃO", description: "Pedidos em que a SMKON é a vendedora, com taxas, frete, reembolsos e liquidação.", sources: ["Mercado Livre", "TikTok Shop Seller", "Shopify"], metric: "Pedidos · líquido · margem" },
  { id: "R3", name: "Afiliados e comissões", type: "RECEITA DE PARCERIA", description: "Cliques, conversões atribuídas e comissões pendentes, aprovadas, revertidas e pagas.", sources: ["Shopee", "Amazon Associados", "TikTok Shop Affiliate"], metric: "Cliques · conversão · comissão · EPC" }
];
const connectionStatus = [
  { name: "GitHub", detail: "Repositório privado e branch de trabalho conectados; PR aberto.", state: "CONECTADO" },
  { name: "Vercel", detail: "Projeto SMKON criado; deployment está READY, sem alias e sem vínculo Git.", state: "DEPLOY READY" },
  { name: "Supabase", detail: "Projeto ativo; schema público ainda sem tabelas. Nenhuma migration aplicada.", state: "PENDENTE" },
  { name: "Metricool", detail: "Perfis registrados; publicação ainda não validada por teste funcional.", state: "PARCIAL" },
  { name: "Supermetrics", detail: "Instagram Insights, TikTok Organic e Pinterest autenticados; YouTube precisa validação final. Meta Ads e Amazon Ads não autenticados.", state: "PARCIAL" }
];
const controls = [
  "As oito áreas são módulos operacionais; não representam oito fontes de receita.",
  "Os três domínios financeiros ficam dentro da área Financeiro e mantêm natureza contábil independente.",
  "Nenhuma integração recebe status conectado sem autenticação, escopos, leitura de dados e teste funcional.",
  "Eventos importados terão chave de idempotência, origem, timestamp e trilha de auditoria.",
  "Gastos, campanhas, pagamentos, assinaturas e publicação externa permanecem bloqueados sem autorização explícita."
];
export default function Home() {
  return (
    <main className="shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="SMKON início"><span className="brand-mark">S</span><span>SMKON</span></Link>
        <span className="environment"><i /> CONTROL CENTER / 8 ÁREAS</span>
      </header>
      <section className="hero">
        <p className="eyebrow">SMKON · OPERATING SYSTEM</p>
        <h1>Oito áreas.<br /><span>Uma operação integrada.</span></h1>
        <p className="intro">O Control Center organiza a SMKON em oito áreas operacionais. Dentro do Financeiro, três domínios separam custos de mídia, vendas próprias e comissões — sem misturar receita, custo e caixa.</p>
        <div className="hero-meta"><span>ARQUITETURA · VERSÃO 0.3</span><span>8 ÁREAS / 3 DOMÍNIOS FINANCEIROS</span></div>
      </section>
      <section className="section-heading">
        <div><p className="eyebrow">OPERATING MODEL / 01—08</p><h2>Áreas principais</h2></div>
        <span className="status">08 MÓDULOS</span>
      </section>
      <section className="area-grid" aria-label="Oito áreas operacionais">
        {areas.map((area) => (
          <article className="area-card" key={area.id}>
            <div className="stream-top"><span className="module-number">{area.id}</span><span className="stream-type">{area.type}</span></div>
            <h3>{area.name}</h3>
            <p className="stream-description">{area.description}</p>
            <div className="source-list">{area.scope.map((item) => <span className="source-chip" key={item}>{item}</span>)}</div>
            <div className="stream-bottom"><span className="module-state">{area.state}</span></div>
          </article>
        ))}
      </section>
      <section className="section-heading integration-heading">
        <div><p className="eyebrow">AREA 05 · FINANCE</p><h2>Três domínios financeiros</h2></div>
        <span className="status">CUSTO / VENDA / COMISSÃO</span>
      </section>
      <section className="streams" aria-label="Domínios financeiros">
        {revenueDomains.map((domain) => (
          <article className="stream" key={domain.id}>
            <div className="stream-top"><span className="module-number">{domain.id}</span><span className="stream-type">{domain.type}</span></div>
            <h3>{domain.name}</h3>
            <p className="stream-description">{domain.description}</p>
            <div className="stream-sources"><span className="field-label">FONTES PLANEJADAS</span><div className="source-list">{domain.sources.map((source) => <span className="source-chip" key={source}>{source}</span>)}</div></div>
            <div className="stream-bottom"><span>{domain.metric}</span><span className="module-state">MODELAGEM INICIAL</span></div>
          </article>
        ))}
      </section>
      <section className="section-heading integration-heading">
        <div><p className="eyebrow">PLATFORM CONNECTIVITY</p><h2>Estado das conexões</h2></div>
        <span className="status">STATUS VALIDADO</span>
      </section>
      <section className="connections">
        {connectionStatus.map((item) => <div className="connection-row" key={item.name}><div><h3>{item.name}</h3><p>{item.detail}</p></div><span className="module-state">{item.state}</span></div>)}
      </section>
      <section className="section-heading integration-heading">
        <div><p className="eyebrow">DATA GOVERNANCE</p><h2>Regras de operação</h2></div>
        <span className="status">SEM DADOS FICTÍCIOS</span>
      </section>
      <section className="controls">
        {controls.map((control, index) => <div className="control-row" key={control}><span>{String(index + 1).padStart(2, "0")}</span><p>{control}</p></div>)}
      </section>
      <footer><span>SMKON © {new Date().getFullYear()}</span><span>UTILITY FIRST · EVIDENCE ALWAYS</span></footer>
    </main>
  );
}
