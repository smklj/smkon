"use client";

import { useActionState } from "react";
import { updatePassword, type PasswordState } from "./actions";

export function PasswordForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<PasswordState, FormData>(updatePassword, null);
  return (
    <form action={formAction} className="auth-form">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="password">Nova senha</label>
      <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
      <label htmlFor="confirmation">Confirme a senha</label>
      <input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
      {state?.error ? <p className="feedback feedback-error" role="alert">{state.error}</p> : null}
      <button type="submit" className="button button-primary" disabled={pending}>
        {pending ? "Salvando…" : "Definir senha"}
      </button>
    </form>
  );
}
