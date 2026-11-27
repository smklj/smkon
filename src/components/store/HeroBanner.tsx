"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { StoreBanner } from "@/lib/store/types";
import { IconArrowUpRight, IconBag, IconChevronLeft, IconChevronRight, IconCpu } from "./StoreIcons";

export function HeroBanner({ banners }: { banners: StoreBanner[] }) {
  const activeList = banners.filter((b) => b.active);
  const items = activeList.length > 0 ? activeList : banners;
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const dragStartXRef = useRef<number | null>(null);
  const draggedEnoughRef = useRef(false);

  useEffect(() => {
    if (items.length <= 1 || isDragging) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [items.length, isDragging]);

  if (items.length === 0) return null;

  const current = items[index % items.length] || items[0];
  const resolvedImage =
    !current.image_url || current.image_url === "/brand/brand-identity-board.jpg"
      ? "/brand/hero-luxury-gold.jpg"
      : current.image_url;

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (items.length <= 1 || e.button !== 0) return;
    if ((e.target as HTMLElement)?.closest("a, button")) return;
    dragStartXRef.current = e.clientX;
    draggedEnoughRef.current = false;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (dragStartXRef.current === null) return;
    const delta = e.clientX - dragStartXRef.current;
    if (Math.abs(delta) > 8) draggedEnoughRef.current = true;
    const resisted = delta * 0.45;
    setDragX(Math.max(-140, Math.min(140, resisted)));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    if (dragStartXRef.current === null) return;
    const delta = e.clientX - dragStartXRef.current;
    dragStartXRef.current = null;
    setIsDragging(false);
    setDragX(0);

    if (delta <= -45) {
      setIndex((prev) => (prev + 1) % items.length);
    } else if (delta >= 45) {
      setIndex((prev) => (prev - 1 + items.length) % items.length);
    }
  };

  return (
    <section
      className="store-hero"
      aria-label="Destaques principais"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClickCapture={(e) => {
        if (draggedEnoughRef.current) {
          e.preventDefault();
          e.stopPropagation();
          draggedEnoughRef.current = false;
        }
      }}
      style={{
        cursor: items.length > 1 ? (isDragging ? "grabbing" : "grab") : undefined,
        userSelect: "none",
      }}
    >
      <div
        className="store-hero-grid"
        style={{
          transform: dragX !== 0 ? `translate3d(${dragX}px, 0, 0)` : undefined,
          opacity: dragX !== 0 ? Math.max(0.72, 1 - Math.abs(dragX) / 380) : 1,
          transition: isDragging ? "none" : "transform 0.34s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.28s ease",
        }}
      >
        <div className="store-hero-content">
          {current.badge_text && (
            <span className="store-hero-badge">{current.badge_text}</span>
          )}

          <h1 className="store-hero-title">{current.title}</h1>

          {current.subtitle && (
            <p className="store-hero-subtitle">{current.subtitle}</p>
          )}

          <div className="store-hero-actions">
            <Link href={current.cta_href || "/loja/produtos"} draggable={false} className="store-btn store-btn-primary">
              <span>{current.cta_text || "Explorar Produtos"}</span>
              <IconArrowUpRight size={15} />
            </Link>
            <Link href="/loja/produtos?tipo=digital" draggable={false} className="store-btn store-btn-secondary">
              <IconCpu size={15} />
              <span>Infoprodutos</span>
            </Link>
            <Link href="/loja/produtos?tipo=shopee" draggable={false} className="store-btn store-btn-secondary">
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
            draggable={false}
            style={{ objectFit: "cover", width: "100%", height: "100%" }}
          />
        </div>
      </div>

      {items.length > 1 && (
        <div className="store-hero-controls">
          <button
            type="button"
            className="store-hero-arrow"
            aria-label="Banner anterior"
            onClick={() => setIndex((prev) => (prev - 1 + items.length) % items.length)}
          >
            <IconChevronLeft size={16} />
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

          <button
            type="button"
            className="store-hero-arrow"
            aria-label="Próximo banner"
            onClick={() => setIndex((prev) => (prev + 1) % items.length)}
          >
            <IconChevronRight size={16} />
          </button>
        </div>
      )}
    </section>
  );
}
