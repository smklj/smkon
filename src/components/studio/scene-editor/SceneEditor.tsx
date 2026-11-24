"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { LicenseStatus } from "@/lib/media/types";
import { canEditBrand, assertLocksRespected } from "@/lib/scene/locks";
import { applyOperation, type SceneOperation } from "@/lib/scene/operations";
import { renderPageSvg } from "@/lib/scene/render";
import {
  movePatch,
  newImageLayer,
  newRectLayer,
  newTextLayer,
  resizePatch,
  sceneAssetIds,
  sceneFormatOf,
  SCENE_FORMATS,
  isSceneFormat,
  type Box,
} from "@/lib/scene/geometry";
import { reformatScene } from "@/lib/scene/templates";
import { bindingRefs, refreshBindings, type BindingData, type LatestEvidence } from "@/lib/scene/bindings";
import type { SceneDocument, SceneLayer } from "@/lib/scene/types";
import type { SavedScene, ScenePiece } from "../SceneSaveControl";
import { downloadBlob, exportScenePage, fetchSignedUrls, type ExportType } from "./export";
import { LayersPanel } from "./LayersPanel";
import { MediaPicker, type PickedMedia } from "./MediaPicker";
import { PropertiesPanel } from "./PropertiesPanel";
import { useSceneEditor } from "./useSceneEditor";

type Props = {
  initialScene: SceneDocument;
  piece: ScenePiece | null;
  /** Papel no workspace (null = ainda não carregado). */
  role: string | null;
  /** Nome do arquivo exportado: "capa", "carrossel". */
  label: string;
  onSaved: (saved: SavedScene) => void;
  onClose: () => void;
};

type Interaction =
  | { kind: "move"; layer: SceneLayer; pageId: string; startX: number; startY: number; scale: number }
  | { kind: "resize"; layer: SceneLayer; pageId: string; startX: number; startY: number; scale: number; box: Box };

const NUDGE = 1;
/** Altura máxima do palco na tela; o documento mantém o tamanho real. */
const STAGE_MAX_HEIGHT = 640;
const NUDGE_BIG = 10;

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

/**
 * Editor de camadas (F2): seleção, mover, redimensionar, texto direto na tela, painel de
 * camadas e propriedades, imagens da biblioteca, formatos e exportação. Toda mudança é uma
 * operação do documento de cena (desfazer/refazer, travas); o servidor confere as travas
 * de novo ao salvar.
 */
