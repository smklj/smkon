"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/store/cart-context";
import type { ShippingOption, StoreOrderAddress, StoreOrderCustomer } from "@/lib/store/types";

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function CheckoutPage() {
  const {
    items,
    clearCart,
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents,
    coupon,
    shippingOption,
    setShippingOption,
  } = useCart();

  const router = useRouter();

  // Customer state
  const [customer, setCustomer] = useState<StoreOrderCustomer>({
    name: "",
    email: "",
    document: "",
    phone: "",
  });

  // Shipping address state
  const [address, setAddress] = useState<StoreOrderAddress>({
    recipientName: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    postalCode: "",
  });

  const [paymentMethod, setPaymentMethod] = useState<"pix" | "credit_card">("pix");
  const [shippingQuotes, setShippingQuotes] = useState<ShippingOption[]>([]);
  const [_calculatingShipping, setCalculatingShipping] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasPhysical = items.some((i) => i.fulfillmentMode === "internal_physical");

  // CEP lookup helper
  const handleCepBlur = async () => {
    const cleanCep = address.postalCode.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    setCalculatingShipping(true);
    try {
      // 1. Busca endereço no ViaCEP
      const viaCepRes = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const viaCepData = await viaCepRes.json();
      if (!viaCepData.erro) {
        setAddress((prev) => ({
          ...prev,
          street: viaCepData.logradouro || prev.street,
          neighborhood: viaCepData.bairro || prev.neighborhood,
          city: viaCepData.localidade || prev.city,
          state: viaCepData.uf || prev.state,
        }));
      }

      // 2. Calcula opções de frete
      if (hasPhysical) {
        const shipRes = await fetch("/api/store/shipping/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destinationPostalCode: cleanCep,
            items,
          }),
        });
        const shipData = await shipRes.json();
        if (shipRes.ok && Array.isArray(shipData.options)) {
          setShippingQuotes(shipData.options);
          if (shipData.options.length > 0 && !shippingOption) {
            setShippingOption(shipData.options[0]);
          }
        }
      }
    } catch {
      // Fallback
    } finally {
      setCalculatingShipping(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validações básicas
    if (!customer.name.trim() || !customer.email.trim() || !customer.document.trim() || !customer.phone.trim()) {
      setErrorMessage("Por favor, preencha todos os dados pessoais do comprador.");
      return;
    }

    if (hasPhysical) {
      if (!address.postalCode || !address.street || !address.number || !address.neighborhood || !address.city || !address.state) {
        setErrorMessage("Por favor, preencha o endereço de entrega completo para o envio.");
        return;
      }
      if (!shippingOption) {
        setErrorMessage("Selecione uma opção de frete para continuar.");
        return;
      }
    }

    setSubmitting(true);

    try {
      const payload = {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        customer,
        shippingAddress: hasPhysical
          ? {
              ...address,
              recipientName: address.recipientName || customer.name,
            }
          : undefined,
        shippingOption: hasPhysical ? shippingOption : undefined,
        couponCode: coupon?.code,
        paymentMethod,
      };

      const res = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Falha ao processar o pedido. Tente novamente.");
        setSubmitting(false);
        return;
      }

      // Limpa o carrinho
      clearCart();

      // Se for cartão com checkout externo (preference), redireciona se retornado ou vai para a tela de pedido
      if (paymentMethod === "credit_card" && data.checkoutUrl && !data.checkoutUrl.includes("sim_")) {
        window.location.href = data.checkoutUrl;
      } else {
        router.push(`/loja/pedido/${data.orderCode}`);
      }
    } catch {
      setErrorMessage("Erro de conexão ao finalizar pedido.");
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <h2 style={{ color: "#fff", marginBottom: "12px" }}>Seu carrinho está vazio</h2>
        <Link href="/loja/produtos" className="store-btn store-btn-primary">
          Ir às Compras
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#fff", marginBottom: "28px" }}>
        Finalizar Pedido Seguro 🔒
      </h1>

      <form onSubmit={handleSubmit}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "32px",
            alignItems: "start",
          }}
        >
          {/* Coluna da Esquerda: Formulários */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* 1. Dados Pessoais */}
            <div
              style={{
                background: "var(--store-surface)",
                border: "1px solid var(--store-border)",
                borderRadius: "14px",
                padding: "24px",
              }}
            >
              <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#fff", marginBottom: "16px" }}>
                1. Seus Dados de Identificação
              </h2>

              <div style={{ display: "grid", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--store-muted)", marginBottom: "4px" }}>
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={customer.name}
                    onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                    className="store-search-input"
                    style={{ borderRadius: "8px", height: "40px" }}
                    placeholder="Seu nome"
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "var(--store-muted)", marginBottom: "4px" }}>
                      E-mail *
                    </label>
                    <input
                      type="email"
                      required
                      value={customer.email}
                      onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                      className="store-search-input"
                      style={{ borderRadius: "8px", height: "40px" }}
                      placeholder="seu@email.com"
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "var(--store-muted)", marginBottom: "4px" }}>
                      CPF *
                    </label>
                    <input
                      type="text"
                      required
                      value={customer.document}
                      onChange={(e) => setCustomer({ ...customer, document: e.target.value })}
                      className="store-search-input"
                      style={{ borderRadius: "8px", height: "40px" }}
                      placeholder="000.000.000-00"
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--store-muted)", marginBottom: "4px" }}>
                    WhatsApp / Telefone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={customer.phone}
                    onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                    className="store-search-input"
                    style={{ borderRadius: "8px", height: "40px" }}
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>
            </div>

            {/* 2. Endereço de Entrega (se houver itens físicos) */}
            {hasPhysical && (
              <div
                style={{
                  background: "var(--store-surface)",
                  border: "1px solid var(--store-border)",
                  borderRadius: "14px",
                  padding: "24px",
                }}
              >
                <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#fff", marginBottom: "16px" }}>
                  2. Endereço de Entrega
                </h2>

                <div style={{ display: "grid", gap: "14px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", color: "var(--store-muted)", marginBottom: "4px" }}>
                        CEP *
                      </label>
                      <input
                        type="text"
                        required
                        value={address.postalCode}
                        onChange={(e) => setAddress({ ...address, postalCode: e.target.value })}
                        onBlur={handleCepBlur}
                        className="store-search-input"
                        style={{ borderRadius: "8px", height: "40px" }}
                        placeholder="00000-000"
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", color: "var(--store-muted)", marginBottom: "4px" }}>
                        Destinatário (se diferente)
                      </label>
                      <input
                        type="text"
                        value={address.recipientName}
                        onChange={(e) => setAddress({ ...address, recipientName: e.target.value })}
                        className="store-search-input"
                        style={{ borderRadius: "8px", height: "40px" }}
                        placeholder={customer.name || "Nome de quem recebe"}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", color: "var(--store-muted)", marginBottom: "4px" }}>
                        Rua / Avenida *
                      </label>
                      <input
                        type="text"
                        required
                        value={address.street}
                        onChange={(e) => setAddress({ ...address, street: e.target.value })}
                        className="store-search-input"
                        style={{ borderRadius: "8px", height: "40px" }}
                        placeholder="Nome da rua"
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", color: "var(--store-muted)", marginBottom: "4px" }}>
                        Número *
                      </label>
                      <input
                        type="text"
                        required
                        value={address.number}
                        onChange={(e) => setAddress({ ...address, number: e.target.value })}
                        className="store-search-input"
                        style={{ borderRadius: "8px", height: "40px" }}
                        placeholder="123"
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", color: "var(--store-muted)", marginBottom: "4px" }}>
                        Complemento
                      </label>
                      <input
                        type="text"
                        value={address.complement}
                        onChange={(e) => setAddress({ ...address, complement: e.target.value })}
                        className="store-search-input"
                        style={{ borderRadius: "8px", height: "40px" }}
                        placeholder="Apto, Bloco..."
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", color: "var(--store-muted)", marginBottom: "4px" }}>
                        Bairro *
                      </label>
                      <input
                        type="text"
                        required
                        value={address.neighborhood}
                        onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })}
                        className="store-search-input"
                        style={{ borderRadius: "8px", height: "40px" }}
                        placeholder="Bairro"
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", color: "var(--store-muted)", marginBottom: "4px" }}>
                        Cidade *
                      </label>
                      <input
                        type="text"
                        required
                        value={address.city}
                        onChange={(e) => setAddress({ ...address, city: e.target.value })}
                        className="store-search-input"
                        style={{ borderRadius: "8px", height: "40px" }}
                        placeholder="Cidade"
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "12px", color: "var(--store-muted)", marginBottom: "4px" }}>
                        Estado (UF) *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={2}
                        value={address.state}
                        onChange={(e) => setAddress({ ...address, state: e.target.value.toUpperCase() })}
                        className="store-search-input"
                        style={{ borderRadius: "8px", height: "40px" }}
                        placeholder="SP"
                      />
                    </div>
                  </div>
                </div>

                {/* Opções de Envio */}
                {shippingQuotes.length > 0 && (
                  <div style={{ marginTop: "20px" }}>
                    <h3 style={{ fontSize: "14px", fontWeight: "600", color: "#fff", marginBottom: "8px" }}>
                      Opção de Frete
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
                              name="shipping_method"
                              checked={shippingOption?.serviceId === q.serviceId}
                              onChange={() => setShippingOption(q)}
                            />
                            <div>
                              <strong>{q.serviceName}</strong> ({q.carrierName})
                              <div style={{ fontSize: "11px", color: "var(--store-muted)" }}>
                                {q.deliveryDays} {q.deliveryDays === 1 ? "dia útil" : "dias úteis"}
                              </div>
                            </div>
                          </div>
                          <span style={{ fontWeight: "700", color: "#fff" }}>
                            {q.priceCents === 0 ? "Grátis" : formatBRL(q.priceCents)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. Forma de Pagamento */}
            <div
              style={{
                background: "var(--store-surface)",
                border: "1px solid var(--store-border)",
                borderRadius: "14px",
                padding: "24px",
              }}
            >
              <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#fff", marginBottom: "16px" }}>
                {hasPhysical ? "3" : "2"}. Forma de Pagamento
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    borderRadius: "10px",
                    border: "1px solid",
                    borderColor: paymentMethod === "pix" ? "var(--store-accent)" : "var(--store-border)",
                    background: paymentMethod === "pix" ? "rgba(0, 240, 255, 0.06)" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <input
                      type="radio"
                      name="payment_opt"
                      checked={paymentMethod === "pix"}
                      onChange={() => setPaymentMethod("pix")}
                    />
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: "700", color: "#fff" }}>
                        PIX Instantâneo
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--store-muted)" }}>
                        Aprovação em segundos com QR Code e chave Copia e Cola
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: "11px", background: "var(--store-success)", color: "#000", fontWeight: "700", padding: "2px 8px", borderRadius: "4px" }}>
                    Mais Rápido
                  </span>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    borderRadius: "10px",
                    border: "1px solid",
                    borderColor: paymentMethod === "credit_card" ? "var(--store-accent)" : "var(--store-border)",
                    background: paymentMethod === "credit_card" ? "rgba(0, 240, 255, 0.06)" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <input
                      type="radio"
                      name="payment_opt"
                      checked={paymentMethod === "credit_card"}
                      onChange={() => setPaymentMethod("credit_card")}
                    />
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: "700", color: "#fff" }}>
                        Cartão de Crédito
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--store-muted)" }}>
                        Parcele em até 12x via Mercado Pago
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: "12px", color: "var(--store-muted)" }}>
                    💳 Até 12x
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Coluna da Direita: Resumo e Confirmação */}
          <div
            style={{
              background: "var(--store-surface)",
              border: "1px solid var(--store-border)",
              borderRadius: "14px",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}
          >
            <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#fff" }}>
              Itens do Pedido ({items.length})
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "240px", overflowY: "auto" }}>
              {items.map((item) => (
                <div key={item.productId} style={{ display: "flex", gap: "12px", alignItems: "center", fontSize: "13px" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    style={{ width: "44px", height: "44px", borderRadius: "6px", objectFit: "cover" }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#fff", fontWeight: "500" }}>{item.name}</div>
                    <div style={{ color: "var(--store-muted)", fontSize: "11px" }}>
                      Qtd: {item.quantity} · {formatBRL(item.priceCents)} cada
                    </div>
                  </div>
                  <div style={{ fontWeight: "700", color: "#fff" }}>
                    {formatBRL(item.priceCents * item.quantity)}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px solid var(--store-border)", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--store-muted)" }}>
                <span>Subtotal</span>
                <span>{formatBRL(subtotalCents)}</span>
              </div>

              {discountCents > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--store-success)" }}>
                  <span>Desconto ({coupon?.code})</span>
                  <span>-{formatBRL(discountCents)}</span>
                </div>
              )}

              {hasPhysical && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--store-muted)" }}>
                  <span>Frete ({shippingOption?.serviceName || "A calcular"})</span>
                  <span>{shippingCents === 0 ? "Grátis" : formatBRL(shippingCents)}</span>
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
                  paddingTop: "12px",
                  marginTop: "6px",
                }}
              >
                <span>Total a Pagar</span>
                <span style={{ color: "var(--store-accent)" }}>{formatBRL(totalCents)}</span>
              </div>
            </div>

            {errorMessage && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  color: "#ef4444",
                  fontSize: "13px",
                }}
              >
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="store-btn store-btn-primary"
              style={{ width: "100%", padding: "16px", fontSize: "16px" }}
            >
              {submitting ? "Processando Pedido..." : "Pagar Agora 🔒"}
            </button>

            <div style={{ fontSize: "11px", color: "var(--store-muted)", textAlign: "center", lineHeight: "1.5" }}>
              Ambiente protegido com criptografia de 256 bits. Ao confirmar, você concorda com nossos Termos de Compra.
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
