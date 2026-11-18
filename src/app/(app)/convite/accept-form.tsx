"use client";

import { useActionState } from "react";
import { acceptInvitation, type AcceptState } from "./actions";

export function AcceptForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<AcceptState, FormData>(acceptInvitation, null);
  return (
    <form action={formAction} className="invite-form">
      <input type="hidden" name="token" value={token} />
      {state?.error ? <p className="feedback feedback-error" role="alert">{state.error}</p> : null}
      <button type="submit" className="button button-primary" disabled={pending}>
        {pending ? "Aceitando…" : "Aceitar convite"}
      </button>
    </form>
  );
}
