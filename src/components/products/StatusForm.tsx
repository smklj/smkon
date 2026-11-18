"use client";

import { useActionState } from "react";
import { setProductStatusAction, type FormState } from "@/app/(app)/produtos/actions";
import { PRODUCT_STATUSES, STATUS_LABEL, type ProductStatus } from "@/lib/products/types";

export function StatusForm({ productId, status }: { productId: string; status: ProductStatus }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setProductStatusAction, null);
  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="product_id" value={productId} />
      <label className="sr-only" htmlFor="product-status">Status do produto</label>
      <select id="product-status" name="status" defaultValue={status} disabled={pending}>
        {PRODUCT_STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABEL[value]}</option>)}
      </select>
      <button type="submit" className="button button-secondary button-small" disabled={pending}>{pending ? "Salvando…" : "Alterar status"}</button>
      {state?.error ? <span className="feedback feedback-error" role="alert">{state.error}</span> : null}
      {state?.ok ? <span className="muted" role="status">{state.ok}</span> : null}
    </form>
  );
}
