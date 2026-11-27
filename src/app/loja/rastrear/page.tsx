"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RastrearPedidoPage() {
  const router = useRouter();
  const [orderCode, setOrderCode] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = orderCode.trim().toUpperCase();
    if (!cleanCode) {
      setError("Informe o código do pedido (ex: SMK-261125-1234).");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const qs = email.trim() ? `?email=${encodeURIComponent(email.trim())}` : "";
      const res = await fetch(`/api/store/orders/${encodeURIComponent(cleanCode)}${qs}`);
      if (!res.ok) {
        setError("Pedido não encontrado. Verifique o código e o e-mail informados.");
        setLoading(false);
        return;
      }
      router.push(`/loja/pedido/${encodeURIComponent(cleanCode)}`);
    } catch {
      setError("Erro ao consultar pedido. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "620px", margin: "40px auto", padding: "0 8px" }}>
      <div
        style={{
          background: "var(--store-surface)",
          border: "1px solid var(--store-border-strong)",
          borderRadius: "20px",
          padding: "36px 28px",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.45)",
        }}
      >
        <span className="store-hero-badge" style={{ marginBottom: "14px", display: "inline-block" }}>
          Central de Rastreamento & Downloads
        </span>

        <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#fff", marginBottom: "10px" }}>
          Rastrear Pedido ou Acessar Infoproduto
        </h1>
        <p style={{ fontSize: "14px", color: "var(--store-muted)", lineHeight: "1.6", marginBottom: "24px" }}>
          Digite o código do seu pedido (ex: <code style={{ color: "var(--store-accent)" }}>SMK-261125-1234</code>) para acompanhar o envio via transportadora, consultar o status do PIX ou baixar seus produtos digitais.
        </p>

        <form onSubmit={handleTrack} style={{ display: "grid", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#cbd5e1", marginBottom: "6px" }}>
              Código do Pedido *
            </label>
            <input
              type="text"
              value={orderCode}
              onChange={(e) => setOrderCode(e.target.value.toUpperCase())}
              placeholder="SMK-261125-1234"
              required
              className="store-search-input"
              style={{ borderRadius: "10px", height: "44px", padding: "0 14px" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#cbd5e1", marginBottom: "6px" }}>
              E-mail da Compra (opcional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="store-search-input"
              style={{ borderRadius: "10px", height: "44px", padding: "0 14px" }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                color: "#fca5a5",
                fontSize: "13px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="store-btn store-btn-primary"
            style={{ height: "46px", fontSize: "15px", width: "100%" }}
          >
            {loading ? "Consultando pedido..." : "Consultar Pedido ↗"}
          </button>
        </form>

        <div
          style={{
            marginTop: "24px",
            paddingTop: "20px",
            borderTop: "1px solid var(--store-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            fontSize: "12px",
            color: "var(--store-muted)",
          }}
        >
          <span>Não lembra o código? Fale com nosso assistente no canto inferior direito.</span>
          <Link href="/loja/produtos" style={{ color: "var(--store-accent)", textDecoration: "none", fontWeight: 600 }}>
            Voltar ao catálogo →
          </Link>
        </div>
      </div>
    </div>
  );
}
