"use client";

import { useCallback, useRef, useState } from "react";
import { canRedo, canUndo, commit, createHistory, redo, replace, undo, type SceneHistory } from "@/lib/scene/history";
import type { OperationOptions, SceneOperation } from "@/lib/scene/operations";
import type { SceneDocument } from "@/lib/scene/types";
import { assertBindingStructure } from "@/lib/scene/bindings";

/** Estado do editor: histórico do documento, página aberta, camada selecionada e último erro. */
export function useSceneEditor(initial: SceneDocument) {
  const [history, setHistoryState] = useState<SceneHistory>(() => createHistory(initial));
  // Espelho síncrono: operações seguidas no mesmo tick (ex.: teclado repetido) partem do último estado.
  const historyRef = useRef(history);
  const [pageIndex, setPageIndexState] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setHistory = useCallback((next: SceneHistory) => {
    historyRef.current = next;
    setHistoryState(next);
  }, []);

  /** Aplica uma operação. Se for recusada (trava, valor inválido), o documento não muda e o motivo aparece. */
  const run = useCallback(
    (operation: SceneOperation, options?: OperationOptions): boolean => {
      try {
        const next = commit(historyRef.current, operation, options);
        // Preço ligado sem fonte e data não chega a entrar no documento (o servidor também recusa).
        assertBindingStructure(next.present);
        setHistory(next);
        setError(null);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Operação recusada.");
        return false;
      }
    },
    [setHistory],
  );

  const doc = history.present;
  const safeIndex = Math.min(pageIndex, doc.pages.length - 1);
  const page = doc.pages[safeIndex];
  const selected = page.layers.find((layer) => layer.id === selectedId) ?? null;

  return {
    doc,
    page,
    pageIndex: safeIndex,
    setPageIndex: (index: number) => {
      setPageIndexState(index);
      setSelectedId(null);
    },
    selected,
    selectedId,
    setSelectedId,
    error,
    setError,
    run,
    /** Troca o documento inteiro (ex.: mudar o formato) como um passo desfazível. */
    replaceDoc: (next: SceneDocument) => {
      setHistory(replace(historyRef.current, next));
      setSelectedId(null);
      setError(null);
    },
    undo: () => setHistory(undo(historyRef.current)),
    redo: () => setHistory(redo(historyRef.current)),
    canUndo: canUndo(history),
    canRedo: canRedo(history),
  };
}
