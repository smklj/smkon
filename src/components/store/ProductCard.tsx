"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/store/cart-context";
import { useWishlist } from "@/lib/store/wishlist-context";
import type { StoreProduct } from "@/lib/store/types";
import { QuickViewModal } from "./QuickViewModal";
import { IconArrowUpRight, IconCheck, IconEye, IconHeart, IconStar, IconZap } from "./StoreIcons";

function splitBRL(cents: number): { main: string; frac: string } {
  const whole = Math.floor(cents / 100);
  const dec = String(cents % 100).padStart(2, "0");
  return {
    main: `R$ ${whole.toLocaleString("pt-BR")}`,
    frac: `,${dec}`,
  };
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function ProductCard({ product }: { product: StoreProduct }) {
  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useWishlist();
  const [quickViewOpen, setQuickViewOpen] = useState(false);

  const isShopee = product.fulfillment_mode === "external_affiliate";
  const isDigital = product.fulfillment_mode === "internal_digital";
  const imageUrl = product.image_urls[0] || "/brand/demo-keyboard.jpg";
  const fav = isFavorite(product.id);

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

  const price = splitBRL(product.price_cents);
  const installmentCents = Math.round(product.price_cents / 12);

  return (
    <>
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

          {isShopee ? (
            <span className="store-badge store-badge-shopee">Shopee</span>
          ) : isDigital ? (
            <span className="store-badge store-badge-digital">Digital</span>
          ) : product.is_featured ? (
            <span className="store-badge store-badge-featured">Destaque</span>
          ) : null}

          {discountPct > 0 && (
            <span className="store-badge-discount">{discountPct}% OFF</span>
          )}

          {/* Ações Flutuantes estilo Shein */}
          <div className="store-card-actions-float">
            <button
              type="button"
              onClick={() => toggleFavorite(product.id)}
              className={fav ? "store-float-btn active" : "store-float-btn"}
              aria-label={fav ? "Remover dos favoritos" : "Salvar nos favoritos"}
              title={fav ? "Remover dos favoritos" : "Favoritar"}
            >
              <IconHeart size={14} filled={fav} />
            </button>
            <button
              type="button"
              onClick={() => setQuickViewOpen(true)}
              className="store-float-btn"
              aria-label="Visualização rápida"
              title="Visualização rápida"
            >
              <IconEye size={14} />
            </button>
          </div>

          {product.score !== null && (
            <span className="store-badge-score" title="Avaliação curadoria SMKON">
              <IconStar size={10} />
              <span>{product.score.toFixed(1)}</span>
            </span>
          )}
        </div>

        <div className="store-card-body">
          <span className="store-card-category">{product.category}</span>

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
            <div className="store-price-split">
              <span className="store-price">{price.main}</span>
              <span className="store-price-cents">{price.frac}</span>
            </div>
          </div>

          {!isShopee && product.price_cents >= 2400 && (
            <span className="store-card-installments-ok">
              12x {formatBRL(installmentCents)} sem juros
            </span>
          )}

          <div className="store-card-meta-line">
            {isDigital ? (
              <span style={{ color: "#38bdf8", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <IconZap size={12} />
                <span>Entrega imediata</span>
              </span>
            ) : isShopee ? (
              <span style={{ color: "#fdba74", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <IconArrowUpRight size={12} />
                <span>Compra na Shopee</span>
              </span>
            ) : product.track_inventory && product.stock_quantity <= 0 ? (
              <span style={{ color: "#fca5a5" }}>Esgotado</span>
            ) : (
              <span style={{ color: "#34d399", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <IconCheck size={12} />
                <span>Envio rastreado</span>
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
              <span>Ver na Shopee</span>
              <IconArrowUpRight size={13} />
            </a>
          ) : (
            <button
              type="button"
              onClick={() => addItem(product)}
              className="store-btn store-card-btn-luxury store-card-btn"
            >
              Adicionar ao Carrinho
            </button>
          )}
        </div>
      </article>

      {quickViewOpen && (
        <QuickViewModal product={product} onClose={() => setQuickViewOpen(false)} />
      )}
    </>
  );
}
