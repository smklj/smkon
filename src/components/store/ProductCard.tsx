"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/store/cart-context";
import type { StoreProduct } from "@/lib/store/types";

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
  const imageUrl = product.image_urls[0] || "/brand/brand-identity-board.jpg";

  return (
    <article className="store-card">
      <div className="store-card-image-wrap">
        <Link href={`/loja/produtos/${product.slug}`} tabIndex={-1}>
          <Image
            src={imageUrl}
            alt={product.name}
            className="store-card-image"
            width={400}
            height={300}
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
            Infoproduto
          </span>
        )}

        {!isShopee && !isDigital && product.is_featured && (
          <span className="store-badge store-badge-featured">
            Destaque
          </span>
        )}

        {product.score !== null && (
          <span className="store-badge-score" title="Score de confiabilidade e qualidade SMKON">
            ★ {product.score.toFixed(1)}
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
          {product.compare_at_price_cents && product.compare_at_price_cents > product.price_cents && (
            <span className="store-compare-price">
              {formatBRL(product.compare_at_price_cents)}
            </span>
          )}
          <span className="store-price">
            {formatBRL(product.price_cents)}
          </span>
        </div>

        {isShopee ? (
          <a
            href={product.affiliate_url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="store-btn store-btn-shopee store-card-btn"
          >
            Comprar na Shopee ↗
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
