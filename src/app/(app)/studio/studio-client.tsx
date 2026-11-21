"use client";

import Link from "next/link";
import { LICENSE_STATUS_LABEL, type LicenseStatus } from "@/lib/media/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CHANNELS,
  ContentItem,
  ContentItemRow,
  ContentStatusLabel,
  LABEL_TO_STATUS,
  LEGACY_STORAGE_KEY,
  LegacyDraft,
  emptyItem,
  itemToPayload,
  migrationKey,
  rowToItem,
} from "@/lib/content/types";
import { ReelsPreviewPlayer } from "@/components/studio/ReelsPreviewPlayer";
import { CreativeInspector } from "@/components/studio/CreativeInspector";
import { BannerMockupInspector } from "@/components/studio/BannerMockupInspector";
import { type SubtitleStyle } from "@/lib/media/subtitles";
import {
  DEFAULT_WATERMARK_CONFIG,
  VIRAL_HOOKS,
  type ViralHook,
  type WatermarkConfig,
} from "@/lib/media/video-composition";
import {
  generateAutonomousDraft,
  type ContentPresetType,
} from "@/lib/content/autonomous-generator";
import {
  generateAutonomousPost,
  type PostKind,
} from "@/lib/content/smart-post-generator";

type Filter = "Todos" | ContentStatusLabel;

const FILTERS: Filter[] = ["Todos", "Rascunho", "Aprovado", "Arquivado"];

type MediaOption = { id: string; name: string; kind: "video" | "image"; licenseStatus: LicenseStatus };

/** Contagens do workspace inteiro (a lista é paginada, então não dá para contar só o que foi carregado). */
type StatusCounts = { total: number; draft: number; approved: number; archived: number };

function contentListUrl(filter: Filter, cursor?: string): string {
  const params = new URLSearchParams();
  if (filter !== "Todos") params.set("status", LABEL_TO_STATUS[filter]);
  if (cursor) params.set("cursor", cursor);
  const query = params.toString();
  return query ? `/api/content?${query}` : "/api/content";
}

function formatCount(value: number | undefined, loading: boolean): string {
  return loading || value === undefined ? "…" : value.toString().padStart(2, "0");
}

