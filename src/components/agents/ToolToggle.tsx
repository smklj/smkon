"use client";

import { useActionState } from "react";
import { toolAction, type AgentState } from "@/app/(app)/agentes/actions";

export function ToolToggle({ tool, label, enabled }: { tool: string; label: string; enabled: boolean }) {
  const [state, action, pending] = useActionState<AgentState, FormData>(toolAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="tool" value={tool} />
      <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
      <button type="submit" className="button button-secondary button-small" disabled={pending} aria-label={`${enabled ? "Bloquear" : "Liberar"} ${label}`}>
        {pending ? "…" : enabled ? "Bloquear" : "Liberar"}
      </button>
      {state?.error ? <p className="feedback feedback-error" role="alert">{state.error}</p> : null}
    </form>
  );
}
