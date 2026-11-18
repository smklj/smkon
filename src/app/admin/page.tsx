"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

type ContentItem = {
  id: string;
  title: string;
  product: string;
  status: string;
  channels: string[];
  updated_at: string;
};

export default function AdminDashboard() {
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadContents() {
      try {
        const res = await fetch("/api/content");
        if (res.status === 401) {
          setError("Autenticação necessária para listar conteúdos. Faça login para visualizar.");
          setContents([]);
          return;
        }
        if (!res.ok) throw new Error("Falha ao carregar conteúdos.");
        const data = await res.json();
        setContents(data.items || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar conteúdos.");
      } finally {
        setLoading(false);
      }
    }
    loadContents();
  }, []);

  return (
    <main className="shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="SMKON início">
          <span className="brand-mark">S</span>
          <span>SMKON</span>
        </Link>
        <nav className="home-nav" style={{ display: "flex", gap: "24px", alignItems: "center" }}>
          <Link href="/">Control Center</Link>
          <Link href="/studio">Content Studio</Link>
          <Link href="/admin" style={{ color: "var(--blue-soft)" }}>Admin Dashboard</Link>
          <span className="environment"><i /> ADMIN / LEITURA</span>
        </nav>
      </header>

      <section className="hero" style={{ padding: "64px 0 48px" }}>
        <p className="eyebrow">ADMIN DASHBOARD · SOMENTE LEITURA</p>
        <h1>Visão operacional.<br /><span>8 áreas · 3 domínios.</span></h1>
        <p className="intro">Dashboard consolidado das áreas operacionais, domínios financeiros e listagem de conteúdos. Placeholders claros para integrações futuras. Nenhum dado é publicado ou alterado.</p>
        <div className="hero-meta">
          <span>MODO LEITURA</span>
          <span>SEM MERGE · SEM DEPLOY · SEM PUBLICAÇÃO</span>
        </div>
      </section>

      <section className="section-heading">
        <div><p className="eyebrow">OPERATING MODEL / 01—08</p><h2>Áreas principais</h2></div>
        <span className="status">08 MÓDULOS · LEITURA</span>
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
            <div className="stream-sources">
              <span className="field-label">FONTES PLANEJADAS</span>
              <div className="source-list">{domain.sources.map((source) => <span className="source-chip" key={source}>{source}</span>)}</div>
            </div>
            <div className="stream-bottom"><span>{domain.metric}</span><span className="module-state">MODELAGEM INICIAL</span></div>
          </article>
        ))}
      </section>

      <section className="section-heading integration-heading">
        <div><p className="eyebrow">CONTENT / API</p><h2>Listagem de conteúdos</h2></div>
        <span className="status">VIA /api/content</span>
      </section>
      <section className="connections" style={{ marginBottom: "48px" }}>
        {loading && <div className="connection-row"><div><h3>Carregando...</h3><p>Consultando API de conteúdos.</p></div></div>}
        {error && (
          <div className="connection-row">
            <div>
              <h3>Conteúdos indisponíveis</h3>
              <p>{error}</p>
            </div>
            <span className="module-state">AUTH REQUERIDA</span>
          </div>
        )}
        {!loading && !error && contents.length === 0 && (
          <div className="connection-row">
            <div><h3>Nenhum conteúdo</h3><p>Nenhum item encontrado na API. Crie no Content Studio após autenticação.</p></div>
            <span className="module-state">VAZIO</span>
          </div>
        )}
        {!loading && !error && contents.map((item) => (
          <div className="connection-row" key={item.id}>
            <div>
              <h3>{item.title}</h3>
              <p>{item.product || "Sem produto"} · {item.channels?.join(", ") || "Sem canais"} · Atualizado {new Date(item.updated_at).toLocaleDateString("pt-BR")}</p>
            </div>
            <span className="module-state">{item.status?.toUpperCase()}</span>
          </div>
        ))}
      </section>

      <section className="section-heading integration-heading">
        <div><p className="eyebrow">INTEGRAÇÕES FUTURAS</p><h2>Placeholders claros</h2></div>
        <span className="status">NÃO CONECTADO</span>
      </section>
      <section className="connections">
        <div className="connection-row">
          <div>
            <h3>Metricool</h3>
            <p>Placeholder — publicação e analytics. Ainda não validado. Nenhum conteúdo será publicado daqui.</p>
          </div>
          <span className="module-state">PLACEHOLDER</span>
        </div>
        <div className="connection-row">
          <div>
            <h3>Instagram</h3>
            <p>Placeholder — métricas orgânicas e insights via Supermetrics. Autenticação parcial; leitura não operacional.</p>
          </div>
          <span className="module-state">PLACEHOLDER</span>
        </div>
        <div className="connection-row">
          <div>
            <h3>TikTok</h3>
            <p>Placeholder — TikTok Organic e Shop. Escopos não totalmente validados. Sem publicação.</p>
          </div>
          <span className="module-state">PLACEHOLDER</span>
        </div>
      </section>

      <footer style={{ marginTop: "48px" }}>
        <span>SMKON © {new Date().getFullYear()} · Admin Dashboard MVP</span>
        <span>LEITURA APENAS · SEM AÇÕES EXTERNAS</span>
      </footer>
    </main>
  );
}