export default function StudioClient() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [draft, setDraft] = useState<ContentItem>(emptyItem);
  const [activeId, setActiveId] = useState("");
  const [filter, setFilter] = useState<Filter>("Todos");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [media, setMedia] = useState<MediaOption[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [counts, setCounts] = useState<StatusCounts | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Estados do Content Studio Pro (S20 & S22 · CapCut / Canva REA)
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>("hormozi");
  const [viralHook, setViralHook] = useState<ViralHook>(VIRAL_HOOKS[0]);
  const [watermark, setWatermark] = useState<WatermarkConfig>(DEFAULT_WATERMARK_CONFIG);
  const [promoCode, setPromoCode] = useState<string>("");

  const handleApplyHookToScript = useCallback((hookText: string) => {
    setDraft((prev) => {
      const existing = prev.script.trim();
      const newScript = existing
        ? `[HOOK]: ${hookText}\n\n${existing}`
        : `[HOOK]: ${hookText}\n\n[DESENVOLVIMENTO]\nConfira todos os detalhes deste produto exclusivo.\n\n[CTA]\nGaranta o seu com desconto no link da bio!`;
      return { ...prev, script: newScript };
    });
    setNotice("Gancho viral injetado no roteiro!");
  }, []);

  const handleGenerateAutonomous = useCallback((preset: ContentPresetType) => {
    const defaultNames: Record<ContentPresetType, string> = {
      "shopee-viral": "Mini Aspirador Portátil Sem Fio",
      "shein-fashion": "Conjunto Alfaiataria Elegance",
      "digital-infoproduct": "Manual dos Achadinhos Virais",
      "hotmart-course": "Método Viral 10x",
    };
    const generated = generateAutonomousDraft(preset, defaultNames[preset]);
    setDraft((prev) => ({
      ...prev,
      title: generated.title,
      product: generated.product,
      assetUrl: generated.assetUrl || prev.assetUrl,
      script: generated.script,
      caption: generated.caption,
      cta: generated.cta,
      hashtags: generated.hashtags,
      channels: generated.channels,
    }));
    setViralHook(generated.hook);
    if (generated.promoCode) setPromoCode(generated.promoCode);
    setNotice(`Conteúdo autônomo gerado com sucesso! Revise no player 9:16 e clique em "Aprovar esta versão".`);
  }, []);

  const handleGenerateAutonomousPost = useCallback((kind: PostKind) => {
    const defaultTopics: Record<PostKind, string> = {
      "carousel-tips": "5 Achados Secretos da Shopee",
      "feed-single": "Mini Aspirador Portátil Sem Fio",
      "battle-poll": "Headset Gamer Sem Fio vs Earbuds",
      "question-box": "Qual o seu maior arrependimento de compra?",
      "offer-alert": "Oferta Relâmpago Shopee",
    };
    const post = generateAutonomousPost(kind, defaultTopics[kind]);
    setDraft((prev) => ({
      ...prev,
      title: post.title,
      product: post.topic,
      script: post.slides
        .map(
          (s) =>
            `[SLIDE ${s.slideNumber}/${s.totalSlides}]: ${s.headline} (${s.highlightText || ""})\n${s.bodyText}${
              s.bulletPoints ? `\n• ` + s.bulletPoints.join("\n• ") : ""
            }`
        )
        .join("\n\n"),
      caption: post.caption,
      cta: post.cta,
      hashtags: post.hashtags,
      channels: post.suggestedChannels,
    }));
    setNotice(`Post autônomo (${post.title}) gerado com sucesso! Revise os slides e a legenda na aba "Posts & Carrosséis" abaixo.`);
  }, []);

  // O filtro vale para todas as recargas (salvar, aprovar, excluir) sem recriar loadItems.
  const filterRef = useRef<Filter>("Todos");
  // Respostas de uma lista que já foi trocada (filtro mudou, recarga mais nova) são descartadas.
  const listVersion = useRef(0);

  /** Recarrega a primeira página do filtro atual e as contagens. */
  const loadItems = useCallback(async () => {
    setError("");
    const version = ++listVersion.current;
    try {
      const res = await fetch(contentListUrl(filterRef.current));
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Falha ao carregar conteúdos.");
      const mapped: ContentItem[] = (body.items ?? []).map(rowToItem);
      if (version !== listVersion.current) return mapped;
      setItems(mapped);
      setNextCursor(typeof body.nextCursor === "string" ? body.nextCursor : null);
      if (body.counts) setCounts(body.counts as StatusCounts);
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
      try {
        const res = await fetch("/api/media", { cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) setMedia(body.items ?? []);
      } catch {
        // Sem biblioteca, o seletor fica só com "Sem mídia".
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  function changeFilter(next: Filter) {
    if (next === filterRef.current) return;
    filterRef.current = next;
    setFilter(next);
    setLoading(true);
    void loadItems();
  }

  /** Próxima página (cursor): acrescenta ao fim sem repetir peças já carregadas. */
  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    const version = listVersion.current;
    try {
      const res = await fetch(contentListUrl(filterRef.current, nextCursor));
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Falha ao carregar mais peças.");
      if (version !== listVersion.current) return;
      const more: ContentItem[] = (body.items ?? []).map(rowToItem);
      setItems((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...more.filter((item) => !known.has(item.id))];
      });
      setNextCursor(typeof body.nextCursor === "string" ? body.nextCursor : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar mais peças.");
    } finally {
      setLoadingMore(false);
    }
  }

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
    <div className="page">
      <PageHeader
        eyebrow="03 · Content Studio"
        title="Content Studio"
        description="Crie uma peça central, adapte para YouTube, Instagram e TikTok e aprove a versão exata. Aprovar não publica nada."
        actions={
          <>
            <Link className="link" href="/calendario">Calendário</Link>
            <button
              className="button button-secondary"
              onClick={() => handleGenerateAutonomous("shopee-viral")}
              disabled={saving}
              title="Gerar rascunho de Achadinho Shopee com gancho e link"
            >
              ⚡ Gerar Shopee
            </button>
            <button
              className="button button-secondary"
              onClick={() => handleGenerateAutonomous("shein-fashion")}
              disabled={saving}
              title="Gerar rascunho de Moda Shein com cupom e link"
            >
              👗 Gerar Shein
            </button>
            <button
              className="button button-secondary"
              onClick={() => handleGenerateAutonomous("digital-infoproduct")}
              disabled={saving}
              title="Gerar rascunho de Infoproduto Digital Kiwify"
            >
              📚 Gerar Infoproduto
            </button>
            <button
              className="button button-secondary"
              onClick={() => handleGenerateAutonomousPost("carousel-tips")}
              disabled={saving}
              title="Gerar carrossel completo de 5 slides para Instagram com gancho e CTA"
            >
              🎠 Post Carrossel
            </button>
            <button
              className="button button-secondary"
              onClick={() => handleGenerateAutonomousPost("battle-poll")}
              disabled={saving}
              title="Gerar post de batalha/enquete para pico de engajamento e comentários"
            >
              ⚔️ Batalha / Enquete
            </button>
            <button className="button button-primary" onClick={newDraft} disabled={saving}>Novo conteúdo</button>
          </>
        }
      />

      {error && <p className="feedback feedback-error" role="alert">{error}</p>}
      {notice && <p className="feedback feedback-ok" role="status">{notice}</p>}

      <section className="metrics" aria-label="Indicadores do Studio">
        <div className="metric"><span>Peças</span><strong>{formatCount(counts?.total, loading && !counts)}</strong></div>
        <div className="metric"><span>Rascunhos</span><strong>{formatCount(counts?.draft, loading && !counts)}</strong></div>
        <div className="metric"><span>Aprovados</span><strong>{formatCount(counts?.approved, loading && !counts)}</strong></div>
        <div className="metric"><span>Arquivados</span><strong>{formatCount(counts?.archived, loading && !counts)}</strong></div>
      </section>

      <div className="studio-layout">
        <aside className="studio-library">
          <div className="studio-library-head"><div><p className="eyebrow">Biblioteca</p><h2>Suas peças</h2></div><span>{loading && !counts ? "…" : counts?.total ?? items.length}</span></div>
          <div className="studio-filters">
            {FILTERS.map((item) => (
              <button key={item} className={filter === item ? "selected" : ""} onClick={() => changeFilter(item)} aria-pressed={filter === item}>{item}</button>
            ))}
          </div>
          <div className="studio-draft-list">
            {loading && <div className="studio-empty"><span aria-hidden="true">✳</span><strong>Carregando…</strong><p>Buscando peças do workspace.</p></div>}
            {!loading && visibleItems.length === 0 && <div className="studio-empty"><span aria-hidden="true">✳</span><strong>Nenhuma peça por aqui</strong><p>Crie seu primeiro conteúdo para começar a organizar a produção.</p></div>}
            {!loading && visibleItems.map((item) => (
              <button key={item.id} className={activeId === item.id ? "studio-draft active" : "studio-draft"} onClick={() => openItem(item)}>
                <span className="draft-status">{item.status === "Aprovado" && item.approvedVersion ? `Aprovado · v${item.approvedVersion}` : `${item.status} · v${item.version}`}</span>
                <strong>{item.title}</strong>
                <small>{item.product || "Produto não informado"}</small>
                <span className="draft-channels">{item.channels.join(" · ")}</span>
              </button>
            ))}
            {!loading && nextCursor ? (
              <div className="studio-load-more">
                <button className="button button-secondary button-small" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? "Carregando…" : "Carregar mais"}
                </button>
              </div>
            ) : null}
          </div>
        </aside>

        <section className="studio-editor">
          <div className="studio-editor-head">
            <div><p className="eyebrow">Produção</p><h2>{activeId ? "Editar conteúdo" : "Nova peça de conteúdo"}</h2></div>
            <span className="studio-step">01 / 03 · Briefing</span>
          </div>
          {activeId && draft.status === "Aprovado" && (
            <p className="feedback feedback-info" role="status">
              Versão {draft.approvedVersion} aprovada. Qualquer alteração cria uma nova versão e exige nova aprovação.
            </p>
          )}
          <div className="studio-form-grid">
            <label className="studio-field studio-wide"><span>Título interno *</span><input value={draft.title} onChange={(e) => update("title", e.target.value)} placeholder="Ex.: Review honesta — produto X" disabled={saving} /></label>
            <label className="studio-field"><span>Produto / oferta</span><input value={draft.product} onChange={(e) => update("product", e.target.value)} placeholder="Nome do produto" disabled={saving} /></label>
            <label className="studio-field"><span>Link do produto</span><input value={draft.assetUrl} onChange={(e) => update("assetUrl", e.target.value)} placeholder="https://..." disabled={saving} /></label>
            <label className="studio-field studio-wide">
              <span>Mídia da peça</span>
              <select value={draft.mediaAssetId ?? ""} onChange={(e) => update("mediaAssetId", e.target.value || null)} disabled={saving}>
                <option value="">Sem mídia</option>
                {media.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} · {LICENSE_STATUS_LABEL[option.licenseStatus]}
                  </option>
                ))}
              </select>
              <small className="studio-muted">A mídia faz parte da versão aprovada. Envie arquivos e registre licenças em <Link className="link" href="/midia">Mídia e licenças</Link>.</small>
            </label>
            <label className="studio-field studio-wide"><span>Vídeo de referência / UGC</span><input value={draft.sourceUrl} onChange={(e) => update("sourceUrl", e.target.value)} placeholder="URL do vídeo original ou referência (opcional)" disabled={saving} /></label>
            {draft.sourceUrl && (
              <label className="studio-rights studio-wide">
                <input type="checkbox" checked={draft.rightsConfirmed} onChange={(e) => update("rightsConfirmed", e.target.checked)} disabled={saving} />
                <span>Confirmo que tenho autorização/licença para reutilizar ou adaptar este vídeo. Dar crédito, isoladamente, não substitui autorização.</span>
              </label>
            )}
            <div className="studio-field studio-wide">
              <span>Canais de destino</span>
              <div className="studio-channel-picks">
                {CHANNELS.map((channel) => (
                  <button type="button" key={channel} className={draft.channels.includes(channel) ? "picked" : ""} onClick={() => toggleChannel(channel)} disabled={saving}>
                    <i />{channel}
                  </button>
                ))}
              </div>
            </div>
            <label className="studio-field studio-wide"><span>Roteiro / estrutura do vídeo</span><textarea rows={6} value={draft.script} onChange={(e) => update("script", e.target.value)} placeholder={"HOOK (0–3s)\nDESENVOLVIMENTO\nDEMONSTRAÇÃO / PROVA\nFECHAMENTO"} disabled={saving} /></label>
            <label className="studio-field studio-wide"><span>Legenda</span><textarea rows={4} value={draft.caption} onChange={(e) => update("caption", e.target.value)} placeholder="Escreva a legenda adaptada aos canais selecionados..." disabled={saving} /></label>
            <label className="studio-field"><span>CTA</span><input value={draft.cta} onChange={(e) => update("cta", e.target.value)} placeholder="Ex.: Confira no link..." disabled={saving} /></label>
            <label className="studio-field"><span>Hashtags</span><input value={draft.hashtags} onChange={(e) => update("hashtags", e.target.value)} placeholder="#smkon #review" disabled={saving} /></label>
          </div>
          <div className="studio-editor-actions">
            <button className="studio-secondary" onClick={() => save("draft")} disabled={saving}>{saving ? "Salvando…" : "Salvar rascunho"}</button>
            <button className="studio-primary" onClick={approve} disabled={saving}>{saving ? "Salvando…" : "Aprovar esta versão ↗"}</button>
            {activeId && <button className="studio-secondary" onClick={() => save("archived")} disabled={saving}>Arquivar</button>}
          </div>
          {activeId && <button className="studio-delete" onClick={() => removeDraft(activeId)} disabled={saving}>Excluir esta peça</button>}
        </section>
      </div>

      <section className="studio-creative-section" aria-label="Content Studio Pro Vídeo 9:16">
        <div className="studio-editor-head">
          <div>
            <p className="eyebrow">Engenharia Reversa (REA) · CapCut &amp; Canva</p>
            <h2>Player 9:16 &amp; Legendas Dinâmicas Karaokê</h2>
          </div>
          <span className="studio-step">02 / 03 · Estúdio Criativo</span>
        </div>
        <div className="studio-creative-suite">
          <ReelsPreviewPlayer
            script={draft.script || draft.title || "Confira este produto incrível que acabou de chegar. O link com desconto exclusivo está disponível agora na bio e nos comentários!"}
            subtitleStyle={subtitleStyle}
            hook={viralHook}
            watermark={watermark}
            promoCode={promoCode}
          />
          <CreativeInspector
            subtitleStyle={subtitleStyle}
            onSubtitleStyleChange={setSubtitleStyle}
            selectedHookId={viralHook.id}
            onHookSelect={setViralHook}
            watermark={watermark}
            onWatermarkChange={setWatermark}
            promoCode={promoCode}
            onPromoCodeChange={setPromoCode}
            onApplyHookToScript={handleApplyHookToScript}
            disabled={saving}
          />
        </div>
      </section>

      <BannerMockupInspector
        draftTitle={draft.title}
        draftProduct={draft.product}
      />

      <section className="studio-preview">
        <div className="studio-editor-head">
          <div><p className="eyebrow">Adaptação por canal</p><h2>Prévia de publicação</h2></div>
          <span className="studio-step">03 / 03 · Revisão de Canais</span>
        </div>
        <div className="studio-preview-grid">
          {draft.channels.map((channel) => (
            <article key={channel}>
              <div className="preview-channel"><span>{channel}</span><small>{channel === "YouTube" ? "Shorts / vídeo" : channel === "Instagram" ? "Reels / feed" : "Vídeo curto"}</small></div>
              <h3>{draft.title || "Título do conteúdo"}</h3>
              <p>{fullCaption || "A legenda, o CTA e as hashtags aparecerão aqui conforme você preencher o briefing."}</p>
              <button onClick={() => copyText(fullCaption)} disabled={saving}>Copiar legenda</button>
            </article>
          ))}
          {draft.channels.length === 0 && <p className="studio-muted">Selecione um canal para visualizar a adaptação.</p>}
        </div>
      </section>

      <section className="studio-next">
        <div><p className="eyebrow">Próximas etapas</p><h2>Da pauta à publicação</h2></div>
        <div className="studio-pipeline">
          <div className="done"><span>01</span><strong>Briefing e roteiro</strong><small>Disponível neste workspace</small></div>
          <div className="done"><span>02</span><strong>Edição 9:16 &amp; Legendas</strong><small>CapCut REA: Karaokê, ganchos e marca d&apos;água</small></div>
          <div><span>03</span><strong>Distribuição conectada</strong><small>OAuth, upload e publicação via APIs oficiais</small></div>
        </div>
      </section>
    </div>
  );
}
