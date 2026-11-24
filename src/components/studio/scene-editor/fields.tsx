"use client";

import { useEffect, useId, useRef, useState } from "react";

/** Valor local que volta ao valor confirmado quando este muda (padrão do React, sem efeito). */
function useDraft<T>(value: T): [T, (next: T) => void] {
  const [draft, setDraft] = useState(value);
  const [base, setBase] = useState(value);
  if (!Object.is(base, value)) {
    setBase(value);
    setDraft(value);
  }
  return [draft, setDraft];
}

/**
 * Campos do painel de propriedades. Guardam o valor digitado localmente e só
 * confirmam (uma operação = um passo de desfazer) no Enter ou ao sair do campo.
 */

type NumberProps = {
  label: string;
  value: number | undefined;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
};

export function NumberField({ label, value, onCommit, min, max, step = 1, disabled }: NumberProps) {
  const id = useId();
  const [text, setText] = useDraft(value === undefined ? "" : String(value));

  function commit() {
    const parsed = Number(text.replace(",", "."));
    if (text.trim() === "" || !Number.isFinite(parsed)) {
      setText(value === undefined ? "" : String(value));
      return;
    }
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed));
    if (clamped !== value) onCommit(clamped);
    else setText(String(value));
  }

  return (
    <label className="scene-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={text}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
      />
    </label>
  );
}

type TextProps = {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  maxLength?: number;
  disabled?: boolean;
};

export function TextField({ label, value, onCommit, maxLength, disabled }: TextProps) {
  const id = useId();
  const [text, setText] = useDraft(value);
  const commit = () => {
    if (text !== value) onCommit(text);
  };
  return (
    <label className="scene-field scene-field-wide" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="text"
        value={text}
        maxLength={maxLength}
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
      />
    </label>
  );
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function ColorField({ label, value, onCommit, disabled }: { label: string; value: string | undefined; onCommit: (value: string) => void; disabled?: boolean }) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const current = value && HEX.test(value) ? value.toUpperCase() : "#000000";

  // React trata onChange do color como "input" (dispara a cada arrasto). O "change" nativo
  // só dispara quando o seletor fecha: um passo de desfazer por cor escolhida.
  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    const listener = () => {
      const picked = input.value.toUpperCase();
      if (HEX.test(picked) && picked !== current) onCommit(picked);
    };
    input.addEventListener("change", listener);
    return () => input.removeEventListener("change", listener);
  }, [current, onCommit]);

  return (
    <label className="scene-field" htmlFor={id}>
      <span>{label}</span>
      <input ref={ref} id={id} type="color" defaultValue={current} key={current} disabled={disabled} />
    </label>
  );
}

export function SelectField<T extends string | number>({
  label,
  value,
  options,
  onCommit,
  disabled,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onCommit: (value: T) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label className="scene-field" htmlFor={id}>
      <span>{label}</span>
      <select
        id={id}
        value={String(value)}
        disabled={disabled}
        onChange={(event) => {
          const picked = options.find((option) => String(option.value) === event.target.value);
          if (picked && picked.value !== value) onCommit(picked.value);
        }}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
