"use client";

import { useActionState } from "react";
import { limitsAction, type AgentState } from "@/app/(app)/agentes/actions";

export function LimitsForm({ maxRuns, maxSteps }: { maxRuns: number; maxSteps: number }) {
  const [state, action, pending] = useActionState<AgentState, FormData>(limitsAction, null);
  return (
    <form action={action} className="form-grid">
      <label className="field">
        <span>Execuções por 24 h</span>
        <input name="max_runs" type="number" min={1} max={500} defaultValue={maxRuns} required />
      </label>
      <label className="field">
        <span>Passos por execução</span>
        <input name="max_steps" type="number" min={3} max={50} defaultValue={maxSteps} required />
      </label>
      {state?.error ? <p className="feedback feedback-error field-wide" role="alert">{state.error}</p> : null}
      {state?.ok ? <p className="feedback feedback-ok field-wide" role="status">{state.ok}</p> : null}
      <div className="form-actions">
        <button type="submit" className="button button-secondary" disabled={pending}>{pending ? "Salvando…" : "Salvar limites"}</button>
      </div>
    </form>
  );
}
