"use client";

import { useActionState } from "react";
import { useActionFeedback } from "@/components/ui/Toaster";
import { cancelAction, dryRunAction, type CalendarState } from "@/app/(app)/calendario/actions";

export function JobActions({ jobId, label }: { jobId: string; label: string }) {
  const [runState, runAction, running] = useActionState<CalendarState, FormData>(dryRunAction, null);
  const feedbackRef = useActionFeedback(runState);
  const [cancelState, cancelFormAction, cancelling] = useActionState<CalendarState, FormData>(cancelAction, null);
  const cancelFeedbackRef = useActionFeedback(cancelState);
  const busy = running || cancelling;
  const error = runState?.error ?? cancelState?.error;

  return (
    <div className="evidence-review">
      <div className="inline-form">
        <form ref={feedbackRef} action={runAction}>
          <input type="hidden" name="job_id" value={jobId} />
          <button type="submit" className="button button-secondary button-small" disabled={busy} aria-busy={busy} aria-label={`Rodar dry-run de ${label}`}>
            {running ? "Verificando…" : "Rodar dry-run"}
          </button>
        </form>
        <form ref={cancelFeedbackRef} action={cancelFormAction} className="inline-form">
          <input type="hidden" name="job_id" value={jobId} />
          <label className="sr-only" htmlFor={`reason-${jobId}`}>Motivo do cancelamento</label>
          <input id={`reason-${jobId}`} name="reason" maxLength={500} placeholder="Motivo para cancelar" disabled={busy} />
          <button type="submit" className="button button-secondary button-small" disabled={busy} aria-busy={busy}>Cancelar</button>
        </form>
      </div>
      {error ? <p className="feedback feedback-error" role="alert">{error}</p> : null}
    </div>
  );
}