export function SceneEditor({ initialScene, piece, role, label, onSaved, onClose }: Props) {
  const editor = useSceneEditor(initialScene);
  const { doc, page, pageIndex, selected, selectedId, setSelectedId, run } = editor;
  const canBrand = canEditBrand(role);
  const canWrite = role === null || canBrand;

  const [savedDoc, setSavedDoc] = useState<SceneDocument>(initialScene);
  const dirty = doc !== savedDoc;
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [licenses, setLicenses] = useState<Record<string, LicenseStatus>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<ExportType | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [textEdit, setTextEdit] = useState<{ id: string; value: string } | null>(null);
  const [preview, setPreview] = useState<SceneOperation | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [viewWidth, setViewWidth] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const interaction = useRef<Interaction | null>(null);

  // Imagens já usadas no design: URLs assinadas (o renderizador desenha marcador sem elas).
  const assetKey = sceneAssetIds(doc).join(",");
  useEffect(() => {
    const missing = assetKey ? assetKey.split(",").filter((id) => !urls[id]) : [];
    if (missing.length === 0) return;
    let active = true;
    fetchSignedUrls(missing)
      .then((signed) => {
        if (active) setUrls((current) => ({ ...current, ...signed }));
      })
      .catch((err: unknown) => {
        if (active) editor.setError(err instanceof Error ? err.message : "Não foi possível carregar as imagens.");
      });
    return () => {
      active = false;
    };
    // urls fica de fora: só buscamos quando o conjunto de imagens do design muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetKey]);

  const shown = useMemo(() => {
    if (!preview) return doc;
    try {
      return applyOperation(doc, preview);
    } catch {
      return doc;
    }
  }, [doc, preview]);

  const svg = useMemo(
    () => renderPageSvg(shown, { pageIndex, annotate: true, idPrefix: "ed", resolveAsset: (id) => urls[id] }),
    [shown, pageIndex, urls],
  );

  const scale = viewWidth > 0 ? viewWidth / doc.width : 0;

  // Largura do palco na tela: converte pixels da tela em pixels do documento.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => setViewWidth(entry.contentRect.width));
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  // Caixa da camada selecionada, medida no SVG desenhado (texto e marca não têm largura no documento).
  useLayoutEffect(() => {
    const element = selectedId ? hostRef.current?.querySelector<SVGGraphicsElement>(`[data-layer="${selectedId}"]`) : null;
    let next: Box | null = null;
    if (element) {
      const bbox = element.getBBox();
      next = { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
    }
    // Medida do DOM depois de desenhar: precisa do efeito de layout.
    setBox((current) =>
      current && next && current.x === next.x && current.y === next.y && current.width === next.width && current.height === next.height ? current : next,
    );
  }, [svg, selectedId, viewWidth]);

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      setTextEdit(null);
    },
    [setSelectedId],
  );

  /* ---------- tela: selecionar, mover, redimensionar ---------- */

  function onCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || textEdit || scale === 0) return;
    const target = (event.target as Element).closest("[data-layer]");
    const id = target?.getAttribute("data-layer") ?? null;
    select(id);
    const layer = id ? page.layers.find((item) => item.id === id) : undefined;
    if (!layer || layer.locked) return;
    interaction.current = { kind: "move", layer, pageId: page.id, startX: event.clientX, startY: event.clientY, scale };
    stageRef.current?.setPointerCapture(event.pointerId);
  }

  function onHandlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (!selected || selected.locked || !box || scale === 0) return;
    interaction.current = { kind: "resize", layer: selected, pageId: page.id, startX: event.clientX, startY: event.clientY, scale, box };
    stageRef.current?.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const current = interaction.current;
    if (!current) return;
    const dx = (event.clientX - current.startX) / current.scale;
    const dy = (event.clientY - current.startY) / current.scale;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    const patch =
      current.kind === "move"
        ? movePatch(current.layer, dx, dy)
        : resizePatch(current.layer, current.box, current.box.width + dx, current.box.height + dy);
    setPreview({ op: "layer.update", pageId: current.pageId, layerId: current.layer.id, patch });
  }

  function onPointerUp() {
    interaction.current = null;
    if (preview) {
      run(preview); // um arrasto = um passo de desfazer
      setPreview(null);
    }
  }

  function startTextEdit(layer: SceneLayer | null) {
    if (layer?.type !== "text" || layer.locked === "brand") return;
    if (layer.bind) {
      editor.setError("Este texto vem dos dados do produto: use “Atualizar dados do produto” em vez de digitar.");
      return;
    }
    setTextEdit({ id: layer.id, value: layer.text });
  }

  const bound = bindingRefs(doc);

  /** Puxa a evidência verificada mais recente de cada produto ligado e recalcula os textos. */
  async function refreshProductData() {
    setRefreshing(true);
    setNotice(null);
    try {
      const query = `ids=${bound.productIds.join(",")}${bound.evidenceIds.length ? `&evidence=${bound.evidenceIds.join(",")}` : ""}`;
      const res = await fetch(`/api/products/bindings?${query}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Não foi possível carregar os dados dos produtos.");
      const data: BindingData = { products: body.products ?? {}, evidence: body.evidence ?? {} };
      const result = refreshBindings(doc, data, (body.latest ?? {}) as LatestEvidence);
      if (result.changed === 0) {
        setNotice("Os dados do produto já estão atualizados.");
        return;
      }
      editor.replaceDoc(result.doc);
      setNotice(`${result.changed} campo(s) atualizado(s) com a evidência verificada mais recente.`);
    } catch (err) {
      editor.setError(err instanceof Error ? err.message : "Não foi possível atualizar os dados do produto.");
    } finally {
      setRefreshing(false);
    }
  }

  function commitTextEdit() {
    if (!textEdit) return;
    const layer = page.layers.find((item) => item.id === textEdit.id);
    if (layer?.type === "text" && textEdit.value !== layer.text) {
      run({ op: "layer.update", pageId: page.id, layerId: layer.id, patch: { text: textEdit.value } });
    }
    setTextEdit(null);
  }

  /* ---------- teclado ---------- */

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (mod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) editor.redo();
        else editor.undo();
        return;
      }
      if (mod && key === "y") {
        event.preventDefault();
        editor.redo();
        return;
      }
      if (event.key === "Escape") {
        select(null);
        return;
      }
      if (!selected) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        if (run({ op: "layer.remove", pageId: page.id, layerId: selected.id })) select(null);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        startTextEdit(selected);
        return;
      }
      const step = event.shiftKey ? NUDGE_BIG : NUDGE;
      const delta: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const move = delta[event.key];
      if (move) {
        event.preventDefault();
        run({ op: "layer.update", pageId: page.id, layerId: selected.id, patch: movePatch(selected, move[0], move[1]) });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  /* ---------- barra de ferramentas ---------- */

  function addLayer(layer: SceneLayer) {
    if (run({ op: "layer.add", pageId: page.id, layer })) select(layer.id);
  }

  async function pickMedia(media: PickedMedia) {
    setPickerOpen(false);
    const natural = await new Promise<{ width: number; height: number } | undefined>((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve(undefined);
      image.src = media.url;
    });
    setUrls((current) => ({ ...current, [media.id]: media.url }));
    setLicenses((current) => ({ ...current, [media.id]: media.licenseStatus }));
    addLayer(newImageLayer(doc, page, media.id, natural));
    if (media.licenseStatus !== "valid") {
      setNotice(`"${media.name}" não tem licença comercial válida: a publicação fica bloqueada até registrar a licença.`);
    }
  }

  function changeFormat(value: string) {
    if (!isSceneFormat(value)) return;
    const result = reformatScene(doc, value);
    if (!canBrand) {
      try {
        assertLocksRespected(doc, result.doc, { allowBrand: false });
      } catch {
        editor.setError("Mudar o formato reposiciona camadas da marca: só owner ou admin pode.");
        return;
      }
    }
    editor.replaceDoc(result.doc);
    setNotice(
      result.via === "template"
        ? `Formato ${value} gerado pelo template da marca.`
        : `Formato ${value}: conteúdo adaptado automaticamente. Confira posições e tamanhos.`,
    );
  }

  async function exportPage(type: ExportType) {
    setBusy(type);
    setNotice(null);
    try {
      const blob = await exportScenePage(doc, pageIndex, type);
      const format = (sceneFormatOf(doc) ?? `${doc.width}x${doc.height}`).replace(":", "x");
      const suffix = doc.pages.length > 1 ? `-${pageIndex + 1}` : "";
      downloadBlob(blob, `smkon-${label}-${format}${suffix}.${type === "jpeg" ? "jpg" : "png"}`);
    } catch (err) {
      editor.setError(err instanceof Error ? err.message : "Não foi possível exportar.");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!piece) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/content/scene", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: piece.id, scene: doc, expectedHash: piece.contentHash }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Não foi possível salvar o design.");
      const saved = body as SavedScene;
      setSavedDoc(doc);
      onSaved(saved);
      setNotice(`Design salvo na peça (versão ${saved.version}).`);
    } catch (err) {
      editor.setError(err instanceof Error ? err.message : "Não foi possível salvar o design.");
    } finally {
      setSaving(false);
    }
  }

  function requestClose() {
    if (dirty && !confirmClose) {
      setConfirmClose(true);
      return;
    }
    onClose();
  }

  const format = sceneFormatOf(doc);
  const editingLayer = textEdit ? page.layers.find((item) => item.id === textEdit.id) : null;

  return (
    <section className="scene-editor" aria-label="Editor de camadas">
      <div className="scene-toolbar" role="toolbar" aria-label="Ferramentas do editor">
        <div className="scene-toolbar-group">
          <button type="button" className="btn-canvas-action" onClick={() => addLayer(newTextLayer(doc, page))}>
            + Texto
          </button>
          <button type="button" className="btn-canvas-action" onClick={() => addLayer(newRectLayer(doc, page))}>
            + Forma
          </button>
          <button type="button" className="btn-canvas-action" onClick={() => setPickerOpen((open) => !open)} aria-expanded={pickerOpen}>
            + Imagem
          </button>
        </div>
        <div className="scene-toolbar-group">
          <button type="button" className="btn-canvas-action" onClick={editor.undo} disabled={!editor.canUndo} title="Ctrl+Z">
            Desfazer
          </button>
          <button type="button" className="btn-canvas-action" onClick={editor.redo} disabled={!editor.canRedo} title="Ctrl+Shift+Z">
            Refazer
          </button>
        </div>
        {bound.productIds.length > 0 && (
          <button type="button" className="btn-canvas-action" onClick={refreshProductData} disabled={refreshing}>
            {refreshing ? "Atualizando…" : "Atualizar dados do produto"}
          </button>
        )}
        <label className="scene-field scene-format">
          <span>Formato</span>
          <select value={format ?? "custom"} onChange={(event) => changeFormat(event.target.value)}>
            {!format && <option value="custom">{`${doc.width}×${doc.height}`}</option>}
            {Object.keys(SCENE_FORMATS).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <div className="scene-toolbar-group">
          <button type="button" className="btn-canvas-action" onClick={() => exportPage("png")} disabled={busy !== null}>
            {busy === "png" ? "Gerando…" : "PNG"}
          </button>
          <button type="button" className="btn-canvas-action" onClick={() => exportPage("jpeg")} disabled={busy !== null}>
            {busy === "jpeg" ? "Gerando…" : "JPG"}
          </button>
        </div>
        <div className="scene-toolbar-group scene-toolbar-end">
          <button
            type="button"
            className="btn-canvas-action primary"
            onClick={save}
            disabled={!piece || !canWrite || saving || !dirty}
            title={!piece ? "Salve a peça antes" : !canWrite ? "Só owner ou admin salva" : undefined}
          >
            {saving ? "Salvando…" : dirty ? "Salvar na peça" : "Salvo"}
          </button>
          <button type="button" className="btn-canvas-action" onClick={requestClose}>
            {confirmClose ? "Fechar sem salvar" : "Fechar editor"}
          </button>
        </div>
      </div>

      {confirmClose && <p className="scene-save-hint" role="status">Há alterações não salvas. Clique de novo para fechar mesmo assim.</p>}
      {!piece && <p className="scene-save-hint">Salve a peça (briefing acima) para guardar o design nela. Exportar funciona sem salvar.</p>}
      {piece?.approved && dirty && (
        <p className="scene-save-hint">A peça está aprovada: salvar cria uma versão nova, que volta para rascunho e precisa de nova aprovação.</p>
      )}
      {editor.error && (
        <p className="scene-save-error" role="alert">
          {editor.error}
        </p>
      )}
      {notice && (
        <p className="scene-save-ok" aria-live="polite">
          {notice}
        </p>
      )}

      {doc.pages.length > 1 && (
        <div className="tab-pill-group scene-pages" role="group" aria-label="Páginas do carrossel">
          {doc.pages.map((item, index) => (
            <button
              type="button"
              key={item.id}
              className={index === pageIndex ? "active" : ""}
              aria-pressed={index === pageIndex}
              onClick={() => editor.setPageIndex(index)}
            >
              {index + 1}
            </button>
          ))}
        </div>
      )}

      <div className="scene-editor-grid">
        <div className="scene-stage-wrap">
          <div
            ref={stageRef}
            className="scene-stage"
            style={{ aspectRatio: `${doc.width} / ${doc.height}`, maxWidth: `${Math.round(Math.min(720, (STAGE_MAX_HEIGHT * doc.width) / doc.height))}px` }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            // No palco, não no SVG: com o ponteiro capturado pelo palco, o duplo clique chega aqui.
            onDoubleClick={() => startTextEdit(selected)}
            onPointerCancel={() => {
              interaction.current = null;
              setPreview(null);
            }}
          >
            <div
              ref={hostRef}
              className="scene-svg"
              data-testid="scene-canvas"
              onPointerDown={onCanvasPointerDown}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            {box && scale > 0 && selected && !textEdit && (
              <div
                className={selected.locked ? "scene-selection locked" : "scene-selection"}
                style={{ left: box.x * scale, top: box.y * scale, width: box.width * scale, height: box.height * scale }}
                aria-hidden="true"
              >
                {!selected.locked && <div className="scene-handle" onPointerDown={onHandlePointerDown} data-testid="scene-resize-handle" />}
              </div>
            )}
            {textEdit && box && editingLayer?.type === "text" && (
              <input
                className="scene-inline-text"
                aria-label="Texto da camada"
                autoFocus
                value={textEdit.value}
                maxLength={2000}
                style={{
                  left: box.x * scale,
                  top: box.y * scale,
                  minWidth: Math.max(80, box.width * scale),
                  height: Math.max(24, box.height * scale),
                  fontSize: Math.max(12, editingLayer.size * scale * 0.8),
                }}
                onChange={(event) => setTextEdit({ id: textEdit.id, value: event.target.value })}
                onBlur={commitTextEdit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitTextEdit();
                  if (event.key === "Escape") setTextEdit(null);
                }}
              />
            )}
          </div>
          <p className="scene-save-hint">
            Arraste para mover, puxe o canto para redimensionar, duplo clique num texto para escrever. Setas movem (Shift = 10 px), Delete
            remove.
          </p>
        </div>

        <div className="scene-side">
          {pickerOpen && <MediaPicker onPick={pickMedia} onClose={() => setPickerOpen(false)} />}
          <PropertiesPanel page={page} layer={selected} run={run} licenses={licenses} />
          <LayersPanel page={page} selectedId={selectedId} onSelect={select} run={run} canBrand={canBrand} />
        </div>
      </div>
    </section>
  );
}
