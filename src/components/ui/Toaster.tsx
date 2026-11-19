"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";
import { createToastStore, type Toast, type ToastTone } from "@/lib/ui/toast-store";

/** Store único da aplicação (fora do React: chamar `toast()` não dispara setState em efeito). */
const store = createToastStore({ setTimer: (fn, ms) => window.setTimeout(fn, ms), clearTimer: (id) => window.clearTimeout(id as number) });
const EMPTY: Toast[] = [];

export function toast(message: string, tone: ToastTone = "ok") {
  store.push(message, tone);
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Destaca por um instante a linha (li) onde a ação aconteceu. */
export function flashRow(element: Element | null) {
  const row = element?.closest("li");
  if (!row || typeof row.animate !== "function" || prefersReducedMotion()) return;
  row.animate(
    [{ backgroundColor: "rgba(255, 255, 255, 0.09)" }, { backgroundColor: "rgba(255, 255, 255, 0)" }],
    { duration: 1200, easing: "cubic-bezier(0.2, 0, 0, 1)" },
  );
}

/**
 * Feedback de uma Server Action em ações de linha (sem mensagem de sucesso no próprio formulário):
 * toast com a mensagem e destaque da linha. Erros continuam junto do campo.
 */
export function useActionFeedback<T extends { ok?: string } | null>(state: T) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state?.ok) return;
    toast(state.ok, "ok");
    flashRow(ref.current);
  }, [state]);
  return ref;
}

export function Toaster() {
  const toasts = useSyncExternalStore(store.subscribe, store.snapshot, () => EMPTY);
  return (
    <div
      className="toaster"
      aria-label="Notificações"
      onMouseEnter={store.pause}
      onMouseLeave={store.resume}
      onFocus={store.pause}
      onBlur={store.resume}
    >
      {toasts.map((item) => (
        <div key={item.id} className={`toast toast-${item.tone}`} role={item.tone === "error" ? "alert" : "status"}>
          <span className="toast-icon" aria-hidden="true"><Icon name={item.tone === "error" ? "close" : "check"} size={14} /></span>
          <p>{item.message}</p>
          <button type="button" className="toast-close" aria-label="Fechar notificação" onClick={() => store.dismiss(item.id)}>
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
