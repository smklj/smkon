"use client";

import { useActionState } from "react";
import { useActionFeedback } from "@/components/ui/Toaster";
import { changeMemberRoleAction, removeMemberAction, type MemberState } from "@/app/(app)/admin/actions";
import { MEMBER_ROLES, ROLE_LABEL, type MemberRole } from "@/lib/tenancy/members";

type Props = { userId: string; label: string; role: MemberRole; isSelf: boolean; canChangeRole: boolean; canRemove: boolean };

export function MemberControls({ userId, label, role, isSelf, canChangeRole, canRemove }: Props) {
  return (
    <>
      {canChangeRole ? <ChangeRole userId={userId} label={label} role={role} /> : null}
      {canRemove ? <RemoveMember userId={userId} label={label} isSelf={isSelf} /> : null}
    </>
  );
}

function ChangeRole({ userId, label, role }: { userId: string; label: string; role: MemberRole }) {
  const [state, action, pending] = useActionState<MemberState, FormData>(changeMemberRoleAction, null);
  const feedbackRef = useActionFeedback(state);
  return (
    <form ref={feedbackRef} action={action} className="inline-form">
      <input type="hidden" name="user_id" value={userId} />
      <label className="sr-only" htmlFor={`role-${userId}`}>Papel de {label}</label>
      <select id={`role-${userId}`} name="role" defaultValue={role} key={role} disabled={pending}>
        {MEMBER_ROLES.map((item) => (
          <option key={item} value={item}>{ROLE_LABEL[item]}</option>
        ))}
      </select>
      <button
        type="submit"
        className="button button-secondary button-small"
        disabled={pending}
        aria-busy={pending}
        aria-label={`Salvar papel de ${label}`}
      >
        Salvar
      </button>
      {state?.error ? <span className="feedback feedback-error" role="alert">{state.error}</span> : null}
    </form>
  );
}

function RemoveMember({ userId, label, isSelf }: { userId: string; label: string; isSelf: boolean }) {
  const [state, action, pending] = useActionState<MemberState, FormData>(removeMemberAction, null);
  const feedbackRef = useActionFeedback(state);
  const question = isSelf
    ? "Sair deste workspace? Você perderá o acesso a ele."
    : `Remover ${label} do workspace? O acesso termina imediatamente.`;
  return (
    <form
      ref={feedbackRef}
      action={action}
      className="inline-form"
      onSubmit={(event) => {
        if (!window.confirm(question)) event.preventDefault();
      }}
    >
      <input type="hidden" name="user_id" value={userId} />
      <button type="submit" className="link" disabled={pending} aria-busy={pending} aria-label={isSelf ? "Sair do workspace" : `Remover ${label}`}>
        {isSelf ? "Sair" : "Remover"}
      </button>
      {state?.error ? <span className="feedback feedback-error" role="alert">{state.error}</span> : null}
    </form>
  );
}
