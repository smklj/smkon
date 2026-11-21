"use client";

import { useId, useState } from "react";
import { CONTENT_TEMPLATE_GROUPS, CONTENT_TEMPLATES, type ContentTemplate } from "@/lib/content/templates";

/**
 * Escolhe um modelo de partida para o rascunho. Se já houver texto escrito,
 * pede uma segunda confirmação antes de substituir.
 */
export function TemplatePicker({ hasWriting, disabled, onApply }: {
  hasWriting: boolean;
  disabled: boolean;
  onApply: (templateId: string) => void;
}) {
  const id = useId();
  const [templateId, setTemplateId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const groups = Object.keys(CONTENT_TEMPLATE_GROUPS) as ContentTemplate["group"][];

  function apply() {
    if (!templateId) return;
    if (hasWriting && !confirming) {
      setConfirming(true);
      return;
    }
    onApply(templateId);
    setConfirming(false);
    setTemplateId("");
  }

  return (
    <div className="template-picker">
      <label className="template-picker-field" htmlFor={`${id}-select`}>
        Começar de um modelo
      </label>
      <div className="template-picker-controls">
        <select
          id={`${id}-select`}
          value={templateId}
          onChange={(event) => {
            setTemplateId(event.target.value);
            setConfirming(false);
          }}
          disabled={disabled}
          aria-describedby={`${id}-hint`}
        >
          <option value="">Escolha um modelo</option>
          {groups.map((group) => (
            <optgroup key={group} label={CONTENT_TEMPLATE_GROUPS[group]}>
              {CONTENT_TEMPLATES.filter((template) => template.group === group).map((template) => (
                <option key={template.id} value={template.id}>{template.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <button type="button" className="button button-secondary" onClick={apply} disabled={disabled || !templateId}>
          {confirming ? "Confirmar substituição" : "Aplicar modelo"}
        </button>
        {confirming ? (
          <button type="button" className="button button-ghost" onClick={() => setConfirming(false)}>
            Cancelar
          </button>
        ) : null}
      </div>
      <p id={`${id}-hint`} className="studio-muted template-picker-hint">
        {confirming
          ? "O modelo substitui roteiro, legenda, CTA e hashtags deste rascunho."
          : "Usa o produto do rascunho. Troque o que estiver entre colchetes antes de aprovar."}
      </p>
    </div>
  );
}
