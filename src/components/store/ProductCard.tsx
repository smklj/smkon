"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/store/cart-context";
import type { StoreProduct } from "@/lib/store/types";
import { IconArrowUpRight, IconCheck, IconStar, IconZap } from "./StoreIcons";

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function ProductCard({ product }: { product: StoreProduct }) {
  const { addItem } = useCart();
  const isShopee = product.fulfillment_mode === "external_affiliate";
  const isDigital = product.fulfillment_mode === "internal_digital";
  const imageUrl = product.image_urls[0] || "/brand/demo-keyboard.jpg";
  const hasDiscount =
    product.compare_at_price_cents !== null &&
    product.compare_at_price_cents > product.price_cents;
  const discountPct = hasDiscount
    ? Math.round(
        ((product.compare_at_price_cents! - product.price_cents) /
          product.compare_at_price_cents!) *
          100,
      )
    : 0;
  const installmentCents = Math.round(product.price_cents / 12);
  const isDemo = product.id.startsWith("demo-");

  return (
    <article className="store-card">
      <div className="store-card-image-wrap">
        <Link href={`/loja/produtos/${product.slug}`} tabIndex={-1}>
          <Image
            src={imageUrl}
            alt={product.name}
            className="store-card-image"
            width={400}
            height={400}
            style={{ objectFit: "cover", width: "100%", height: "100%" }}
          />
        </Link>

        {isShopee && (
          <span className="store-badge store-badge-shopee">
            Shopee Oficial
          </span>
        )}

        {isDigital && (
          <span className="store-badge store-badge-digital">
            Digital
          </span>
        )}

        {!isShopee && !isDigital && product.is_featured && (
          <span className="store-badge store-badge-featured">
            Destaque
          </span>
        )}

        {discountPct > 0 && (
          <span className="store-badge-discount">-{discountPct}%</span>
        )}

        {product.score !== null && (
          <span className="store-badge-score" title="Avaliação curadoria SMKON">
            <IconStar size={11} />
            <span>{product.score.toFixed(1)}</span>
          </span>
        )}
      </div>

      <div className="store-card-body">
        <span className="store-card-category">
          {product.category}{isDemo ? " · Modelo" : ""}
        </span>

        <h3 className="store-card-title">
          <Link href={`/loja/produtos/${product.slug}`}>
            {product.name}
          </Link>
        </h3>

        <div className="store-card-prices">
          {hasDiscount && (
            <span className="store-compare-price">
              {formatBRL(product.compare_at_price_cents!)}
            </span>
          )}
          <span className="store-price">
            {formatBRL(product.price_cents)}
          </span>
        </div>

        {!isShopee && product.price_cents >= 2400 && (
          <span className="store-card-installments">
            12x de {formatBRL(installmentCents)} · À vista no PIX
          </span>
        )}

        <div className="store-card-meta-line">
          {isDigital ? (
            <span style={{ color: "#e4e4e7", display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <IconZap size={12} />
              <span>Entrega digital imediata</span>
            </span>
          ) : isShopee ? (
            <span style={{ color: "#fdba74", display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <IconArrowUpRight size={12} />
              <span>Link externo Shopee</span>
            </span>
          ) : product.track_inventory && product.stock_quantity <= 0 ? (
            <span style={{ color: "#fca5a5" }}>Esgotado no momento</span>
          ) : (
            <span style={{ color: "#d4d4d8", display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <IconCheck size={12} />
              <span>Envio rastreado Brasil</span>
            </span>
          )}
        </div>

        {isShopee ? (
          <a
            href={product.affiliate_url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="store-btn store-btn-shopee store-card-btn"
          >
            <span>Comprar na Shopee</span>
            <IconArrowUpRight size={14} />
          </a>
        ) : (
          <button
            type="button"
            onClick={() => addItem(product)}
            className="store-btn store-btn-primary store-card-btn"
          >
            Adicionar ao Carrinho
          </button>
        )}
      </div>
    </article>
  );
}
