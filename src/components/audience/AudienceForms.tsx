"use client";

import { useActionState, useState } from "react";
import { useActionFeedback } from "@/components/ui/Toaster";
import {
  anonymizeContactAction,
  createContactAction,
  recordConsentAction,
  registerRequestAction,
  resolveRequestAction,
  revokeAllAction,
  updateContactAction,
  type AudienceState,
} from "@/app/(app)/audiencia/actions";
import {
  ANONYMIZE_CONFIRMATION,
  BASES_BY_PURPOSE,
  CHANNEL_LABEL,
  CONSENT_CHANNELS,
  CONTACT_SOURCES,
  EVIDENCE_LABEL,
  EVIDENCE_TYPES,
  LEGAL_BASIS_LABEL,
  OPT_OUT_ONLY_EVIDENCE,
  PURPOSE_LABEL,
  PURPOSES,
  REQUEST_CHANNEL_LABEL,
  REQUEST_CHANNELS,
  REQUEST_KIND_LABEL,
  REQUEST_KINDS,
  SOURCE_LABEL,
  type ContactRow,
  type LegalBasis,
  type Purpose,
  type RequestKind,
} from "@/lib/audience/types";

function Feedback({ state, wide = true }: { state: AudienceState; wide?: boolean }) {
  if (state?.error) return <p className={`feedback feedback-error${wide ? " field-wide" : ""}`} role="alert">{state.error}</p>;
  if (state?.ok) return <p className={`feedback feedback-ok${wide ? " field-wide" : ""}`} role="status">{state.ok}</p>;
  return null;
}

