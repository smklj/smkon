"use client";

import { useActionState, useState } from "react";
import { createMissionAction, type AgentState } from "@/app/(app)/agentes/actions";
import {
  AGENT_KINDS,
  AGENT_LABEL,
  MISSION_SCHEDULE_KINDS,
  MISSION_SCHEDULE_LABEL,
  WEEKDAY_LABEL,
  type MissionScheduleKind,
} from "@/lib/agents/types";

export function MissionForm({ limit, disabled }: { limit: number; disabled: boolean }) {
  const [state, action, pending] = useActionState<AgentState, FormData>(createMissionAction, null);
  const [kind, setKind] = useState<MissionScheduleKind>("daily");
  return (
    <form action={action} className="form-grid" key={state?.at ?? 0}>
      <input type="hidden" name="limit" value={limit} />
      <label className="field">
        <span>Nome</span>
        <input name="name" minLength={3} maxLength={120} required disabled={disabled} placeholder="Ex.: Radar de segunda" />
      </label>
      <label className="field">
        <span>Agente</span>
        <select name="agent" defaultValue={AGENT_KINDS[0]} required disabled={disabled}>
          {AGENT_KINDS.map((agent) => <option key={agent} value={agent}>{AGENT_LABEL[agent]}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Frequência</span>
        <select
          name="schedule_kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as MissionScheduleKind)}
          required
          disabled={disabled}
        >
          {MISSION_SCHEDULE_KINDS.map((option) => <option key={option} value={option}>{MISSION_SCHEDULE_LABEL[option]}</option>)}
        </select>
      </label>
      {kind === "weekly" ? (
        <label className="field">
          <span>Dia</span>
          <select name="weekday" defaultValue="1" required disabled={disabled}>
            {WEEKDAY_LABEL.map((label, index) => <option key={label} value={index}>{label}</option>)}
          </select>
        </label>
      ) : null}
      {kind === "interval" ? (
        <label className="field">
          <span>A cada (horas)</span>
          <input name="interval_hours" type="number" min={1} max={168} defaultValue={6} required disabled={disabled} />
        </label>
      ) : (
        <label className="field">
          <span>Horário (Brasília)</span>
          <input name="time" type="time" defaultValue="08:00" required disabled={disabled} />
        </label>
      )}
      <label className="field">
        <span>Passos máximos</span>
        <input name="max_steps" type="number" min={3} max={limit} defaultValue={Math.min(8, limit)} required disabled={disabled} />
      </label>
      <label className="field field-wide">
        <span>Objetivo</span>
        <textarea name="goal" rows={3} minLength={3} maxLength={2000} required disabled={disabled} placeholder="Ex.: ranquear os produtos selecionados usando só evidências verificadas" />
        <small>
          A cada horário, o worker coloca uma execução na fila com este objetivo. Ela passa pelos mesmos limites, ferramentas
          liberadas e kill switch de uma execução manual. Nenhuma missão publica nada.
        </small>
      </label>
      {state?.error ? <p className="feedback feedback-error field-wide" role="alert">{state.error}</p> : null}
      {state?.ok ? <p className="feedback feedback-ok field-wide" role="status">{state.ok}</p> : null}
      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={pending || disabled} aria-busy={pending}>{pending ? "Criando…" : "Criar missão"}</button>
      </div>
    </form>
  );
}
