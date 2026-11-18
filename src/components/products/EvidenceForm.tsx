"use client";

import { useActionState, useState } from "react";
import { addEvidenceAction, type FormState } from "@/app/(app)/produtos/actions";
import { EVIDENCE_KIND_META, EVIDENCE_KINDS, type EvidenceKind } from "@/lib/products/types";

export function EvidenceForm({ productId, today }: { productId: string; today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addEvidenceAction, null);
  const [kind, setKind] = useState<EvidenceKind>("sales_page");
  const meta = EVIDENCE_KIND_META[kind];

  return (
    <form action={action} className="form-grid" key={state?.at ?? 0}>
      <input type="hidden" name="product_id" value={productId} />
      <label className="field">
        <span>Tipo de evidência</span>
        <select name="kind" value={kind} onChange={(event) => setKind(event.target.value as EvidenceKind)}>
          {EVIDENCE_KINDS.map((value) => <option key={value} value={value}>{EVIDENCE_KIND_META[value].label}</option>)}
        </select>
        <small>{meta.hint}</small>
      </label>
      <label className="field">
        <span>Observada em</span>
        <input name="observed_at" type="date" max={today} defaultValue={today} required />
      </label>
      <label className="field field-wide">
        <span>O que a fonte mostra</span>
        <textarea name="claim" required minLength={3} maxLength={500} rows={2} placeholder="Ex.: Página exibe comissão de 40% para afiliados" />
      </label>
      <label className="field field-wide">
        <span>Link da fonte (https)</span>
        <input name="source_url" type="url" inputMode="url" required placeholder="https://" maxLength={2048} />
      </label>
      {meta.value !== "none" ? (
        <label className="field">
          <span>Valor ({meta.unit}){meta.value === "optional" ? " — opcional" : ""}</span>
          <input name="value" inputMode="decimal" required={meta.value === "required"} placeholder={`${meta.min}–${meta.max}`} />
        </label>
      ) : null}
      {state?.error ? <p className="feedback feedback-error field-wide" role="alert">{state.error}</p> : null}
      {state?.ok ? <p className="feedback feedback-ok field-wide" role="status">{state.ok}</p> : null}
      <div className="form-actions">
        <button type="submit" className="button button-secondary" disabled={pending}>{pending ? "Registrando…" : "Registrar evidência"}</button>
        <span className="muted">Evidências não podem ser editadas depois. Para corrigir, registre outra.</span>
      </div>
    </form>
  );
}