/** Finalidade e base legal: a lista de bases segue a finalidade escolhida (mesma regra do banco). */
function PurposeBasis({ purpose: initialPurpose, basis: initialBasis, onBasis }: {
  purpose: Purpose;
  basis: LegalBasis;
  onBasis?: (basis: LegalBasis) => void;
}) {
  const [purpose, setPurpose] = useState<Purpose>(initialPurpose);
  const allowed = BASES_BY_PURPOSE[purpose];
  const [basis, setBasis] = useState<LegalBasis>(allowed.includes(initialBasis) ? initialBasis : allowed[0]);
  const choose = (next: LegalBasis) => {
    setBasis(next);
    onBasis?.(next);
  };
  return (
    <>
      <label className="field">
        <span>Finalidade</span>
        <select
          name="purpose"
          value={purpose}
          onChange={(event) => {
            const next = event.target.value as Purpose;
            setPurpose(next);
            if (!BASES_BY_PURPOSE[next].includes(basis)) choose(BASES_BY_PURPOSE[next][0]);
          }}
        >
          {PURPOSES.map((item) => <option key={item} value={item}>{PURPOSE_LABEL[item]}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Base legal (LGPD, art. 7º)</span>
        <select name="legal_basis" value={basis} onChange={(event) => choose(event.target.value as LegalBasis)}>
          {allowed.map((item) => <option key={item} value={item}>{LEGAL_BASIS_LABEL[item]}</option>)}
        </select>
      </label>
    </>
  );
}

function EvidenceFields({ optIn, idPrefix }: { optIn: boolean; idPrefix: string }) {
  const types = optIn ? EVIDENCE_TYPES.filter((type) => !OPT_OUT_ONLY_EVIDENCE.includes(type)) : EVIDENCE_TYPES;
  return (
    <>
      <label className="field">
        <span>Evidência</span>
        <select name="evidence_type" defaultValue={optIn ? "form_checkbox" : "titular_request"} key={`${idPrefix}-${optIn}`}>
          {types.map((type) => <option key={type} value={type}>{EVIDENCE_LABEL[type]}</option>)}
        </select>
      </label>
      <label className="field field-wide">
        <span>Referência da evidência {optIn ? "" : "(opcional)"}</span>
        <input
          name="evidence_ref"
          required={optIn}
          minLength={3}
          maxLength={500}
          placeholder={optIn ? "Ex.: formulário da landing de novembro, caixa não pré-marcada; ID da confirmação" : "Ex.: respondeu SAIR no WhatsApp"}
        />
        <small>Onde e como foi dado. É a prova exigida pela LGPD (art. 8º, §2º). Evite dados pessoais aqui.</small>
      </label>
    </>
  );
}

export function NewContactForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState<AudienceState, FormData>(createContactAction, null);
  const [basis, setBasis] = useState<LegalBasis>("consent");
  const needsConsent = basis === "consent";
  return (
    <form action={action} className="form-grid" aria-label="Novo contato">
      <label className="field">
        <span>Nome (opcional)</span>
        <input name="display_name" maxLength={120} autoComplete="off" />
      </label>
      <label className="field">
        <span>E-mail</span>
        <input name="email" type="email" maxLength={254} autoComplete="off" />
      </label>
      <label className="field">
        <span>Telefone</span>
        <input name="phone" type="tel" inputMode="tel" maxLength={25} placeholder="+55 11 99999-0000" autoComplete="off" />
        <small>Informe e-mail ou telefone. Só o necessário para o contato.</small>
      </label>
      <label className="field">
        <span>Origem</span>
        <select name="source" defaultValue="form">
          {CONTACT_SOURCES.map((source) => <option key={source} value={source}>{SOURCE_LABEL[source]}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Detalhe da origem (opcional)</span>
        <input name="source_detail" maxLength={200} placeholder="Ex.: formulário da landing de novembro" />
      </label>
      <PurposeBasis purpose="newsletter" basis="consent" onBasis={setBasis} />
      {needsConsent ? (
        <fieldset className="field field-wide">
          <legend>Consentimento inicial (obrigatório para base consentimento)</legend>
          <div className="form-grid">
            <label className="field">
              <span>Canal</span>
              <select name="consent_channel" defaultValue="email">
                {CONSENT_CHANNELS.map((channel) => <option key={channel} value={channel}>{CHANNEL_LABEL[channel]}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Data do consentimento</span>
              <input name="consent_occurred_at" type="date" defaultValue={today} max={today} />
            </label>
            <EvidenceFields optIn idPrefix="new" />
          </div>
        </fieldset>
      ) : null}
      <Feedback state={state} />
      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={pending} aria-busy={pending}>{pending ? "Salvando…" : "Cadastrar contato"}</button>
        <span className="muted">Nenhuma mensagem é enviada a partir do SMKON.</span>
      </div>
    </form>
  );
}

export function CorrectionForm({ contact }: { contact: ContactRow }) {
  const [state, action, pending] = useActionState<AudienceState, FormData>(updateContactAction, null);
  const feedbackRef = useActionFeedback(state);
  return (
    <details className="stack-top">
      <summary className="link">Corrigir dados</summary>
      <form ref={feedbackRef} action={action} className="form-grid stack-top" aria-label="Corrigir dados do contato">
        <input type="hidden" name="contact_id" value={contact.id} />
        <label className="field">
          <span>Nome</span>
          <input name="display_name" maxLength={120} defaultValue={contact.display_name ?? ""} autoComplete="off" />
        </label>
        <label className="field">
          <span>E-mail</span>
          <input name="email" type="email" maxLength={254} defaultValue={contact.email ?? ""} autoComplete="off" />
        </label>
        <label className="field">
          <span>Telefone</span>
          <input name="phone" type="tel" maxLength={25} defaultValue={contact.phone ?? ""} autoComplete="off" />
        </label>
        <PurposeBasis purpose={contact.purpose} basis={contact.legal_basis} />
        <Feedback state={state} />
        <div className="form-actions">
          <button type="submit" className="button button-secondary" disabled={pending} aria-busy={pending}>{pending ? "Salvando…" : "Salvar correção"}</button>
        </div>
      </form>
    </details>
  );
}

export function ConsentForm({ contactId, today }: { contactId: string; today: string }) {
  const [state, action, pending] = useActionState<AudienceState, FormData>(recordConsentAction, null);
  const feedbackRef = useActionFeedback(state);
  const [optIn, setOptIn] = useState(true);
  return (
    <form ref={feedbackRef} action={action} className="form-grid" key={state?.at ?? 0} aria-label="Registrar consentimento ou revogação">
      <input type="hidden" name="contact_id" value={contactId} />
      <label className="field">
        <span>Registro</span>
        <select name="action" value={optIn ? "opt_in" : "opt_out"} onChange={(event) => setOptIn(event.target.value === "opt_in")}>
          <option value="opt_in">Consentimento (opt-in)</option>
          <option value="opt_out">Revogação (opt-out)</option>
        </select>
      </label>
      <label className="field">
        <span>Finalidade</span>
        <select name="purpose" defaultValue="marketing">
          {PURPOSES.map((item) => <option key={item} value={item}>{PURPOSE_LABEL[item]}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Canal</span>
        <select name="channel" defaultValue="email">
          {CONSENT_CHANNELS.map((channel) => <option key={channel} value={channel}>{CHANNEL_LABEL[channel]}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Data do fato</span>
        <input name="occurred_at" type="date" defaultValue={today} max={today} />
      </label>
      <EvidenceFields optIn={optIn} idPrefix={`consent-${contactId}`} />
      <Feedback state={state} />
      <div className="form-actions">
        <button type="submit" className="button button-secondary" disabled={pending} aria-busy={pending}>
          {pending ? "Registrando…" : optIn ? "Registrar consentimento" : "Registrar revogação"}
        </button>
        <span className="muted">O histórico não é editado: uma revogação é um registro novo.</span>
      </div>
    </form>
  );
}

export function RevokeAllForm({ contactId }: { contactId: string }) {
  const [state, action, pending] = useActionState<AudienceState, FormData>(revokeAllAction, null);
  const feedbackRef = useActionFeedback(state);
  return (
    <form ref={feedbackRef} action={action} className="inline-form" aria-label="Revogar todos os consentimentos">
      <input type="hidden" name="contact_id" value={contactId} />
      <input type="hidden" name="evidence_type" value="titular_request" />
      <label className="sr-only" htmlFor={`revoke-all-${contactId}`}>Como o titular pediu</label>
      <input id={`revoke-all-${contactId}`} name="evidence_ref" maxLength={500} placeholder="Como o titular pediu (opcional)" disabled={pending} />
      <button type="submit" className="button button-danger button-small" disabled={pending} aria-busy={pending}>Revogar tudo</button>
      {state?.error ? <span className="feedback feedback-error" role="alert">{state.error}</span> : null}
    </form>
  );
}

export function RequestForm({ contactId, today }: { contactId: string; today: string }) {
  const [state, action, pending] = useActionState<AudienceState, FormData>(registerRequestAction, null);
  const feedbackRef = useActionFeedback(state);
  return (
    <details className="stack-top">
      <summary className="link">Registrar pedido do titular</summary>
      <form ref={feedbackRef} action={action} className="form-grid stack-top" key={state?.at ?? 0} aria-label="Registrar pedido do titular">
        <input type="hidden" name="contact_id" value={contactId} />
        <label className="field">
          <span>Pedido</span>
          <select name="kind" defaultValue="access">
            {REQUEST_KINDS.map((kind) => <option key={kind} value={kind}>{REQUEST_KIND_LABEL[kind]}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Recebido por</span>
          <select name="received_via" defaultValue="email">
            {REQUEST_CHANNELS.map((channel) => <option key={channel} value={channel}>{REQUEST_CHANNEL_LABEL[channel]}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Recebido em</span>
          <input name="received_at" type="date" defaultValue={today} max={today} />
          <small>O prazo de 15 dias conta a partir desta data.</small>
        </label>
        <label className="field field-wide">
          <span>O que foi pedido (opcional)</span>
          <textarea name="details" rows={2} maxLength={1000} />
          <small>Este texto é apagado se o contato for excluído.</small>
        </label>
        <Feedback state={state} />
        <div className="form-actions">
          <button type="submit" className="button button-secondary" disabled={pending} aria-busy={pending}>{pending ? "Registrando…" : "Registrar pedido"}</button>
        </div>
      </form>
    </details>
  );
}

export function ResolveRequestForm({ requestId, kind }: { requestId: string; kind: RequestKind }) {
  const [state, action, pending] = useActionState<AudienceState, FormData>(resolveRequestAction, null);
  const feedbackRef = useActionFeedback(state);
  const [status, setStatus] = useState<"completed" | "rejected">("completed");
  const deletes = kind === "deletion" && status === "completed";
  return (
    <form ref={feedbackRef} action={action} className="inline-form" aria-label="Resolver pedido do titular">
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="kind" value={kind} />
      <label className="sr-only" htmlFor={`status-${requestId}`}>Decisão</label>
      <select id={`status-${requestId}`} name="status" value={status} onChange={(event) => setStatus(event.target.value as "completed" | "rejected")} disabled={pending}>
        <option value="completed">{kind === "deletion" ? "Concluir (excluir dados)" : "Concluir"}</option>
        <option value="rejected">Recusar</option>
      </select>
      <label className="sr-only" htmlFor={`note-${requestId}`}>Nota</label>
      <input
        id={`note-${requestId}`}
        name="note"
        maxLength={1000}
        required={status === "rejected"}
        placeholder={status === "rejected" ? "Motivo da recusa (sem dados pessoais)" : "Nota (opcional, sem dados pessoais)"}
        disabled={pending}
      />
      {deletes ? (
        <>
          <label className="sr-only" htmlFor={`confirm-${requestId}`}>Digite {ANONYMIZE_CONFIRMATION}</label>
          <input id={`confirm-${requestId}`} name="confirmation" required placeholder={`Digite ${ANONYMIZE_CONFIRMATION}`} autoComplete="off" disabled={pending} />
        </>
      ) : null}
      <button type="submit" className={`button button-small ${deletes ? "button-danger" : "button-secondary"}`} disabled={pending} aria-busy={pending}>
        Resolver
      </button>
      {state?.error ? <span className="feedback feedback-error" role="alert">{state.error}</span> : null}
    </form>
  );
}

export function AnonymizeForm({ contactId }: { contactId: string }) {
  const [state, action, pending] = useActionState<AudienceState, FormData>(anonymizeContactAction, null);
  const feedbackRef = useActionFeedback(state);
  return (
    <details className="stack-top">
      <summary className="link">Excluir dados pessoais</summary>
      <form ref={feedbackRef} action={action} className="form-grid stack-top" aria-label="Excluir dados pessoais do contato">
        <input type="hidden" name="contact_id" value={contactId} />
        <p className="muted field-wide">
          Nome, e-mail, telefone, detalhe da origem, referências de evidência e texto dos pedidos são apagados de forma
          irreversível. Os consentimentos ativos são revogados. Ficam só o registro anonimizado e o histórico, para auditoria.
        </p>
        <label className="field field-wide">
          <span>Motivo (sem dados pessoais)</span>
          <input name="reason" required minLength={3} maxLength={1000} placeholder="Ex.: pedido do titular por e-mail" />
        </label>
        <label className="field">
          <span>Digite {ANONYMIZE_CONFIRMATION} para confirmar</span>
          <input name="confirmation" required autoComplete="off" />
        </label>
        <Feedback state={state} />
        <div className="form-actions">
          <button type="submit" className="button button-danger" disabled={pending} aria-busy={pending}>{pending ? "Excluindo…" : "Excluir dados pessoais"}</button>
        </div>
      </form>
    </details>
  );
}
