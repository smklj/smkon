"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/store/cart-context";
import { useWishlist } from "@/lib/store/wishlist-context";
import { IconCart, IconZap } from "@/components/store/StoreIcons";
import type { StoreProduct } from "@/lib/store/types";

export function ProductDetailActions({ product }: { product: StoreProduct }) {
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCart();
  const { trackView } = useWishlist();
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      trackView(product.id);
    }, 120);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const maxStock = product.track_inventory ? product.stock_quantity : 99;
  const isOutOfStock = product.track_inventory && product.stock_quantity <= 0;

  const handleAddToCart = () => {
    addItem(product, quantity);
  };

  const handleBuyNow = () => {
    addItem(product, quantity);
    router.push("/loja/checkout");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Seletor de Quantidade */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontSize: "13px", color: "var(--store-muted)" }}>Quantidade:</span>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            border: "1px solid var(--store-border)",
            borderRadius: "8px",
            background: "var(--store-surface)",
          }}
        >
          <button
            type="button"
            disabled={quantity <= 1 || isOutOfStock}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            style={{
              padding: "8px 14px",
              background: "none",
              border: "none",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            -
          </button>
          <span style={{ padding: "0 12px", fontSize: "14px", fontWeight: "600" }}>
            {quantity}
          </span>
          <button
            type="button"
            disabled={quantity >= maxStock || isOutOfStock}
            onClick={() => setQuantity((q) => Math.min(maxStock, q + 1))}
            style={{
              padding: "8px 14px",
              background: "none",
              border: "none",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* Botões de Ação */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={isOutOfStock}
          onClick={handleAddToCart}
          className="store-btn store-btn-secondary"
          style={{ flex: 1, padding: "14px", fontSize: "14px" }}
        >
          <IconCart size={16} />
          <span>Adicionar ao Carrinho</span>
        </button>

        <button
          type="button"
          disabled={isOutOfStock}
          onClick={handleBuyNow}
          className="store-btn store-btn-primary"
          style={{ flex: 1, padding: "14px", fontSize: "14px" }}
        >
          <IconZap size={15} />
          <span>Comprar Agora</span>
        </button>
      </div>
    </div>
  );
}
