"use client";

import { useActionState } from "react";
import { useActionFeedback } from "@/components/ui/Toaster";
import { archiveMediaAction, revokeLicenseAction, type MediaState } from "@/app/(app)/midia/actions";

export function RevokeLicense({ licenseId }: { licenseId: string }) {
  const [state, action, pending] = useActionState<MediaState, FormData>(revokeLicenseAction, null);
  const feedbackRef = useActionFeedback(state);
  return (
    <form ref={feedbackRef} action={action} className="inline-form">
      <input type="hidden" name="license_id" value={licenseId} />
      <label className="sr-only" htmlFor={`revoke-${licenseId}`}>Motivo da revogação</label>
      <input id={`revoke-${licenseId}`} name="reason" maxLength={500} placeholder="Motivo para revogar" disabled={pending} />
      <button type="submit" className="button button-secondary button-small" disabled={pending} aria-busy={pending}>Revogar</button>
      {state?.error ? <span className="feedback feedback-error" role="alert">{state.error}</span> : null}
    </form>
  );
}

export function ArchiveMedia({ mediaId, mediaName }: { mediaId: string; mediaName: string }) {
  const [state, action, pending] = useActionState<MediaState, FormData>(archiveMediaAction, null);
  const feedbackRef = useActionFeedback(state);
  return (
    <form ref={feedbackRef} action={action} className="inline-form">
      <input type="hidden" name="media_id" value={mediaId} />
      <button type="submit" className="link" disabled={pending} aria-busy={pending} aria-label={`Arquivar ${mediaName}`}>Arquivar</button>
      {state?.error ? <span className="feedback feedback-error" role="alert">{state.error}</span> : null}
    </form>
  );
}
