"use client";

import { useActionState } from "react";
import { switchWorkspace, type SwitchWorkspaceState } from "@/app/(app)/actions";
import { ROLE_LABEL, type MemberRole } from "@/lib/tenancy/members";

export type WorkspaceOption = { id: string; name: string; role: MemberRole };

/**
 * Workspace ativo no rodapé da navegação. Com mais de um workspace, o seletor grava
 * a escolha no servidor (o banco confere a membership) e recarrega a visão geral.
 */
export function WorkspaceSwitcher({ workspaces, activeId }: { workspaces: WorkspaceOption[]; activeId: string | null }) {
  const [state, action, pending] = useActionState<SwitchWorkspaceState, FormData>(switchWorkspace, null);
  const active = workspaces.find((item) => item.id === activeId) ?? null;
  if (!active) return null;

  if (workspaces.length < 2) {
    return (
      <p className="app-workspace" title={active.name}>
        <span className="app-workspace-name">{active.name}</span>
        <span className="app-workspace-role">{ROLE_LABEL[active.role]}</span>
      </p>
    );
  }

  return (
    <form action={action} className="app-workspace-form">
      <label className="app-workspace-label" htmlFor="workspace-switcher">Workspace</label>
      <div className="app-workspace-row">
        <select
          id="workspace-switcher"
          name="organization_id"
          defaultValue={active.id}
          key={active.id}
          disabled={pending}
          aria-busy={pending}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        >
          {workspaces.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {ROLE_LABEL[item.role]}
            </option>
          ))}
        </select>
        <noscript>
          <button type="submit" className="button button-secondary button-small">Trocar</button>
        </noscript>
      </div>
      {state?.error ? <span className="feedback feedback-error" role="alert">{state.error}</span> : null}
    </form>
  );
}
