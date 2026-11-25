"use client";

import React, { useState } from "react";

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function OrderPixBox({
  totalAmountCents,
  qrCodeCopy,
}: {
  orderCode: string;
  totalAmountCents: number;
  qrCodeCopy: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(qrCodeCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div
      style={{
        background: "var(--store-surface)",
        border: "1px solid var(--store-border)",
        borderRadius: "16px",
        padding: "28px",
        textAlign: "center",
        marginBottom: "32px",
      }}
    >
      <span style={{ fontSize: "12px", color: "var(--store-accent)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Pague via PIX com Aprovação Imediata
      </span>
      <h3 style={{ fontSize: "20px", fontWeight: "700", color: "#fff", marginTop: "4px", marginBottom: "8px" }}>
        Valor: {formatBRL(totalAmountCents)}
      </h3>
      <p style={{ fontSize: "13px", color: "var(--store-muted)", maxWidth: "480px", margin: "0 auto 20px" }}>
        Abra o aplicativo do seu banco, escolha <strong>PIX</strong> e escaneie o código ou cole a chave abaixo:
      </p>

      {/* Chave Copia e Cola */}
      <div
        style={{
          maxWidth: "540px",
          margin: "0 auto 16px",
          display: "flex",
          gap: "8px",
        }}
      >
        <input
          type="text"
          readOnly
          value={qrCodeCopy}
          style={{
            flex: 1,
            height: "42px",
            background: "#080d12",
            border: "1px solid var(--store-border)",
            borderRadius: "8px",
            padding: "0 12px",
            color: "var(--store-accent)",
            fontSize: "12px",
            fontFamily: "monospace",
          }}
        />
        <button
          type="button"
          onClick={handleCopy}
          className="store-btn store-btn-primary"
          style={{ padding: "0 18px", height: "42px", fontSize: "13px" }}
        >
          {copied ? "✓ Copiado!" : "Copiar PIX"}
        </button>
      </div>

      <div style={{ fontSize: "11px", color: "var(--store-muted)" }}>
        ⚡ O status desta tela é atualizado automaticamente assim que o pagamento for reconhecido pelo banco.
      </div>
    </div>
  );
}
