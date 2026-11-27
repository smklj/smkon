"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { NAV_ITEMS, isActive } from "@/lib/navigation";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const prevIndexRef = useRef<number>(-1);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const currentIndex = NAV_ITEMS.findIndex((item) => item.href && isActive(pathname, item.href));
    const prevIndex = prevIndexRef.current;
    prevIndexRef.current = currentIndex;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(el, { opacity: 1, x: 0, scale: 1 });
      return;
    }

    const direction = prevIndex === -1 || currentIndex === -1 ? 1 : currentIndex >= prevIndex ? 1 : -1;

    gsap.killTweensOf(el);
    gsap.fromTo(
      el,
      { opacity: 0, x: direction * 16, scale: 0.992 },
      { opacity: 1, x: 0, scale: 1, duration: 0.34, ease: "power3.out", clearProps: "transform" },
    );
  }, [pathname]);

  return (
    <div ref={contentRef} className="app-page-transition">
      {children}
    </div>
  );
}
