"use client";

import { useActionState } from "react";
import { createProductAction, type FormState } from "@/app/(app)/produtos/actions";
import {
  PRODUCT_SOURCES,
  PRODUCT_TYPES,
  REVENUE_DOMAINS,
  REVENUE_DOMAIN_LABEL,
  SOURCE_LABEL,
  TYPE_LABEL,
} from "@/lib/products/types";

export function ProductForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createProductAction, null);
  return (
    <form action={action} className="form-grid">
      <label className="field field-wide">
        <span>Nome do produto</span>
        <input name="name" required maxLength={200} placeholder="Ex.: Curso de copywriting" />
      </label>
      <label className="field">
        <span>Fonte</span>
        <select name="source" defaultValue="hotmart">
          {PRODUCT_SOURCES.map((value) => <option key={value} value={value}>{SOURCE_LABEL[value]}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Domínio de receita</span>
        <select name="revenue_domain" defaultValue="affiliate">
          {REVENUE_DOMAINS.map((value) => <option key={value} value={value}>{REVENUE_DOMAIN_LABEL[value]}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Tipo</span>
        <select name="type" defaultValue="info">
          {PRODUCT_TYPES.map((value) => <option key={value} value={value}>{TYPE_LABEL[value]}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Link de afiliado (opcional)</span>
        <input name="affiliate_url" type="url" inputMode="url" placeholder="https://" maxLength={2048} />
      </label>
      <label className="field">
        <span>Preço informado (opcional)</span>
        <input name="price" inputMode="decimal" placeholder="197,00" />
        <small>Referência. O score só usa preço verificado em evidência.</small>
      </label>
      <label className="field">
        <span>Comissão informada % (opcional)</span>
        <input name="commission_percent" inputMode="decimal" placeholder="40" />
        <small>Referência. O score só usa comissão verificada.</small>
      </label>
      {state?.error ? <p className="feedback feedback-error field-wide" role="alert">{state.error}</p> : null}
      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={pending} aria-busy={pending}>{pending ? "Salvando…" : "Cadastrar produto"}</button>
        <span className="muted">O produto nasce sem score até ter evidências verificadas.</span>
      </div>
    </form>
  );
}
