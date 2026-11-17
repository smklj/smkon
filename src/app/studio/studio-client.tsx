"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Channel = "YouTube" | "Instagram" | "TikTok";
type Draft = {
  id: string;
  title: string;
  product: string;
  sourceUrl: string;
  assetUrl: string;
  script: string;
  caption: string;
  cta: string;
  hashtags: string;
  channels: Channel[];
  rightsConfirmed: boolean;
  status: "Rascunho" | "Aprovado";
  updatedAt: string;
};

const STORAGE_KEY = "smkon-content-studio-v1";
const CHANNELS: Channel[] = ["YouTube", "Instagram", "TikTok"];
const emptyDraft = (): Draft => ({
  id: "", title: "", product: "", sourceUrl: "", assetUrl: "", script: "",
  caption: "", cta: "", hashtags: "", channels: ["YouTube", "Instagram", "TikTok"],
  rightsConfirmed: false, status: "Rascunho", updatedAt: new Date().toISOString(),
});

export default function StudioClient() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [activeId, setActiveId] = useState("");
  const [filter, setFilter] = useState<"Todos" | "Rascunho" | "Aprovado">("Todos");
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // Hydrate browser-only drafts after mount to keep the server/client HTML identical.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setDrafts(JSON.parse(stored) as Draft[]);
    } catch {
      setNotice("Não foi possível ler os rascunhos salvos neste navegador.");
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  }, [drafts, loaded]);

  const visibleDrafts = useMemo(
    () => drafts.filter((item) => filter === "Todos" || item.status === filter)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [drafts, filter],
  );

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleChannel(channel: Channel) {
    setDraft((current) => ({
      ...current,
      channels: current.channels.includes(channel)
        ? current.channels.filter((item) => item !== channel)
        : [...current.channels, channel],
    }));
  }

  function save(status: Draft["status"] = "Rascunho") {
    if (!draft.title.trim()) {
      setNotice("Informe um título para salvar o conteúdo.");
      return;
    }
    if (draft.channels.length === 0) {
      setNotice("Selecione ao menos um canal de destino.");
      return;
    }
    if (draft.sourceUrl.trim() && !draft.rightsConfirmed) {
      setNotice("Confirme que você tem autorização para usar o vídeo de referência.");
      return;
    }
    const saved: Draft = {
      ...draft,
      id: draft.id || crypto.randomUUID(),
      status,
      updatedAt: new Date().toISOString(),
    };
    setDrafts((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    setDraft(saved);
    setActiveId(saved.id);
    setNotice(status === "Aprovado"
      ? "Conteúdo marcado como aprovado neste navegador. Nenhuma publicação foi enviada."
      : "Rascunho salvo neste navegador.");
  }

  function openDraft(item: Draft) {
    setDraft(item);
    setActiveId(item.id);
    setNotice("");
  }

  function newDraft() {
    setDraft(emptyDraft());
    setActiveId("");
    setNotice("");
  }

  function removeDraft(id: string) {
    setDrafts((current) => current.filter((item) => item.id !== id));
    if (activeId === id) newDraft();
    setNotice("Rascunho removido deste navegador.");
  }

  async function copyText(value: string) {
    if (!value.trim()) {
      setNotice("Não há texto para copiar.");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Texto copiado.");
    } catch {
      setNotice("O navegador bloqueou a cópia automática. Selecione o texto e copie manualmente.");
    }
  }

  const fullCaption = [draft.caption, draft.cta, draft.hashtags].filter(Boolean).join("\n\n");

  return (
    <main className="studio-shell">
      <header className="studio-topbar">
        <Link className="brand" href="/"><span className="brand-mark">S</span><span>SMKON</span></Link>
        <nav><Link href="/">Control Center</Link><span className="studio-nav-active">Content Studio</span></nav>
        <span className="studio-local-tag"><i /> WORKSPACE LOCAL</span>
      </header>

      <section className="studio-hero">
        <p className="eyebrow">CONTENT & GROWTH / WORKSPACE 01</p>
        <div className="studio-hero-line">
          <div><h1>Content Studio<span>.</span></h1><p>Crie uma peça central e organize sua adaptação para YouTube, Instagram e TikTok.</p></div>
          <button className="studio-primary" onClick={newDraft}>＋ Novo conteúdo</button>
        </div>
        <div className="studio-notice"><strong>Modo de trabalho:</strong> os rascunhos ficam salvos somente neste navegador. Aprovar aqui não publica nem envia conteúdo às plataformas.</div>
      </section>

      <section className="studio-stats">
        <div><span>PEÇAS NO WORKSPACE</span><strong>{drafts.length.toString().padStart(2, "0")}</strong></div>
        <div><span>RASCUNHOS</span><strong>{drafts.filter((item) => item.status === "Rascunho").length.toString().padStart(2, "0")}</strong></div>
        <div><span>APROVADOS</span><strong>{drafts.filter((item) => item.status === "Aprovado").length.toString().padStart(2, "0")}</strong></div>
        <div><span>CANAIS</span><strong>03</strong></div>
      </section>

      <div className="studio-layout">
        <aside className="studio-library">
          <div className="studio-library-head"><div><p className="eyebrow">LIBRARY</p><h2>Suas peças</h2></div><span>{drafts.length}</span></div>
          <div className="studio-filters">
            {(["Todos", "Rascunho", "Aprovado"] as const).map((item) => <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item}</button>)}
          </div>
          <div className="studio-draft-list">
            {visibleDrafts.length === 0 && <div className="studio-empty"><span>✳</span><strong>Nenhuma peça por aqui</strong><p>Crie seu primeiro conteúdo para começar a organizar a produção.</p></div>}
            {visibleDrafts.map((item) => <button key={item.id} className={activeId === item.id ? "studio-draft active" : "studio-draft"} onClick={() => openDraft(item)}>
              <span className="draft-status">{item.status}</span><strong>{item.title}</strong><small>{item.product || "Produto não informado"}</small><span className="draft-channels">{item.channels.join(" · ")}</span>
            </button>)}
          </div>
        </aside>

        <section className="studio-editor">
          <div className="studio-editor-head"><div><p className="eyebrow">PRODUCTION DESK</p><h2>{activeId ? "Editar conteúdo" : "Nova peça de conteúdo"}</h2></div><span className="studio-step">01 / 03 · BRIEFING</span></div>
          <div className="studio-form-grid">
            <label className="studio-field studio-wide"><span>TÍTULO INTERNO *</span><input value={draft.title} onChange={(e) => update("title", e.target.value)} placeholder="Ex.: Review honesta — produto X" /></label>
            <label className="studio-field"><span>PRODUTO / OFERTA</span><input value={draft.product} onChange={(e) => update("product", e.target.value)} placeholder="Nome do produto" /></label>
            <label className="studio-field"><span>LINK DO PRODUTO</span><input value={draft.assetUrl} onChange={(e) => update("assetUrl", e.target.value)} placeholder="https://..." /></label>
            <label className="studio-field studio-wide"><span>VÍDEO DE REFERÊNCIA / UGC</span><input value={draft.sourceUrl} onChange={(e) => update("sourceUrl", e.target.value)} placeholder="URL do vídeo original ou referência (opcional)" /></label>
            {draft.sourceUrl && <label className="studio-rights studio-wide"><input type="checkbox" checked={draft.rightsConfirmed} onChange={(e) => update("rightsConfirmed", e.target.checked)} /><span>Confirmo que tenho autorização/licença para reutilizar ou adaptar este vídeo. Dar crédito, isoladamente, não substitui autorização.</span></label>}
            <div className="studio-field studio-wide"><span>CANAIS DE DESTINO</span><div className="studio-channel-picks">{CHANNELS.map((channel) => <button type="button" key={channel} className={draft.channels.includes(channel) ? "picked" : ""} onClick={() => toggleChannel(channel)}><i />{channel}</button>)}</div></div>
            <label className="studio-field studio-wide"><span>ROTEIRO / ESTRUTURA DO VÍDEO</span><textarea rows={6} value={draft.script} onChange={(e) => update("script", e.target.value)} placeholder={"HOOK (0–3s)\nDESENVOLVIMENTO\nDEMONSTRAÇÃO / PROVA\nFECHAMENTO"} /></label>
            <label className="studio-field studio-wide"><span>LEGENDA</span><textarea rows={4} value={draft.caption} onChange={(e) => update("caption", e.target.value)} placeholder="Escreva a legenda adaptada aos canais selecionados..." /></label>
            <label className="studio-field"><span>CTA</span><input value={draft.cta} onChange={(e) => update("cta", e.target.value)} placeholder="Ex.: Confira no link..." /></label>
            <label className="studio-field"><span>HASHTAGS</span><input value={draft.hashtags} onChange={(e) => update("hashtags", e.target.value)} placeholder="#smkon #review" /></label>
          </div>
          <div className="studio-editor-actions"><button className="studio-secondary" onClick={() => save("Rascunho")}>Salvar rascunho</button><button className="studio-primary" onClick={() => save("Aprovado")}>Marcar como aprovado ↗</button></div>
          {notice && <p className="studio-feedback" role="status">{notice}</p>}
          {activeId && <button className="studio-delete" onClick={() => removeDraft(activeId)}>Excluir esta peça</button>}
        </section>
      </div>

      <section className="studio-preview">
        <div className="studio-editor-head"><div><p className="eyebrow">CHANNEL ADAPTATION</p><h2>Prévia de publicação</h2></div><span className="studio-step">02 / 03 · REVISÃO</span></div>
        <div className="studio-preview-grid">
          {draft.channels.map((channel) => <article key={channel}><div className="preview-channel"><span>{channel}</span><small>{channel === "YouTube" ? "SHORTS / VÍDEO" : channel === "Instagram" ? "REELS / FEED" : "VÍDEO CURTO"}</small></div><h3>{draft.title || "Título do conteúdo"}</h3><p>{fullCaption || "A legenda, o CTA e as hashtags aparecerão aqui conforme você preencher o briefing."}</p><button onClick={() => copyText(fullCaption)}>Copiar legenda</button></article>)}
          {draft.channels.length === 0 && <p className="studio-muted">Selecione um canal para visualizar a adaptação.</p>}
        </div>
      </section>

      <section className="studio-next">
        <div><p className="eyebrow">NEXT MILESTONES</p><h2>Da pauta à publicação</h2></div>
        <div className="studio-pipeline"><div className="done"><span>01</span><strong>Briefing e roteiro</strong><small>Disponível neste workspace</small></div><div><span>02</span><strong>Edição de vídeo</strong><small>Próxima etapa: timeline, cortes, legendas e exportação</small></div><div><span>03</span><strong>Distribuição conectada</strong><small>OAuth, upload e publicação via APIs oficiais</small></div></div>
      </section>
      <footer><span>SMKON © {new Date().getFullYear()}</span><span>NO AUTO-PUBLISH · HUMAN APPROVAL FIRST</span></footer>
    </main>
  );
}
