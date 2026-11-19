/** Fila de toasts, sem dependência de React ou DOM (testável com node:test). */

export type ToastTone = "ok" | "error" | "info";
export type Toast = { id: number; message: string; tone: ToastTone };

type Timers = { setTimer: (fn: () => void, ms: number) => unknown; clearTimer: (handle: unknown) => void };

export const TOAST_DURATION_MS = 4000;
export const TOAST_MAX = 3;

export function createToastStore(timers: Timers, duration = TOAST_DURATION_MS, max = TOAST_MAX) {
  let toasts: Toast[] = [];
  let nextId = 1;
  let paused = false;
  const listeners = new Set<() => void>();
  const handles = new Map<number, unknown>();

  const emit = () => listeners.forEach((listener) => listener());

  function schedule(id: number) {
    if (paused) return;
    handles.set(id, timers.setTimer(() => dismiss(id), duration));
  }

  function dismiss(id: number) {
    const handle = handles.get(id);
    if (handle !== undefined) timers.clearTimer(handle);
    handles.delete(id);
    const next = toasts.filter((item) => item.id !== id);
    if (next.length !== toasts.length) {
      toasts = next;
      emit();
    }
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    snapshot: () => toasts,
    push(message: string, tone: ToastTone = "ok") {
      const text = message.trim();
      if (!text) return null;
      // A mesma mensagem repetida não empilha: reinicia o tempo da existente.
      const existing = toasts.find((item) => item.message === text && item.tone === tone);
      if (existing) {
        const handle = handles.get(existing.id);
        if (handle !== undefined) timers.clearTimer(handle);
        schedule(existing.id);
        return existing.id;
      }
      const id = nextId++;
      toasts = [...toasts, { id, message: text, tone }].slice(-max);
      for (const key of [...handles.keys()]) {
        if (!toasts.some((item) => item.id === key)) {
          timers.clearTimer(handles.get(key));
          handles.delete(key);
        }
      }
      schedule(id);
      emit();
      return id;
    },
    dismiss,
    pause() {
      paused = true;
      for (const handle of handles.values()) timers.clearTimer(handle);
      handles.clear();
    },
    resume() {
      paused = false;
      for (const item of toasts) schedule(item.id);
    },
  };
}
