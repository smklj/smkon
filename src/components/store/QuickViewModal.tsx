"use client";

import React, { useState } from "react";
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

export function QuickViewModal({
  product,
  onClose,
}: {
  product: StoreProduct;
  onClose: () => void;
}) {
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const isShopee = product.fulfillment_mode === "external_affiliate";
  const isDigital = product.fulfillment_mode === "internal_digital";
  const imageUrl = product.image_urls[0] || "/brand/demo-keyboard.jpg";

  return (
    <div
      className="store-quickview-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Visualização rápida de ${product.name}`}
      onClick={onClose}
    >
      <div className="store-quickview-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="store-quickview-close" aria-label="Fechar">
          ✕
        </button>

        <div className="store-quickview-grid">
          <div className="store-quickview-media">
            <Image
              src={imageUrl}
              alt={product.name}
              width={420}
              height={420}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>

          <div className="store-quickview-info">
            <span className="store-card-category">{product.category}</span>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>
              {product.name}
            </h2>

            {product.score !== null && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--store-accent)" }}>
                <IconStar size={13} />
                <span>Avaliação {product.score.toFixed(1)} · Curadoria SMKON</span>
              </div>
            )}

            <div style={{ margin: "4px 0" }}>
              {product.compare_at_price_cents && product.compare_at_price_cents > product.price_cents && (
                <div className="store-compare-price">{formatBRL(product.compare_at_price_cents)}</div>
              )}
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#fff" }}>
                {formatBRL(product.price_cents)}
              </div>
              {!isShopee && (
                <div style={{ fontSize: "12px", color: "#34d399", fontWeight: 600 }}>
                  em até 12x de {formatBRL(Math.round(product.price_cents / 12))} sem juros · PIX imediato
                </div>
              )}
            </div>

            <p style={{ fontSize: "13px", color: "var(--store-muted)", lineHeight: 1.55 }}>
              {product.short_description || product.description || "Produto selecionado no catálogo oficial SMKON."}
            </p>

            <div style={{ fontSize: "12px", color: "#cbd5e1", display: "flex", alignItems: "center", gap: "6px" }}>
              {isDigital ? (
                <>
                  <IconZap size={14} />
                  <span>Liberação automática imediata após pagamento</span>
                </>
              ) : (
                <>
                  <IconCheck size={14} />
                  <span>
                    {isShopee ? "Compra finalizada no site oficial Shopee" : "Envio rastreado para todo o Brasil"}
                  </span>
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "auto", paddingTop: "12px" }}>
              {isShopee ? (
                <a
                  href={product.affiliate_url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="store-btn store-btn-shopee"
                  style={{ flex: 1 }}
                >
                  <span>Comprar na Shopee</span>
                  <IconArrowUpRight size={14} />
                </a>
              ) : (
                <>
                  <div className="store-qty-stepper">
                    <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))}>-</button>
                    <span>{qty}</span>
                    <button type="button" onClick={() => setQty((q) => q + 1)}>+</button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      addItem(product, qty);
                      onClose();
                    }}
                    className="store-btn store-btn-primary"
                    style={{ flex: 1 }}
                  >
                    Adicionar ao Carrinho
                  </button>
                </>
              )}
            </div>

            <Link
              href={`/loja/produtos/${product.slug}`}
              onClick={onClose}
              style={{ fontSize: "12px", color: "var(--store-accent)", textDecoration: "none", textAlign: "center" }}
            >
              Ver especificações completas →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
