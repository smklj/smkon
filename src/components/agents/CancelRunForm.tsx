"use client";

import { useActionState } from "react";
import { useActionFeedback } from "@/components/ui/Toaster";
import { cancelRunAction, type AgentState } from "@/app/(app)/agentes/actions";

export function CancelRunForm({ runId }: { runId: string }) {
  const [state, action, pending] = useActionState<AgentState, FormData>(cancelRunAction, null);
  const feedbackRef = useActionFeedback(state);
  return (
    <form ref={feedbackRef} action={action} className="inline-form">
      <input type="hidden" name="run_id" value={runId} />
      <label className="sr-only" htmlFor={`cancel-${runId}`}>Motivo do cancelamento</label>
      <input id={`cancel-${runId}`} name="reason" maxLength={500} placeholder="Motivo para cancelar" disabled={pending} />
      <button type="submit" className="button button-secondary button-small" disabled={pending} aria-busy={pending}>Cancelar</button>
      {state?.error ? <p className="feedback feedback-error" role="alert">{state.error}</p> : null}
    </form>
  );
}
