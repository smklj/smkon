import React from "react";
import Link from "next/link";
import Image from "next/image";
import type { StoreBanner } from "@/lib/store/types";

export function HeroBanner({ banners }: { banners: StoreBanner[] }) {
  const activeBanner = banners.find((b) => b.active) || banners[0];
  if (!activeBanner) return null;

  return (
    <section className="store-hero">
      <div className="store-hero-grid">
        <div className="store-hero-content">
          {activeBanner.badge_text && (
            <span className="store-hero-badge">{activeBanner.badge_text}</span>
          )}

          <h1 className="store-hero-title">{activeBanner.title}</h1>

          {activeBanner.subtitle && (
            <p className="store-hero-subtitle">{activeBanner.subtitle}</p>
          )}

          <div className="store-hero-actions">
            <Link href={activeBanner.cta_href || "/loja/produtos"} className="store-btn store-btn-primary">
              {activeBanner.cta_text || "Explorar Produtos"} ↗
            </Link>
            <Link href="/loja/produtos?tipo=shopee" className="store-btn store-btn-shopee">
              Achados Shopee 🛍️
            </Link>
            <Link href="/loja/produtos?tipo=digital" className="store-btn store-btn-secondary">
              Soluções Digitais 💻
            </Link>
          </div>
        </div>

        <div className="store-hero-media">
          <Image
            src={activeBanner.image_url || "/brand/brand-identity-board.jpg"}
            alt={activeBanner.title}
            width={700}
            height={500}
            priority
            style={{ objectFit: "contain", width: "100%", height: "auto" }}
          />
        </div>
      </div>
    </section>
  );
}
