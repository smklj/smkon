"use client";

import { useActionState } from "react";
import { recordLicenseAction, type MediaState } from "@/app/(app)/midia/actions";
import { LICENSE_TYPE_LABEL, LICENSE_TYPES } from "@/lib/media/types";

export function LicenseForm({ mediaId, mediaName, today }: { mediaId: string; mediaName: string; today: string }) {
  const [state, action, pending] = useActionState<MediaState, FormData>(recordLicenseAction, null);
  return (
    <details className="stack-top">
      <summary className="link">Registrar licença</summary>
      <form action={action} className="form-grid stack-top" key={state?.at ?? 0} aria-label={`Licença de ${mediaName}`}>
        <input type="hidden" name="media_id" value={mediaId} />
        <label className="field">
          <span>Tipo de licença</span>
          <select name="license_type" defaultValue="own_production">
            {LICENSE_TYPES.map((type) => <option key={type} value={type}>{LICENSE_TYPE_LABEL[type]}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Quem concede</span>
          <input name="licensor" required minLength={2} maxLength={200} placeholder="Ex.: equipe própria, @criador, agência" />
        </label>
        <label className="field field-wide">
          <span>Link da comprovação (https)</span>
          <input name="proof_url" type="url" inputMode="url" maxLength={2048} placeholder="https:// contrato, autorização ou página da licença" />
          <small>Obrigatório, exceto para produção própria.</small>
        </label>
        <label className="field">
          <span>Válida desde</span>
          <input name="valid_from" type="date" defaultValue={today} required />
        </label>
        <label className="field">
          <span>Válida até (opcional)</span>
          <input name="valid_until" type="date" />
        </label>
        <label className="field">
          <span>Território</span>
          <input name="territory" defaultValue="Mundial" maxLength={100} />
        </label>
        <div className="field">
          <span>Permissões</span>
          <label className="inline-form"><input type="checkbox" name="allows_commercial_use" defaultChecked /> Uso comercial</label>
          <label className="inline-form"><input type="checkbox" name="allows_modification" defaultChecked /> Permite edição</label>
        </div>
        <label className="field field-wide">
          <span>Observações (opcional)</span>
          <textarea name="notes" rows={2} maxLength={1000} />
        </label>
        {state?.error ? <p className="feedback feedback-error field-wide" role="alert">{state.error}</p> : null}
        {state?.ok ? <p className="feedback feedback-ok field-wide" role="status">{state.ok}</p> : null}
        <div className="form-actions">
          <button type="submit" className="button button-secondary" disabled={pending} aria-busy={pending}>{pending ? "Salvando…" : "Salvar licença"}</button>
          <span className="muted">Licenças não são editadas. Para corrigir, revogue e registre outra.</span>
        </div>
      </form>
    </details>
  );
}
