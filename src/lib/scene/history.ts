/**
 * Histórico de edição (desfazer/refazer) do documento de cena.
 * Imutável: cada passo guarda o documento inteiro, que é pequeno (até 256 KB) e
 * já validado. Uma operação nova descarta o "refazer".
 */
import { applyOperation, type OperationOptions, type SceneOperation } from "./operations.ts";
import type { SceneDocument } from "./types.ts";

export const HISTORY_LIMIT = 100;

export type SceneHistory = {
  past: SceneDocument[];
  present: SceneDocument;
  future: SceneDocument[];
};

export function createHistory(doc: SceneDocument): SceneHistory {
  return { past: [], present: doc, future: [] };
}

export function commit(history: SceneHistory, operation: SceneOperation, options: OperationOptions = {}): SceneHistory {
  const next = applyOperation(history.present, operation, options);
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
  };
}

/** Troca o documento inteiro (ex.: regenerado pelo formulário do template) como um passo desfazível. */
export function replace(history: SceneHistory, doc: SceneDocument): SceneHistory {
  return { past: [...history.past, history.present].slice(-HISTORY_LIMIT), present: doc, future: [] };
}

export function canUndo(history: SceneHistory): boolean {
  return history.past.length > 0;
}

export function canRedo(history: SceneHistory): boolean {
  return history.future.length > 0;
}

export function undo(history: SceneHistory): SceneHistory {
  if (!canUndo(history)) return history;
  const previous = history.past[history.past.length - 1];
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

export function redo(history: SceneHistory): SceneHistory {
  if (!canRedo(history)) return history;
  const [next, ...rest] = history.future;
  return { past: [...history.past, history.present].slice(-HISTORY_LIMIT), present: next, future: rest };
}
