"use client";

import { useActionState } from "react";
import { reviewEvidenceAction, type FormState } from "@/app/(app)/produtos/actions";

export function ReviewControls({ productId, evidenceId }: { productId: string; evidenceId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(reviewEvidenceAction, null);
  return (
    <form action={action} className="evidence-review">
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="evidence_id" value={evidenceId} />
      <div className="inline-form">
        <label className="sr-only" htmlFor={`note-${evidenceId}`}>Observação da revisão</label>
        <input id={`note-${evidenceId}`} name="note" maxLength={500} placeholder="Observação (obrigatória para rejeitar)" disabled={pending} />
        <button type="submit" name="decision" value="verified" className="button button-secondary button-small" disabled={pending}>Verificar</button>
        <button type="submit" name="decision" value="rejected" className="button button-secondary button-small" disabled={pending}>Rejeitar</button>
      </div>
      {state?.error ? <p className="feedback feedback-error" role="alert">{state.error}</p> : null}
    </form>
  );
}
