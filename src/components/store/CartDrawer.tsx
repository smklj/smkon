"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/store/cart-context";
import { IconCart, IconCheck, IconClose, IconLock } from "./StoreIcons";

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function CartDrawer() {
  const {
    items,
    isCartOpen,
    closeCart,
    updateQuantity,
    removeItem,
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents,
    coupon,
    setCoupon,
  } = useCart();

  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  if (!isCartOpen) return null;

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;

    setCouponLoading(true);
    setCouponError(null);

    try {
      const res = await fetch("/api/store/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode.trim(), subtotalCents }),
      });

      const data = await res.json();
      if (data.valid && data.coupon) {
        setCoupon(data.coupon);
        setCouponCode("");
      } else {
        setCouponError(data.reason || "Cupom inválido.");
      }
    } catch {
      setCouponError("Erro ao validar cupom.");
    } finally {
      setCouponLoading(false);
    }
  };

  return (
    <div className="store-drawer-overlay" onClick={closeCart}>
      <aside className="store-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="store-drawer-header">
          <h2 className="store-drawer-title">Meu Carrinho ({items.length})</h2>
          <button
            type="button"
            onClick={closeCart}
            aria-label="Fechar carrinho"
            style={{
              background: "none",
              border: "none",
              color: "var(--store-muted)",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
          >
            <IconClose size={18} />
          </button>
        </div>

        {items.length === 0 ? (
          <div style={{ flex: 1, display: "grid", placeContent: "center", textAlign: "center", padding: "40px" }}>
            <div style={{ color: "var(--store-accent)", margin: "0 auto 14px" }}>
              <IconCart size={36} />
            </div>
            <h3 style={{ fontSize: "16px", color: "#fff", marginBottom: "8px" }}>Seu carrinho está vazio</h3>
            <p style={{ fontSize: "13px", color: "var(--store-muted)", marginBottom: "20px" }}>
              Explore nossos produtos, periféricos e infoprodutos para começar.
            </p>
            <Link
              href="/loja/produtos"
              onClick={closeCart}
              className="store-btn store-btn-primary"
              style={{ padding: "10px 20px" }}
            >
              Explorar Catálogo
            </Link>
          </div>
        ) : (
          <>
            <div className="store-drawer-items">
              {items.map((item) => (
                <div key={item.productId} className="store-drawer-item">
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    className="store-drawer-item-img"
                    width={64}
                    height={64}
                    style={{ objectFit: "cover", borderRadius: "6px" }}
                  />
                  <div className="store-drawer-item-info">
                    <span className="store-drawer-item-title">{item.name}</span>
                    <span className="store-drawer-item-price">
                      {formatBRL(item.priceCents * item.quantity)}
                    </span>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "auto" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          border: "1px solid var(--store-border)",
                          borderRadius: "6px",
                          overflow: "hidden",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          style={{
                            padding: "4px 8px",
                            background: "var(--store-surface)",
                            border: "none",
                            color: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          -
                        </button>
                        <span style={{ padding: "0 10px", fontSize: "12px", fontWeight: "600" }}>
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          style={{
                            padding: "4px 8px",
                            background: "var(--store-surface)",
                            border: "none",
                            color: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(item.productId)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--store-muted)",
                          fontSize: "12px",
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="store-drawer-footer">
              {/* Cupom */}
              {coupon ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "rgba(34, 197, 94, 0.1)",
                    border: "1px solid rgba(34, 197, 94, 0.3)",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "var(--store-success)",
                  }}
                >
                  <span>Cupom <strong>{coupon.code}</strong> aplicado</span>
                  <button
                    type="button"
                    onClick={() => setCoupon(null)}
                    style={{ background: "none", border: "none", color: "var(--store-muted)", cursor: "pointer" }}
                  >
                    Remover
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    placeholder="Cupom de desconto"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    style={{
                      flex: 1,
                      height: "36px",
                      background: "var(--store-surface)",
                      border: "1px solid var(--store-border)",
                      borderRadius: "6px",
                      padding: "0 10px",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={couponLoading || !couponCode.trim()}
                    className="store-btn store-btn-secondary"
                    style={{ padding: "0 14px", height: "36px", fontSize: "12px" }}
                  >
                    {couponLoading ? "..." : "Aplicar"}
                  </button>
                </form>
              )}

              {couponError && (
                <span style={{ color: "#ef4444", fontSize: "11px" }}>{couponError}</span>
              )}

              {/* Barra de Progresso de Frete Grátis */}
              {(() => {
                const freeGoalCents = 29900;
                const progressPct = Math.min(100, Math.round((subtotalCents / freeGoalCents) * 100));
                const remainingCents = Math.max(0, freeGoalCents - subtotalCents);
                return (
                  <div
                    style={{
                      background: "rgba(212, 175, 55, 0.06)",
                      border: "1px solid rgba(212, 175, 55, 0.22)",
                      borderRadius: "10px",
                      padding: "10px 12px",
                    }}
                  >
                    <div style={{ fontSize: "12px", color: "#f4f4f5", marginBottom: "6px", display: "flex", justifyContent: "space-between" }}>
                      {remainingCents === 0 ? (
                        <span style={{ color: "var(--store-accent)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          <IconCheck size={13} />
                          <span>Você desbloqueou Frete Grátis</span>
                        </span>
                      ) : (
                        <span>
                          Falta <strong style={{ color: "var(--store-accent)" }}>{formatBRL(remainingCents)}</strong> para Frete Grátis
                        </span>
                      )}
                      <span style={{ color: "var(--store-muted)", fontSize: "11px" }}>{progressPct}%</span>
                    </div>
                    <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "999px", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${progressPct}%`,
                          height: "100%",
                          background: "linear-gradient(90deg, #b8860b, #f3d37a)",
                          transition: "width 0.35s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Totais */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--store-muted)" }}>
                  <span>Subtotal</span>
                  <span>{formatBRL(subtotalCents)}</span>
                </div>

                {discountCents > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--store-success)" }}>
                    <span>Desconto</span>
                    <span>-{formatBRL(discountCents)}</span>
                  </div>
                )}

                {shippingCents > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--store-muted)" }}>
                    <span>Frete estimado</span>
                    <span>{formatBRL(shippingCents)}</span>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: "700",
                    fontSize: "16px",
                    color: "#fff",
                    borderTop: "1px solid var(--store-border)",
                    paddingTop: "8px",
                    marginTop: "4px",
                  }}
                >
                  <span>Total</span>
                  <span style={{ color: "var(--store-accent)" }}>{formatBRL(totalCents)}</span>
                </div>
              </div>

              <Link
                href="/loja/checkout"
                onClick={closeCart}
                className="store-btn store-btn-primary"
                style={{ width: "100%", padding: "14px", fontSize: "15px" }}
              >
                <IconLock size={15} />
                <span>Finalizar Compra</span>
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
