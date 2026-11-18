"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CHANNELS,
  ContentItem,
  ContentItemRow,
  ContentStatusLabel,
  LEGACY_STORAGE_KEY,
  LegacyDraft,
  emptyItem,
  itemToPayload,
  migrationKey,
  rowToItem,
} from "@/lib/content/types";

type Filter = "Todos" | ContentStatusLabel;

const FILTERS: Filter[] = ["Todos", "Rascunho", "Aprovado", "Arquivado"];

export default function StudioClient() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [draft, setDraft] = useState<ContentItem>(emptyItem);
  const [activeId, setActiveId] = useState("");
  const [filter, setFilter] = useState<Filter>("Todos");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadItems = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/content");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Falha ao carregar conteúdos.");
      const mapped = (body.items ?? []).map(rowToItem);
      setItems(mapped);
      return mapped;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível carregar os conteúdos.";
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const migrateLegacy = useCallback(async (serverItems: ContentItem[]) => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return;
      const legacy = JSON.parse(raw) as LegacyDraft[];
      if (!Array.isArray(legacy) || legacy.length === 0) {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return;
      }

      const existingKeys = new Set(serverItems.map((item) => migrationKey(item)));
      const toMigrate = legacy.filter((item) => {
        if (!item.title?.trim()) return false;
        return !existingKeys.has(migrationKey(item));
      });

      if (toMigrate.length === 0) {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return;
      }

      let migrated = 0;
      for (const item of toMigrate) {
        const payload = {
          title: item.title,
          product: item.product ?? "",
          sourceUrl: item.sourceUrl ?? "",
          assetUrl: item.assetUrl ?? "",
          script: item.script ?? "",
          caption: item.caption ?? "",
          cta: item.cta ?? "",
          hashtags: item.hashtags ?? "",
          channels: item.channels ?? [...CHANNELS],
          rightsConfirmed: item.rightsConfirmed === true,
          // Rascunhos locais nunca entram como aprovados: aprovação exige revisão no workspace.
          status: "draft",
        };
        const res = await fetch("/api/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) migrated += 1;
      }

      localStorage.removeItem(LEGACY_STORAGE_KEY);
      if (migrated > 0) {
        setNotice(`${migrated} rascunho(s) migrado(s) do navegador para o workspace.`);
        await loadItems();
      }
    } catch {
      // Migration is optional; keep local data if it fails.
    }
  }, [loadItems]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const serverItems = await loadItems();
      if (cancelled) return;
      await migrateLegacy(serverItems);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadItems, migrateLegacy]);

  const visibleItems = useMemo(
    () =>
      items
        .filter((item) => filter === "Todos" || item.status === filter)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [items, filter],
  );

  function update<K extends keyof ContentItem>(key: K, value: ContentItem[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleChannel(channel: (typeof CHANNELS)[number]) {
    setDraft((current) => ({
      ...current,
      channels: current.channels.includes(channel)
        ? current.channels.filter((item) => item !== channel)
        : [...current.channels, channel],
    }));
  }

  function validateDraft(): boolean {
    if (!draft.title.trim()) {
      setError("Informe um título para salvar o conteúdo.");
      return false;
    }
    if (draft.channels.length === 0) {
      setError("Selecione ao menos um canal de destino.");
      return false;
    }
    if (draft.sourceUrl.trim() && !draft.rightsConfirmed) {
      setError("Confirme que você tem autorização para usar o vídeo de referência.");
      return false;
    }
    return true;
  }

  /** Grava a versão atual. O banco calcula versão e hash e devolve o item persistido. */
  async function persist(status: "draft" | "archived"): Promise<ContentItem> {
    const isUpdate = Boolean(draft.id);
    const res = await fetch("/api/content", {
      method: isUpdate ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(itemToPayload(draft, status)),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Não foi possível salvar.");
    return rowToItem(body.item as ContentItemRow);
  }

  function applySaved(item: ContentItem) {
    setActiveId(item.id);
    setDraft(item);
  }

  async function save(status: "draft" | "archived" = "draft") {
    if (!validateDraft()) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const item = await persist(status);
      applySaved(item);
      setNotice(status === "archived" ? "Conteúdo arquivado." : `Rascunho salvo no workspace (versão ${item.version}).`);
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o conteúdo.");
    } finally {
      setSaving(false);
    }
  }

  /**
   * Aprova exatamente o que está na tela: grava a versão atual e envia o hash
   * devolvido pelo banco. Se o conteúdo mudar no meio do caminho, o banco recusa.
   */
  async function approve() {
    if (!validateDraft()) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = await persist("draft");
      const res = await fetch("/api/content/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: saved.id, contentHash: saved.contentHash }),
      });
      const body = await res.json();
      if (!res.ok) {
        applySaved(saved);
        throw new Error(body.error || "Não foi possível aprovar.");
      }
      const approved = rowToItem(body.item as ContentItemRow);
      applySaved(approved);
      setNotice(`Versão ${approved.approvedVersion} aprovada. Nenhuma publicação foi enviada.`);
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível aprovar o conteúdo.");
    } finally {
      setSaving(false);
    }
  }

  function openItem(item: ContentItem) {
    setDraft(item);
    setActiveId(item.id);
    setError("");
    setNotice("");
  }

  function newDraft() {
    setDraft(emptyItem());
    setActiveId("");
    setError("");
    setNotice("");
  }

  async function removeDraft(id: string) {
    if (!id) return;
    if (!window.confirm("Excluir esta peça? Conteúdos com aprovação registrada só podem ser arquivados.")) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/content?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Não foi possível excluir.");
      setNotice("Peça removida do workspace.");
      if (activeId === id) newDraft();
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir a peça.");
    } finally {
      setSaving(false);
    }
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
        <span className="studio-local-tag"><i /> WORKSPACE</span>
      </header>

      <section className="studio-hero">
        <p className="eyebrow">CONTENT & GROWTH / WORKSPACE 01</p>
        <div className="studio-hero-line">
          <div><h1>Content Studio<span>.</span></h1><p>Crie uma peça central e organize sua adaptação para YouTube, Instagram e TikTok.</p></div>
          <button className="studio-primary" onClick={newDraft} disabled={saving}>＋ Novo conteúdo</button>
        </div>
        <div className="studio-notice">
          <strong>Modo de trabalho:</strong> os rascunhos são salvos no workspace autenticado. Aprovar aqui não publica nem envia conteúdo às plataformas.
        </div>
      </section>

      {error && <p className="studio-feedback" role="alert">{error}</p>}
      {notice && <p className="studio-feedback" role="status">{notice}</p>}

      <section className="studio-stats">
        <div><span>PEÇAS NO WORKSPACE</span><strong>{loading ? "…" : items.length.toString().padStart(2, "0")}</strong></div>
        <div><span>RASCUNHOS</span><strong>{loading ? "…" : items.filter((item) => item.status === "Rascunho").length.toString().padStart(2, "0")}</strong></div>
        <div><span>APROVADOS</span><strong>{loading ? "…" : items.filter((item) => item.status === "Aprovado").length.toString().padStart(2, "0")}</strong></div>
        <div><span>ARQUIVADOS</span><strong>{loading ? "…" : items.filter((item) => item.status === "Arquivado").length.toString().padStart(2, "0")}</strong></div>
      </section>

      <div className="studio-layout">
        <aside className="studio-library">
          <div className="studio-library-head"><div><p className="eyebrow">LIBRARY</p><h2>Suas peças</h2></div><span>{loading ? "…" : items.length}</span></div>
          <div className="studio-filters">
            {FILTERS.map((item) => (
              <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item}</button>
            ))}
          </div>
          <div className="studio-draft-list">
            {loading && <div className="studio-empty"><span>✳</span><strong>Carregando…</strong><p>Buscando peças do workspace.</p></div>}
            {!loading && visibleItems.length === 0 && <div className="studio-empty"><span>✳</span><strong>Nenhuma peça por aqui</strong><p>Crie seu primeiro conteúdo para começar a organizar a produção.</p></div>}
            {!loading && visibleItems.map((item) => (
              <button key={item.id} className={activeId === item.id ? "studio-draft active" : "studio-draft"} onClick={() => openItem(item)}>
                <span className="draft-status">{item.status === "Aprovado" && item.approvedVersion ? `Aprovado · v${item.approvedVersion}` : `${item.status} · v${item.version}`}</span>
                <strong>{item.title}</strong>
                <small>{item.product || "Produto não informado"}</small>
                <span className="draft-channels">{item.channels.join(" · ")}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="studio-editor">
          <div className="studio-editor-head">
            <div><p className="eyebrow">PRODUCTION DESK</p><h2>{activeId ? "Editar conteúdo" : "Nova peça de conteúdo"}</h2></div>
            <span className="studio-step">01 / 03 · BRIEFING</span>
          </div>
          {activeId && draft.status === "Aprovado" && (
            <p className="studio-feedback" role="status">
              Versão {draft.approvedVersion} aprovada. Qualquer alteração cria uma nova versão e exige nova aprovação.
            </p>
          )}
          <div className="studio-form-grid">
            <label className="studio-field studio-wide"><span>TÍTULO INTERNO *</span><input value={draft.title} onChange={(e) => update("title", e.target.value)} placeholder="Ex.: Review honesta — produto X" disabled={saving} /></label>
            <label className="studio-field"><span>PRODUTO / OFERTA</span><input value={draft.product} onChange={(e) => update("product", e.target.value)} placeholder="Nome do produto" disabled={saving} /></label>
            <label className="studio-field"><span>LINK DO PRODUTO</span><input value={draft.assetUrl} onChange={(e) => update("assetUrl", e.target.value)} placeholder="https://..." disabled={saving} /></label>
            <label className="studio-field studio-wide"><span>VÍDEO DE REFERÊNCIA / UGC</span><input value={draft.sourceUrl} onChange={(e) => update("sourceUrl", e.target.value)} placeholder="URL do vídeo original ou referência (opcional)" disabled={saving} /></label>
            {draft.sourceUrl && (
              <label className="studio-rights studio-wide">
                <input type="checkbox" checked={draft.rightsConfirmed} onChange={(e) => update("rightsConfirmed", e.target.checked)} disabled={saving} />
                <span>Confirmo que tenho autorização/licença para reutilizar ou adaptar este vídeo. Dar crédito, isoladamente, não substitui autorização.</span>
              </label>
            )}
            <div className="studio-field studio-wide">
              <span>CANAIS DE DESTINO</span>
              <div className="studio-channel-picks">
                {CHANNELS.map((channel) => (
                  <button type="button" key={channel} className={draft.channels.includes(channel) ? "picked" : ""} onClick={() => toggleChannel(channel)} disabled={saving}>
                    <i />{channel}
                  </button>
                ))}
              </div>
            </div>
            <label className="studio-field studio-wide"><span>ROTEIRO / ESTRUTURA DO VÍDEO</span><textarea rows={6} value={draft.script} onChange={(e) => update("script", e.target.value)} placeholder={"HOOK (0–3s)\nDESENVOLVIMENTO\nDEMONSTRAÇÃO / PROVA\nFECHAMENTO"} disabled={saving} /></label>
            <label className="studio-field studio-wide"><span>LEGENDA</span><textarea rows={4} value={draft.caption} onChange={(e) => update("caption", e.target.value)} placeholder="Escreva a legenda adaptada aos canais selecionados..." disabled={saving} /></label>
            <label className="studio-field"><span>CTA</span><input value={draft.cta} onChange={(e) => update("cta", e.target.value)} placeholder="Ex.: Confira no link..." disabled={saving} /></label>
            <label className="studio-field"><span>HASHTAGS</span><input value={draft.hashtags} onChange={(e) => update("hashtags", e.target.value)} placeholder="#smkon #review" disabled={saving} /></label>
          </div>
          <div className="studio-editor-actions">
            <button className="studio-secondary" onClick={() => save("draft")} disabled={saving}>{saving ? "Salvando…" : "Salvar rascunho"}</button>
            <button className="studio-primary" onClick={approve} disabled={saving}>{saving ? "Salvando…" : "Aprovar esta versão ↗"}</button>
            {activeId && <button className="studio-secondary" onClick={() => save("archived")} disabled={saving}>Arquivar</button>}
          </div>
          {activeId && <button className="studio-delete" onClick={() => removeDraft(activeId)} disabled={saving}>Excluir esta peça</button>}
        </section>
      </div>

      <section className="studio-preview">
        <div className="studio-editor-head">
          <div><p className="eyebrow">CHANNEL ADAPTATION</p><h2>Prévia de publicação</h2></div>
          <span className="studio-step">02 / 03 · REVISÃO</span>
        </div>
        <div className="studio-preview-grid">
          {draft.channels.map((channel) => (
            <article key={channel}>
              <div className="preview-channel"><span>{channel}</span><small>{channel === "YouTube" ? "SHORTS / VÍDEO" : channel === "Instagram" ? "REELS / FEED" : "VÍDEO CURTO"}</small></div>
              <h3>{draft.title || "Título do conteúdo"}</h3>
              <p>{fullCaption || "A legenda, o CTA e as hashtags aparecerão aqui conforme você preencher o briefing."}</p>
              <button onClick={() => copyText(fullCaption)} disabled={saving}>Copiar legenda</button>
            </article>
          ))}
          {draft.channels.length === 0 && <p className="studio-muted">Selecione um canal para visualizar a adaptação.</p>}
        </div>
      </section>

      <section className="studio-next">
        <div><p className="eyebrow">NEXT MILESTONES</p><h2>Da pauta à publicação</h2></div>
        <div className="studio-pipeline">
          <div className="done"><span>01</span><strong>Briefing e roteiro</strong><small>Disponível neste workspace</small></div>
          <div><span>02</span><strong>Edição de vídeo</strong><small>Próxima etapa: timeline, cortes, legendas e exportação</small></div>
          <div><span>03</span><strong>Distribuição conectada</strong><small>OAuth, upload e publicação via APIs oficiais</small></div>
        </div>
      </section>
      <footer><span>SMKON © {new Date().getFullYear()}</span><span>NO AUTO-PUBLISH · HUMAN APPROVAL FIRST</span></footer>
    </main>
  );
}
