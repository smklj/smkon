"use client";

import { useActionState, useState } from "react";
import { scheduleAction, type CalendarState } from "@/app/(app)/calendario/actions";
import type { ApprovedContent } from "@/lib/publication/server";

export function ScheduleForm({ contents, defaultWhen }: { contents: ApprovedContent[]; defaultWhen: string }) {
  const [state, action, pending] = useActionState<CalendarState, FormData>(scheduleAction, null);
  const [contentId, setContentId] = useState(contents[0]?.id ?? "");
  const channels = contents.find((item) => item.id === contentId)?.channels ?? [];

  return (
    <form action={action} className="form-grid" key={state?.at ?? 0}>
      <label className="field field-wide">
        <span>Conteúdo aprovado</span>
        <select name="content_id" value={contentId} onChange={(event) => setContentId(event.target.value)} required>
          {contents.map((item) => (
            <option key={item.id} value={item.id}>{item.title} · v{item.version}</option>
          ))}
        </select>
        <small>Só a versão aprovada entra na fila. Se a peça for editada, o dry-run reprova.</small>
      </label>
      <label className="field">
        <span>Canal</span>
        <select name="channel" defaultValue={channels[0]} key={contentId} required>
          {channels.map((channel) => <option key={channel} value={channel}>{channel}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Data e hora (Brasília)</span>
        <input name="scheduled_for" type="datetime-local" defaultValue={defaultWhen} required />
      </label>
      {state?.error ? <p className="feedback feedback-error field-wide" role="alert">{state.error}</p> : null}
      {state?.ok ? <p className="feedback feedback-ok field-wide" role="status">{state.ok}</p> : null}
      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={pending} aria-busy={pending}>{pending ? "Agendando…" : "Agendar (dry-run)"}</button>
        <span className="muted">Nenhuma publicação real é feita nesta fase.</span>
      </div>
    </form>
  );
}
