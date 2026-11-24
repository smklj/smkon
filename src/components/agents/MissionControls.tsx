"use client";

import { useActionState } from "react";
import { useActionFeedback } from "@/components/ui/Toaster";
import { archiveMissionAction, toggleMissionAction, type AgentState } from "@/app/(app)/agentes/actions";

/** Pausar/retomar e arquivar uma missão (owner ou admin; o banco confere de novo). */
export function MissionControls({ missionId, name, enabled }: { missionId: string; name: string; enabled: boolean }) {
  const [toggleState, toggle, toggling] = useActionState<AgentState, FormData>(toggleMissionAction, null);
  const [archiveState, archive, archiving] = useActionState<AgentState, FormData>(archiveMissionAction, null);
  const toggleRef = useActionFeedback(toggleState);
  const archiveRef = useActionFeedback(archiveState);
  const busy = toggling || archiving;
  return (
    <div className="inline-form">
      <form ref={toggleRef} action={toggle}>
        <input type="hidden" name="mission_id" value={missionId} />
        <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
        <button
          type="submit"
          className="button button-secondary button-small"
          disabled={busy}
          aria-busy={toggling}
          aria-label={`${enabled ? "Pausar" : "Retomar"} missão ${name}`}
        >
          {toggling ? "…" : enabled ? "Pausar" : "Retomar"}
        </button>
      </form>
      <form ref={archiveRef} action={archive}>
        <input type="hidden" name="mission_id" value={missionId} />
        <button
          type="submit"
          className="button button-ghost button-small"
          disabled={busy}
          aria-busy={archiving}
          aria-label={`Arquivar missão ${name}`}
        >
          {archiving ? "…" : "Arquivar"}
        </button>
      </form>
      {toggleState?.error ? <p className="feedback feedback-error" role="alert">{toggleState.error}</p> : null}
      {archiveState?.error ? <p className="feedback feedback-error" role="alert">{archiveState.error}</p> : null}
    </div>
  );
}
