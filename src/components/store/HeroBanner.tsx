"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { StoreBanner } from "@/lib/store/types";
import { IconArrowUpRight, IconBag, IconChevronLeft, IconChevronRight, IconCpu } from "./StoreIcons";

export function HeroBanner({ banners }: { banners: StoreBanner[] }) {
  const activeList = banners.filter((b) => b.active);
  const items = activeList.length > 0 ? activeList : banners;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [items.length]);

  if (items.length === 0) return null;

  const current = items[index % items.length] || items[0];
  const resolvedImage =
    !current.image_url || current.image_url === "/brand/brand-identity-board.jpg"
      ? "/brand/hero-luxury-gold.jpg"
      : current.image_url;

  return (
    <section className="store-hero" aria-label="Destaques principais">
      <div className="store-hero-grid">
        <div className="store-hero-content">
          {current.badge_text && (
            <span className="store-hero-badge">{current.badge_text}</span>
          )}

          <h1 className="store-hero-title">{current.title}</h1>

          {current.subtitle && (
            <p className="store-hero-subtitle">{current.subtitle}</p>
          )}

          <div className="store-hero-actions">
            <Link href={current.cta_href || "/loja/produtos"} className="store-btn store-btn-primary">
              <span>{current.cta_text || "Explorar Produtos"}</span>
              <IconArrowUpRight size={15} />
            </Link>
            <Link href="/loja/produtos?tipo=digital" className="store-btn store-btn-secondary">
              <IconCpu size={15} />
              <span>Infoprodutos</span>
            </Link>
            <Link href="/loja/produtos?tipo=shopee" className="store-btn store-btn-secondary">
              <IconBag size={15} />
              <span>Shopee</span>
            </Link>
          </div>
        </div>

        <div className="store-hero-media">
          <Image
            key={resolvedImage}
            src={resolvedImage}
            alt={current.title}
            width={700}
            height={420}
            priority
            style={{ objectFit: "cover", width: "100%", height: "100%" }}
          />
        </div>
      </div>

      {items.length > 1 && (
        <>
          <button
            type="button"
            className="store-hero-arrow store-hero-arrow-left"
            aria-label="Banner anterior"
            onClick={() => setIndex((prev) => (prev - 1 + items.length) % items.length)}
          >
            <IconChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="store-hero-arrow store-hero-arrow-right"
            aria-label="Próximo banner"
            onClick={() => setIndex((prev) => (prev + 1) % items.length)}
          >
            <IconChevronRight size={18} />
          </button>

          <div className="store-hero-dots" role="tablist" aria-label="Selecionar banner">
            {items.map((b, i) => (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Banner ${i + 1}`}
                onClick={() => setIndex(i)}
                className={i === index ? "store-hero-dot active" : "store-hero-dot"}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
