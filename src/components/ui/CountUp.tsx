"use client";

import { useEffect, useRef } from "react";

const integer = new Intl.NumberFormat("pt-BR");

/**
 * Número que conta de 0 até o valor na primeira exibição. O HTML do servidor já traz o valor final
 * (sem JavaScript ou com movimento reduzido, nada anima); a animação só reescreve o texto do nó.
 */
export function CountUp({ value, duration = 700 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || value <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = integer.format(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      node.textContent = integer.format(value);
    };
  }, [value, duration]);

  return <span ref={ref}>{integer.format(value)}</span>;
}
