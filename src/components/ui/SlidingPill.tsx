"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

export type SlidingPillOrientation = "vertical" | "horizontal";

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type UseSlidingPillOptions = {
  activeKey: string | null;
  orientation?: SlidingPillOrientation;
};

/**
 * Controla uma cápsula luminosa deslizante (GSAP + clip-path + ResizeObserver + rAF)
 * em duas etapas (avanço + acabamento líquido), interrompendo tweens anteriores em cliques rápidos.
 */
export function useSlidingPill({ activeKey, orientation = "vertical" }: UseSlidingPillOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const sheenRef = useRef<HTMLDivElement | null>(null);
  const prevRectRef = useRef<Rect | null>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const pill = pillRef.current;
    const sheen = sheenRef.current;
    if (!container || !pill) return;

    const measureActive = (): Rect | null => {
      if (!activeKey) return null;
      const target = container.querySelector<HTMLElement>(`[data-sliding-key="${CSS.escape(activeKey)}"]`);
      if (!target) return null;

      const cRect = container.getBoundingClientRect();
      const tRect = target.getBoundingClientRect();
      if (tRect.width === 0 || tRect.height === 0) return null;

      return {
        x: tRect.left - cRect.left,
        y: tRect.top - cRect.top,
        width: tRect.width,
        height: tRect.height,
      };
    };

    const applyImmediate = (rect: Rect) => {
      timelineRef.current?.kill();
      gsap.killTweensOf([pill, sheen].filter(Boolean));
      gsap.set(pill, {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        opacity: 1,
      });
      if (sheen) {
        gsap.set(sheen, {
          clipPath: "inset(0% 0% 0% 0% round 10px)",
          opacity: 1,
        });
      }
      prevRectRef.current = rect;
    };

    const animateTo = (rect: Rect) => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const prev = prevRectRef.current;

      if (reduced || !prev) {
        applyImmediate(rect);
        return;
      }

      if (
        Math.abs(prev.x - rect.x) < 0.5 &&
        Math.abs(prev.y - rect.y) < 0.5 &&
        Math.abs(prev.width - rect.width) < 0.5 &&
        Math.abs(prev.height - rect.height) < 0.5
      ) {
        return;
      }

      timelineRef.current?.kill();
      gsap.killTweensOf([pill, sheen].filter(Boolean));

      const tl = gsap.timeline();
      timelineRef.current = tl;

      if (orientation === "vertical") {
        const movingDown = rect.y >= prev.y;
        const stretchTop = movingDown ? prev.y : rect.y;
        const stretchHeight = movingDown
          ? rect.y + rect.height - prev.y
          : prev.y + prev.height - rect.y;

        // Etapa 1: avanço líquido na direção do alvo (0.36s, power3.out)
        tl.to(
          pill,
          {
            x: rect.x,
            y: stretchTop,
            width: rect.width,
            height: Math.min(stretchHeight, Math.max(rect.height * 1.45, stretchHeight * 0.72)),
            opacity: 1,
            duration: 0.24,
            ease: "power3.out",
          },
          0,
        );

        if (sheen) {
          tl.fromTo(
            sheen,
            {
              clipPath: movingDown
                ? "inset(0% 0% 42% 0% round 10px)"
                : "inset(42% 0% 0% 0% round 10px)",
              opacity: 0.95,
            },
            {
              clipPath: "inset(0% 0% 0% 0% round 10px)",
              opacity: 1,
              duration: 0.36,
              ease: "power3.out",
            },
            0,
          );
        }

        // Etapa 2: acabamento e acomodação exata no item destino (0.48s, power3.inOut)
        tl.to(
          pill,
          {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            duration: 0.34,
            ease: "power3.inOut",
          },
          0.14,
        );
      } else {
        const movingRight = rect.x >= prev.x;
        const stretchLeft = movingRight ? prev.x : rect.x;
        const stretchWidth = movingRight
          ? rect.x + rect.width - prev.x
          : prev.x + prev.width - rect.x;

        // Etapa 1: avanço horizontal (0.36s, power3.out)
        tl.to(
          pill,
          {
            x: stretchLeft,
            y: rect.y,
            width: Math.min(stretchWidth, Math.max(rect.width * 1.35, stretchWidth * 0.72)),
            height: rect.height,
            opacity: 1,
            duration: 0.24,
            ease: "power3.out",
          },
          0,
        );

        if (sheen) {
          tl.fromTo(
            sheen,
            {
              clipPath: movingRight
                ? "inset(0% 38% 0% 0% round 10px)"
                : "inset(0% 0% 0% 38% round 10px)",
              opacity: 0.95,
            },
            {
              clipPath: "inset(0% 0% 0% 0% round 10px)",
              opacity: 1,
              duration: 0.36,
              ease: "power3.out",
            },
            0,
          );
        }

        // Etapa 2: acabamento exato no destino (0.55s total com sobreposição, power3.inOut)
        tl.to(
          pill,
          {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            duration: 0.34,
            ease: "power3.inOut",
          },
          0.14,
        );
      }

      prevRectRef.current = rect;
    };

    let rafId = window.requestAnimationFrame(() => {
      const rect = measureActive();
      if (!rect) {
        gsap.set(pill, { opacity: 0 });
        prevRectRef.current = null;
        return;
      }
      animateTo(rect);
    });

    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        const rect = measureActive();
        if (rect) applyImmediate(rect);
      });
    });

    observer.observe(container);

    return () => {
      window.cancelAnimationFrame(rafId);
      observer.disconnect();
      timelineRef.current?.kill();
    };
  }, [activeKey, orientation]);

  return { containerRef, pillRef, sheenRef };
}
