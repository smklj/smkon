"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { IconArrowUpRight, IconMessage } from "./StoreIcons";

type BotMessage = {
  id: string;
  role: "bot" | "user";
  text: string;
  suggestions?: string[];
  links?: Array<{ label: string; href: string }>;
};

const INITIAL_MESSAGE: BotMessage = {
  id: "welcome",
  role: "bot",
  text: "Olá! Sou o assistente da SMKON Loja. Como posso ajudar hoje? Você pode tirar dúvidas sobre produtos, infoprodutos digitais, frete, PIX ou consultar um pedido (SMK-...).",
  suggestions: [
    "Como funciona a entrega digital?",
    "Prazo e frete",
    "Produtos da Shopee",
    "Rastrear meu pedido",
  ],
};

export function StoreSupportBot({ storeName }: { storeName: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<BotMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const msgCounterRef = useRef(0);

  const nextId = (prefix: string) => {
    msgCounterRef.current += 1;
    return `${prefix}-${msgCounterRef.current}`;
  };

  useEffect(() => {
    if (isOpen) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    const userMsg: BotMessage = {
      id: nextId("user"),
      role: "user",
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/store/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: nextId("bot"),
          role: "bot",
          text: data.reply || "Desculpe, não consegui processar sua pergunta agora.",
          suggestions: Array.isArray(data.suggestions) ? data.suggestions : undefined,
          links: Array.isArray(data.links) ? data.links : undefined,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId("bot-err"),
          role: "bot",
          text: "Sem conexão no momento. Tente novamente em instantes.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 55,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "12px",
      }}
    >
      {isOpen && (
        <div
          role="dialog"
          aria-label={`Suporte ${storeName}`}
          style={{
            width: "min(370px, calc(100vw - 32px))",
            height: "480px",
            background: "var(--store-surface)",
            border: "1px solid var(--store-border)",
            borderRadius: "16px",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.55)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Cabeçalho do Bot */}
          <div
            style={{
              padding: "14px 16px",
              background: "linear-gradient(135deg, rgba(37, 99, 255, 0.22), rgba(124, 58, 237, 0.22))",
              borderBottom: "1px solid var(--store-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Image
                src="/brand/smkon-icon-light.jpg"
                alt="SMKON Bot"
                width={32}
                height={32}
                style={{ borderRadius: "8px", objectFit: "cover" }}
              />
              <div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>
                  Suporte {storeName}
                </div>
                <div style={{ fontSize: "11px", color: "var(--store-accent)" }}>
                  Atendimento online 24h
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Fechar suporte"
              style={{
                background: "none",
                border: "none",
                color: "var(--store-muted)",
                fontSize: "18px",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              ✕
            </button>
          </div>

          {/* Mensagens */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                  gap: "6px",
                }}
              >
                <div
                  style={{
                    maxWidth: "85%",
                    padding: "10px 13px",
                    borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    background: msg.role === "user" ? "var(--store-primary)" : "rgba(255, 255, 255, 0.06)",
                    border: msg.role === "user" ? "none" : "1px solid var(--store-border)",
                    color: "#fff",
                    fontSize: "13px",
                    lineHeight: "1.45",
                    whiteSpace: "pre-line",
                  }}
                >
                  {msg.text}
                </div>

                {msg.links && msg.links.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {msg.links.map((lk) => (
                      <Link
                        key={lk.href}
                        href={lk.href}
                        onClick={() => setIsOpen(false)}
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "var(--store-accent)",
                          background: "rgba(212, 175, 55, 0.1)",
                          border: "1px solid rgba(212, 175, 55, 0.3)",
                          padding: "5px 10px",
                          borderRadius: "8px",
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <span>{lk.label}</span>
                        <IconArrowUpRight size={11} />
                      </Link>
                    ))}
                  </div>
                )}

                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "2px" }}>
                    {msg.suggestions.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => sendMessage(sug)}
                        style={{
                          fontSize: "11px",
                          color: "#cbd5e1",
                          background: "rgba(255, 255, 255, 0.04)",
                          border: "1px solid var(--store-border)",
                          padding: "5px 10px",
                          borderRadius: "999px",
                          cursor: "pointer",
                        }}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div style={{ fontSize: "12px", color: "var(--store-muted)", paddingLeft: "4px" }}>
                Digitando...
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage(input);
            }}
            style={{
              padding: "10px 12px",
              borderTop: "1px solid var(--store-border)",
              display: "flex",
              gap: "8px",
              background: "rgba(0, 0, 0, 0.2)",
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre produtos, frete ou pedido..."
              style={{
                flex: 1,
                height: "38px",
                borderRadius: "8px",
                border: "1px solid var(--store-border)",
                background: "var(--store-surface)",
                color: "#fff",
                padding: "0 12px",
                fontSize: "13px",
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="store-btn store-btn-primary"
              style={{ height: "38px", padding: "0 14px", fontSize: "13px" }}
            >
              Enviar
            </button>
          </form>
        </div>
      )}

      {/* Botão Flutuante */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Abrir suporte da loja"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "12px 18px",
          borderRadius: "999px",
          background: "linear-gradient(135deg, #d4af37 0%, #f3d37a 55%, #b8860b 100%)",
          color: "#050507",
          border: "1px solid rgba(255, 255, 255, 0.35)",
          boxShadow: "0 10px 30px rgba(212, 175, 55, 0.38)",
          cursor: "pointer",
          fontWeight: 800,
          fontSize: "13px",
        }}
      >
        <IconMessage size={16} />
        <span>{isOpen ? "Fechar Suporte" : "Suporte SMKON"}</span>
      </button>
    </div>
  );
}
