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
  /** Disparado no pointerdown e durante o arrasto sobre itens da trilha. */
  onScrubKey?: (key: string | null) => void;
  /** Disparado ao soltar o ponteiro em um item (ex.: trocar aba ou navegar). */
  onCommitKey?: (key: string) => void;
};

/**
 * Controla uma cápsula luminosa deslizante (GSAP + clip-path + ResizeObserver + rAF)
 * com física líquida em duas etapas e suporte fluido a pressionar e arrastar com o mouse.
 */
export function useSlidingPill({
  activeKey,
  orientation = "vertical",
  onScrubKey,
  onCommitKey,
}: UseSlidingPillOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const sheenRef = useRef<HTMLDivElement | null>(null);

  const prevRectRef = useRef<Rect | null>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const activeKeyRef = useRef<string | null>(activeKey);
  const isScrubbingRef = useRef(false);
  const containerSizeRef = useRef<{ width: number; height: number } | null>(null);

  const onScrubRef = useRef(onScrubKey);
  const onCommitRef = useRef(onCommitKey);

  useEffect(() => {
    activeKeyRef.current = activeKey;
    onScrubRef.current = onScrubKey;
    onCommitRef.current = onCommitKey;
  }, [activeKey, onScrubKey, onCommitKey]);

  const measureElement = (container: HTMLElement, target: HTMLElement): Rect | null => {
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

  const measureKey = (key: string | null): Rect | null => {
    const container = containerRef.current;
    if (!container || !key) return null;
    const target = container.querySelector<HTMLElement>(`[data-sliding-key="${CSS.escape(key)}"]`);
    if (!target) return null;
    return measureElement(container, target);
  };

  const applyImmediate = (rect: Rect) => {
    const pill = pillRef.current;
    const sheen = sheenRef.current;
    if (!pill) return;

    timelineRef.current?.kill();
    gsap.killTweensOf([pill, sheen].filter(Boolean));
    gsap.set(pill, {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      force3D: true,
    });
    if (sheen) {
      gsap.set(sheen, {
        clipPath: "inset(0% 0% 0% 0% round 10px)",
        opacity: 1,
      });
    }
    prevRectRef.current = rect;
  };

  const animateTo = (rect: Rect, fastPress = false) => {
    const pill = pillRef.current;
    const sheen = sheenRef.current;
    if (!pill) return;

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

    const speedFactor = fastPress ? 0.72 : 1;

    if (orientation === "vertical") {
      const distance = Math.abs(rect.y - prev.y);
      const movingDown = rect.y >= prev.y;
      const overshoot = Math.min(26, Math.max(8, distance * 0.24));
      const advanceDuration = Math.min(0.28, Math.max(0.15, (0.14 + distance * 0.0005) * speedFactor));
      const settleDuration = Math.min(0.42, Math.max(0.24, (0.24 + distance * 0.00055) * speedFactor));

      // Etapa 1: avanço fluido com leve estiramento líquido na direção do movimento
      tl.to(
        pill,
        {
          x: rect.x,
          y: movingDown ? rect.y - Math.min(overshoot * 0.5, distance * 0.35) : rect.y,
          width: rect.width,
          height: rect.height + Math.min(overshoot, distance * 0.45),
          scaleX: fastPress ? 0.975 : 1,
          scaleY: fastPress ? 0.985 : 1,
          opacity: 1,
          duration: advanceDuration,
          ease: "power3.out",
          force3D: true,
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
            duration: advanceDuration + 0.12,
            ease: "power3.out",
          },
          0,
        );
      }

      // Etapa 2: assentamento orgânico na posição exata do destino
      tl.to(
        pill,
        {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          scaleX: fastPress ? 0.98 : 1,
          scaleY: fastPress ? 0.975 : 1,
          duration: settleDuration,
          ease: "power3.out",
          force3D: true,
        },
        advanceDuration * 0.55,
      );
    } else {
      const distance = Math.abs(rect.x - prev.x);
      const movingRight = rect.x >= prev.x;
      const overshoot = Math.min(34, Math.max(10, distance * 0.22));
      const advanceDuration = Math.min(0.28, Math.max(0.15, (0.14 + distance * 0.00045) * speedFactor));
      const settleDuration = Math.min(0.42, Math.max(0.24, (0.24 + distance * 0.0005) * speedFactor));

      tl.to(
        pill,
        {
          x: movingRight ? rect.x - Math.min(overshoot * 0.5, distance * 0.35) : rect.x,
          y: rect.y,
          width: rect.width + Math.min(overshoot, distance * 0.42),
          height: rect.height,
          scaleX: fastPress ? 0.985 : 1,
          scaleY: fastPress ? 0.97 : 1,
          opacity: 1,
          duration: advanceDuration,
          ease: "power3.out",
          force3D: true,
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
            duration: advanceDuration + 0.12,
            ease: "power3.out",
          },
          0,
        );
      }

      tl.to(
        pill,
        {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          scaleX: fastPress ? 0.985 : 1,
          scaleY: fastPress ? 0.975 : 1,
          duration: settleDuration,
          ease: "power3.out",
          force3D: true,
        },
        advanceDuration * 0.55,
      );
    }

    prevRectRef.current = rect;
  };

  // Sincronização normal com mudança de activeKey (quando não está sendo arrastado)
  useEffect(() => {
    const pill = pillRef.current;
    if (!pill) return;

    if (isScrubbingRef.current) return;

    const rafId = window.requestAnimationFrame(() => {
      const rect = measureKey(activeKey);
      if (!rect) {
        gsap.set(pill, { opacity: 0 });
        prevRectRef.current = null;
        return;
      }
      animateTo(rect, false);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, orientation]);

  // ResizeObserver isolado: só reposiciona quando as dimensões reais do container mudam
  useEffect(() => {
    const container = containerRef.current;
    const pill = pillRef.current;
    if (!container || !pill) return;

    const initRect = container.getBoundingClientRect();
    containerSizeRef.current = { width: initRect.width, height: initRect.height };

    let resizeRaf = 0;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextW = entry.contentRect.width;
      const nextH = entry.contentRect.height;
      const prevSize = containerSizeRef.current;

      if (!prevSize) {
        containerSizeRef.current = { width: nextW, height: nextH };
        return;
      }

      if (Math.abs(nextW - prevSize.width) < 1.5 && Math.abs(nextH - prevSize.height) < 1.5) {
        return;
      }

      containerSizeRef.current = { width: nextW, height: nextH };
      window.cancelAnimationFrame(resizeRaf);
      resizeRaf = window.requestAnimationFrame(() => {
        if (isScrubbingRef.current) return;
        const rect = measureKey(activeKeyRef.current);
        if (rect) applyImmediate(rect);
      });
    });

    observer.observe(container);

    return () => {
      window.cancelAnimationFrame(resizeRaf);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orientation]);

  // Interação mouse press + arrasto contínuo ("deslizar enquanto aperta com o mouse")
  useEffect(() => {
    const container = containerRef.current;
    const pill = pillRef.current;
    const sheen = sheenRef.current;
    if (!container || !pill) return;

    const findNearestItem = (clientX: number, clientY: number): HTMLElement | null => {
      const items = Array.from(container.querySelectorAll<HTMLElement>("[data-sliding-key]"));
      if (items.length === 0) return null;

      // Verifica acerto direto primeiro
      const directEl = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-sliding-key]");
      if (directEl && container.contains(directEl)) {
        return directEl;
      }

      // Caso passe no espaço entre itens, encontra o item mais próximo no eixo da barra
      let closest: HTMLElement | null = null;
      let minDistance = Number.POSITIVE_INFINITY;
      for (const el of items) {
        const r = el.getBoundingClientRect();
        if (orientation === "vertical") {
          const centerY = r.top + r.height / 2;
          const d = Math.abs(clientY - centerY);
          if (d < minDistance) {
            minDistance = d;
            closest = el;
          }
        } else {
          const centerX = r.left + r.width / 2;
          const d = Math.abs(clientX - centerX);
          if (d < minDistance) {
            minDistance = d;
            closest = el;
          }
        }
      }
      return closest;
    };

    const preventNativeDrag = (ev: DragEvent) => {
      ev.preventDefault();
    };

    const handlePointerDown = (downEvent: PointerEvent) => {
      if (downEvent.button !== 0) return;

      const startEl = (downEvent.target as HTMLElement | null)?.closest<HTMLElement>("[data-sliding-key]");
      if (!startEl || !container.contains(startEl)) return;

      const startKey = startEl.getAttribute("data-sliding-key");
      if (!startKey) return;

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const startX = downEvent.clientX;
      const startY = downEvent.clientY;
      let hasDragged = false;
      let currentKey = startKey;
      let lastPointerCoord = orientation === "vertical" ? startY : startX;

      isScrubbingRef.current = true;
      pill.dataset.pressing = "true";

      const startRect = measureElement(container, startEl);
      if (startRect) {
        animateTo(startRect, true);
      }
      onScrubRef.current?.(startKey);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if ((moveEvent.buttons & 1) === 0 && moveEvent.pointerType === "mouse") return;

        const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
        if (dist > 4) {
          hasDragged = true;
        }

        const cRect = container.getBoundingClientRect();
        const nearest = findNearestItem(moveEvent.clientX, moveEvent.clientY);
        const nearestKey = nearest?.getAttribute("data-sliding-key") || null;

        if (nearestKey && nearestKey !== currentKey) {
          currentKey = nearestKey;
          onScrubRef.current?.(nearestKey);
        }

        if (reduced || !nearest) return;

        const itemRect = measureElement(container, nearest);
        if (!itemRect) return;

        // Acompanha o ponteiro continuamente com suavidade magnética ao item alvo
        if (orientation === "vertical") {
          const cursorTop = moveEvent.clientY - cRect.top - itemRect.height / 2;
          const maxTop = Math.max(0, cRect.height - itemRect.height);
          const clampedCursorTop = Math.max(0, Math.min(maxTop, cursorTop));
          const blendedY = hasDragged ? itemRect.y * 0.62 + clampedCursorTop * 0.38 : itemRect.y;
          const movingDown = moveEvent.clientY >= lastPointerCoord;
          lastPointerCoord = moveEvent.clientY;

          timelineRef.current?.kill();
          gsap.to(pill, {
            x: itemRect.x,
            y: blendedY,
            width: itemRect.width,
            height: itemRect.height,
            scaleX: 0.975,
            scaleY: hasDragged ? 1.035 : 0.975,
            opacity: 1,
            duration: 0.11,
            ease: "power2.out",
            overwrite: "auto",
            force3D: true,
          });
          if (sheen) {
            gsap.to(sheen, {
              clipPath: movingDown
                ? "inset(0% 0% 18% 0% round 10px)"
                : "inset(18% 0% 0% 0% round 10px)",
              opacity: 1,
              duration: 0.14,
              ease: "power2.out",
              overwrite: "auto",
            });
          }
          prevRectRef.current = { ...itemRect, y: blendedY };
        } else {
          const cursorLeft = moveEvent.clientX - cRect.left - itemRect.width / 2;
          const maxLeft = Math.max(0, cRect.width - itemRect.width);
          const clampedCursorLeft = Math.max(0, Math.min(maxLeft, cursorLeft));
          const blendedX = hasDragged ? itemRect.x * 0.62 + clampedCursorLeft * 0.38 : itemRect.x;
          const movingRight = moveEvent.clientX >= lastPointerCoord;
          lastPointerCoord = moveEvent.clientX;

          timelineRef.current?.kill();
          gsap.to(pill, {
            x: blendedX,
            y: itemRect.y,
            width: itemRect.width,
            height: itemRect.height,
            scaleX: hasDragged ? 1.035 : 0.985,
            scaleY: 0.97,
            opacity: 1,
            duration: 0.11,
            ease: "power2.out",
            overwrite: "auto",
            force3D: true,
          });
          if (sheen) {
            gsap.to(sheen, {
              clipPath: movingRight
                ? "inset(0% 18% 0% 0% round 10px)"
                : "inset(0% 0% 0% 18% round 10px)",
              opacity: 1,
              duration: 0.14,
              ease: "power2.out",
              overwrite: "auto",
            });
          }
          prevRectRef.current = { ...itemRect, x: blendedX };
        }
      };

      const finishPress = (upEvent: PointerEvent, cancelled: boolean) => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerCancel);

        delete pill.dataset.pressing;
        isScrubbingRef.current = false;

        if (cancelled) {
          onScrubRef.current?.(null);
          const backRect = measureKey(activeKeyRef.current);
          if (backRect) animateTo(backRect, false);
          return;
        }

        const endEl = findNearestItem(upEvent.clientX, upEvent.clientY);
        const endKey = endEl?.getAttribute("data-sliding-key") || null;

        if (endEl && endKey) {
          const finalRect = measureElement(container, endEl);
          if (finalRect) {
            timelineRef.current?.kill();
            gsap.to(pill, {
              x: finalRect.x,
              y: finalRect.y,
              width: finalRect.width,
              height: finalRect.height,
              scaleX: 1,
              scaleY: 1,
              opacity: 1,
              duration: reduced ? 0 : 0.24,
              ease: "power3.out",
              overwrite: "auto",
              force3D: true,
            });
            if (sheen) {
              gsap.to(sheen, {
                clipPath: "inset(0% 0% 0% 0% round 10px)",
                opacity: 1,
                duration: reduced ? 0 : 0.24,
                ease: "power3.out",
                overwrite: "auto",
              });
            }
            prevRectRef.current = finalRect;
          }

          if (hasDragged && endKey !== startKey) {
            if (onCommitRef.current) {
              onCommitRef.current(endKey);
            } else {
              endEl.click();
            }
          }
        } else {
          onScrubRef.current?.(null);
          const backRect = measureKey(activeKeyRef.current);
          if (backRect) animateTo(backRect, false);
        }
      };

      const handlePointerUp = (upEvent: PointerEvent) => finishPress(upEvent, false);
      const handlePointerCancel = (cancelEvent: PointerEvent) => finishPress(cancelEvent, true);

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerCancel);
    };

    container.addEventListener("dragstart", preventNativeDrag);
    container.addEventListener("pointerdown", handlePointerDown);

    return () => {
      container.removeEventListener("dragstart", preventNativeDrag);
      container.removeEventListener("pointerdown", handlePointerDown);
      timelineRef.current?.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orientation]);

  return { containerRef, pillRef, sheenRef };
}
