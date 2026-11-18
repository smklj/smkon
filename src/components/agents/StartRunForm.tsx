"use client";

import { useActionState } from "react";
import { startRunAction, type AgentState } from "@/app/(app)/agentes/actions";
import { AGENT_KINDS, AGENT_LABEL } from "@/lib/agents/types";

export function StartRunForm({ limit, disabled }: { limit: number; disabled: boolean }) {
  const [state, action, pending] = useActionState<AgentState, FormData>(startRunAction, null);
  return (
    <form action={action} className="form-grid" key={state?.at ?? 0}>
      <input type="hidden" name="limit" value={limit} />
      <label className="field">
        <span>Agente</span>
        <select name="agent" defaultValue={AGENT_KINDS[0]} required disabled={disabled}>
          {AGENT_KINDS.map((kind) => <option key={kind} value={kind}>{AGENT_LABEL[kind]}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Passos máximos</span>
        <input name="max_steps" type="number" min={3} max={limit} defaultValue={Math.min(8, limit)} required disabled={disabled} />
      </label>
      <label className="field field-wide">
        <span>Objetivo</span>
        <textarea name="goal" rows={3} minLength={3} maxLength={2000} required disabled={disabled} placeholder="Ex.: revisar evidências pendentes dos produtos selecionados" />
        <small>O agente só usa ferramentas liberadas abaixo. Nenhum agente publica: publicar exige aprovação humana da versão exata.</small>
      </label>
      {state?.error ? <p className="feedback feedback-error field-wide" role="alert">{state.error}</p> : null}
      {state?.ok ? <p className="feedback feedback-ok field-wide" role="status">{state.ok}</p> : null}
      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={pending || disabled}>{pending ? "Criando…" : "Criar execução"}</button>
      </div>
    </form>
  );
}
