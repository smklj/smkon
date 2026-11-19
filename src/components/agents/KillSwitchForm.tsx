"use client";

import { useActionState } from "react";
import { killSwitchAction, type AgentState } from "@/app/(app)/agentes/actions";

export function KillSwitchForm({ on }: { on: boolean }) {
  const [state, action, pending] = useActionState<AgentState, FormData>(killSwitchAction, null);
  return (
    <form action={action} className="inline-form" key={state?.at ?? 0}>
      <input type="hidden" name="on" value={on ? "false" : "true"} />
      {on ? null : (
        <>
          <label className="sr-only" htmlFor="kill-reason">Motivo</label>
          <input id="kill-reason" name="reason" maxLength={500} placeholder="Motivo (obrigatório)" required minLength={3} disabled={pending} />
        </>
      )}
      <button type="submit" className={on ? "button button-secondary" : "button button-danger"} disabled={pending} aria-busy={pending}>
        {pending ? "Aplicando…" : on ? "Desligar kill switch" : "Ligar kill switch"}
      </button>
      {state?.error ? <p className="feedback feedback-error" role="alert">{state.error}</p> : null}
      {state?.ok ? <p className="feedback feedback-ok" role="status">{state.ok}</p> : null}
    </form>
  );
}
