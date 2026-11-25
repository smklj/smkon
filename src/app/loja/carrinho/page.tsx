"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/store/cart-context";
import type { ShippingOption } from "@/lib/store/types";

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function CartPage() {
  const {
    items,
    updateQuantity,
    removeItem,
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents,
    coupon,
    setCoupon,
    shippingOption,
    setShippingOption,
  } = useCart();

  const router = useRouter();
  const [cep, setCep] = useState("");
  const [shippingQuotes, setShippingQuotes] = useState<ShippingOption[]>([]);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);

  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  const hasPhysical = items.some((i) => i.fulfillmentMode === "internal_physical");

  const handleCalculateShipping = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) {
      setShippingError("Digite um CEP válido com 8 dígitos.");
      return;
    }

    setShippingLoading(true);
    setShippingError(null);

    try {
      const res = await fetch("/api/store/shipping/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationPostalCode: cleanCep,
          items,
        }),
      });

      const data = await res.json();
      if (res.ok && Array.isArray(data.options)) {
        setShippingQuotes(data.options);
        if (data.options.length > 0) {
          setShippingOption(data.options[0]);
        }
      } else {
        setShippingError(data.error || "Não foi possível calcular o frete.");
      }
    } catch {
      setShippingError("Erro de comunicação ao calcular frete.");
    } finally {
      setShippingLoading(false);
    }
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;

    setCouponLoading(true);
    setCouponError(null);

    try {
      const res = await fetch("/api/store/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponInput.trim(), subtotalCents }),
      });

      const data = await res.json();
      if (data.valid && data.coupon) {
        setCoupon(data.coupon);
        setCouponInput("");
      } else {
        setCouponError(data.reason || "Cupom inválido.");
      }
    } catch {
      setCouponError("Erro ao validar cupom.");
    } finally {
      setCouponLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <span style={{ fontSize: "54px" }}>🛒</span>
        <h1 style={{ fontSize: "24px", color: "#fff", marginTop: "16px", marginBottom: "8px" }}>
          Seu carrinho está vazio
        </h1>
        <p style={{ color: "var(--store-muted)", fontSize: "14px", marginBottom: "24px" }}>
          Que tal conferir as novidades e ofertas selecionadas?
        </p>
        <Link href="/loja/produtos" className="store-btn store-btn-primary">
          Explorar Catálogo ↗
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#fff", marginBottom: "24px" }}>
        Carrinho de Compras
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "32px",
          alignItems: "start",
        }}
      >
        {/* Lista de Itens */}
        <div
          style={{
            background: "var(--store-surface)",
            border: "1px solid var(--store-border)",
            borderRadius: "16px",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          {items.map((item) => (
            <div
              key={item.productId}
              style={{
                display: "flex",
                gap: "16px",
                paddingBottom: "20px",
                borderBottom: "1px solid var(--store-border)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.name}
                style={{ width: "80px", height: "80px", borderRadius: "10px", objectFit: "cover" }}
              />

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: "600", color: "#fff" }}>
                  <Link href={`/loja/produtos/${item.slug}`}>{item.name}</Link>
                </h3>

                <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--store-accent)" }}>
                  {formatBRL(item.priceCents * item.quantity)}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "auto" }}>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      border: "1px solid var(--store-border)",
                      borderRadius: "6px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      style={{ padding: "4px 10px", background: "none", border: "none", color: "#fff", cursor: "pointer" }}
                    >
                      -
                    </button>
                    <span style={{ padding: "0 10px", fontSize: "13px", fontWeight: "600" }}>
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      style={{ padding: "4px 10px", background: "none", border: "none", color: "#fff", cursor: "pointer" }}
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

          {/* Cálculo de Frete */}
          {hasPhysical && (
            <div style={{ marginTop: "12px" }}>
              <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#fff", marginBottom: "8px" }}>
                Simular Frete e Prazo
              </h4>
              <form onSubmit={handleCalculateShipping} style={{ display: "flex", gap: "8px", maxWidth: "340px" }}>
                <input
                  type="text"
                  placeholder="00000-000"
                  value={cep}
                  onChange={(e) => setCep(e.target.value)}
                  style={{
                    flex: 1,
                    height: "38px",
                    background: "var(--store-card)",
                    border: "1px solid var(--store-border)",
                    borderRadius: "8px",
                    padding: "0 12px",
                    color: "#fff",
                    fontSize: "13px",
                  }}
                />
                <button
                  type="submit"
                  disabled={shippingLoading}
                  className="store-btn store-btn-secondary"
                  style={{ padding: "0 16px", height: "38px" }}
                >
                  {shippingLoading ? "Calculando..." : "Calcular"}
                </button>
              </form>

              {shippingError && (
                <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "6px" }}>{shippingError}</div>
              )}

              {shippingQuotes.length > 0 && (
                <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {shippingQuotes.map((q) => (
                    <label
                      key={q.serviceId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid",
                        borderColor: shippingOption?.serviceId === q.serviceId ? "var(--store-accent)" : "var(--store-border)",
                        background: shippingOption?.serviceId === q.serviceId ? "rgba(0, 240, 255, 0.05)" : "transparent",
                        cursor: "pointer",
                        fontSize: "13px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <input
                          type="radio"
                          name="shipping_cart"
                          checked={shippingOption?.serviceId === q.serviceId}
                          onChange={() => setShippingOption(q)}
                        />
                        <div>
                          <strong>{q.serviceName}</strong> ({q.carrierName})
                          <div style={{ fontSize: "11px", color: "var(--store-muted)" }}>
                            Prazo de {q.deliveryDays} {q.deliveryDays === 1 ? "dia útil" : "dias úteis"}
                          </div>
                        </div>
                      </div>
                      <span style={{ fontWeight: "700", color: "#fff" }}>
                        {q.priceCents === 0 ? "Grátis" : formatBRL(q.priceCents)}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Resumo do Pedido */}
        <div
          style={{
            background: "var(--store-surface)",
            border: "1px solid var(--store-border)",
            borderRadius: "16px",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#fff" }}>Resumo da Compra</h2>

          {/* Cupom */}
          {coupon ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(34, 197, 94, 0.1)",
                border: "1px solid rgba(34, 197, 94, 0.3)",
                padding: "10px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                color: "var(--store-success)",
              }}
            >
              <span>Cupom <strong>{coupon.code}</strong> ativo</span>
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
                placeholder="Código do cupom"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                style={{
                  flex: 1,
                  height: "38px",
                  background: "var(--store-card)",
                  border: "1px solid var(--store-border)",
                  borderRadius: "8px",
                  padding: "0 12px",
                  color: "#fff",
                  fontSize: "13px",
                }}
              />
              <button
                type="submit"
                disabled={couponLoading || !couponInput.trim()}
                className="store-btn store-btn-secondary"
                style={{ padding: "0 16px", height: "38px" }}
              >
                {couponLoading ? "..." : "Aplicar"}
              </button>
            </form>
          )}

          {couponError && (
            <div style={{ color: "#ef4444", fontSize: "12px" }}>{couponError}</div>
          )}

          {/* Linhas de total */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--store-muted)" }}>
              <span>Subtotal dos itens</span>
              <span>{formatBRL(subtotalCents)}</span>
            </div>

            {discountCents > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--store-success)" }}>
                <span>Desconto aplicado</span>
                <span>-{formatBRL(discountCents)}</span>
              </div>
            )}

            {shippingCents > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--store-muted)" }}>
                <span>Frete selecionado</span>
                <span>{formatBRL(shippingCents)}</span>
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: "800",
                fontSize: "20px",
                color: "#fff",
                borderTop: "1px solid var(--store-border)",
                paddingTop: "14px",
                marginTop: "6px",
              }}
            >
              <span>Total</span>
              <span style={{ color: "var(--store-accent)" }}>{formatBRL(totalCents)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push("/loja/checkout")}
            className="store-btn store-btn-primary"
            style={{ width: "100%", padding: "16px", fontSize: "16px" }}
          >
            Continuar para o Checkout 🔒
          </button>
        </div>
      </div>
    </div>
  );
}
