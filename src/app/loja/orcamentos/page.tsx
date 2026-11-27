"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  calculateSoftwareQuote,
  listSoftwareOptions,
  type SoftwareAddonId,
  type SoftwareProjectType,
  type SoftwareUrgency,
} from "@/lib/store/quote-engine";

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function OrcamentosEngenhariaPage() {
  const options = useMemo(() => listSoftwareOptions(), []);

  const [projectType, setProjectType] = useState<SoftwareProjectType>("ecommerce_store");
  const [addons, setAddons] = useState<SoftwareAddonId[]>(["pix_checkout", "deploy_domain"]);
  const [urgency, setUrgency] = useState<SoftwareUrgency>("standard");
  const [pagesOrEndpoints, setPagesOrEndpoints] = useState(6);

  const [clientName, setClientName] = useState("");
  const [clientWhatsapp, setClientWhatsapp] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<{
    protocol: string;
    whatsappUrl: string | null;
    summaryText: string;
  } | null>(null);

  const quote = useMemo(
    () =>
      calculateSoftwareQuote({
        projectType,
        addons,
        urgency,
        pagesOrEndpoints,
      }),
    [projectType, addons, urgency, pagesOrEndpoints],
  );

  const toggleAddon = (id: SoftwareAddonId) => {
    setAddons((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/store/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          clientWhatsapp,
          clientEmail,
          companyName,
          notes,
          projectType,
          addons,
          urgency,
          pagesOrEndpoints,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível gerar o orçamento.");
        setSubmitting(false);
        return;
      }

      setProposal({
        protocol: data.protocol,
        whatsappUrl: data.whatsappUrl,
        summaryText: data.summaryText,
      });
    } catch {
      setError("Erro de conexão ao gerar orçamento.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Hero do Simulador */}
      <section
        style={{
          background: "linear-gradient(135deg, #0c0d12 0%, #171308 65%, #050507 100%)",
          border: "1px solid var(--store-border-strong)",
          borderRadius: "20px",
          padding: "36px 28px",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)",
        }}
      >
        <span className="store-hero-badge" style={{ marginBottom: "12px", display: "inline-block" }}>
          SMKON Engineering · Orçamento Automatizado
        </span>
        <h1 style={{ fontSize: "clamp(26px, 3.8vw, 38px)", fontWeight: 800, color: "#fff", marginBottom: "10px" }}>
          Simulador Inteligente de Sites, APIs & Sistemas
        </h1>
        <p style={{ fontSize: "15px", color: "var(--store-muted)", maxWidth: "740px", lineHeight: "1.6", margin: 0 }}>
          Monte o escopo do seu projeto de software em tempo real. Calcule investimento estimado, prazo em dias úteis, arquitetura recomendada e gere sua proposta oficial na hora.
        </p>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "28px",
          alignItems: "start",
        }}
      >
        {/* Coluna Esquerda: Configurador */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: "var(--store-surface)",
            border: "1px solid var(--store-border)",
            borderRadius: "18px",
            padding: "26px",
            display: "grid",
            gap: "22px",
          }}
        >
          <div>
            <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#fff", marginBottom: "12px" }}>
              1. Tipo de Solução
            </h2>
            <div style={{ display: "grid", gap: "10px" }}>
              {options.projects.map((proj) => {
                const active = proj.id === projectType;
                return (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => setProjectType(proj.id)}
                    style={{
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: active ? "1px solid var(--store-accent)" : "1px solid var(--store-border)",
                      background: active ? "rgba(212, 175, 55, 0.12)" : "var(--store-card)",
                      color: "#fff",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <span style={{ fontSize: "13px", fontWeight: active ? 700 : 500 }}>{proj.label}</span>
                    <span style={{ fontSize: "12px", color: "var(--store-accent)", fontWeight: 700, whiteSpace: "nowrap" }}>
                      a partir de {formatBRL(proj.baseCents)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#fff", marginBottom: "12px" }}>
              2. Módulos & Integrações
            </h2>
            <div style={{ display: "grid", gap: "8px" }}>
              {options.addons.map((addon) => {
                const checked = addons.includes(addon.id);
                return (
                  <label
                    key={addon.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      background: checked ? "rgba(212, 175, 55, 0.08)" : "var(--store-card)",
                      border: checked ? "1px solid rgba(212, 175, 55, 0.45)" : "1px solid var(--store-border)",
                      cursor: "pointer",
                      fontSize: "13px",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "10px", color: "#fff" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAddon(addon.id)}
                      />
                      {addon.label}
                    </span>
                    <span style={{ color: "var(--store-accent)", fontSize: "12px", fontWeight: 600 }}>
                      +{formatBRL(addon.cents)}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "var(--store-muted)", marginBottom: "6px" }}>
                Telas ou Endpoints estimados ({pagesOrEndpoints})
              </label>
              <input
                type="range"
                min={1}
                max={30}
                value={pagesOrEndpoints}
                onChange={(e) => setPagesOrEndpoints(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#d4af37" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", color: "var(--store-muted)", marginBottom: "6px" }}>
                Prazo / Prioridade
              </label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as SoftwareUrgency)}
                style={{
                  width: "100%",
                  height: "38px",
                  background: "var(--store-card)",
                  border: "1px solid var(--store-border)",
                  borderRadius: "8px",
                  color: "#fff",
                  padding: "0 10px",
                  fontSize: "13px",
                }}
              >
                <option value="standard">Padrão (melhor custo)</option>
                <option value="priority">Prioritário (+15%)</option>
                <option value="express">Expresso / Urgente (+35%)</option>
              </select>
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--store-border)", paddingTop: "18px", display: "grid", gap: "12px" }}>
            <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#fff", margin: 0 }}>
              3. Seus Dados para Gerar a Proposta
            </h2>

            <input
              type="text"
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Seu nome completo *"
              className="store-search-input"
              style={{ borderRadius: "10px", height: "42px", padding: "0 14px" }}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <input
                type="text"
                required
                value={clientWhatsapp}
                onChange={(e) => setClientWhatsapp(e.target.value)}
                placeholder="WhatsApp (com DDD) *"
                className="store-search-input"
                style={{ borderRadius: "10px", height: "42px", padding: "0 14px" }}
              />
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="E-mail (opcional)"
                className="store-search-input"
                style={{ borderRadius: "10px", height: "42px", padding: "0 14px" }}
              />
            </div>

            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Empresa ou projeto (opcional)"
              className="store-search-input"
              style={{ borderRadius: "10px", height: "42px", padding: "0 14px" }}
            />

            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Descreva rapidamente sua ideia, referências ou integrações desejadas..."
              className="store-search-input"
              style={{ borderRadius: "10px", height: "86px", padding: "10px 14px" }}
            />

            {error && (
              <div style={{ color: "#fca5a5", fontSize: "13px" }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="store-btn store-btn-primary"
              style={{ height: "48px", fontSize: "15px", width: "100%" }}
            >
              {submitting ? "Gerando proposta..." : "Gerar Orçamento Oficial ↗"}
            </button>
          </div>
        </form>

        {/* Coluna Direita: Resumo em Tempo Real */}
        <aside
          style={{
            position: "sticky",
            top: "100px",
            background: "linear-gradient(160deg, #13151d 0%, #090a0f 100%)",
            border: "1px solid var(--store-border-strong)",
            borderRadius: "18px",
            padding: "26px",
            display: "grid",
            gap: "18px",
            boxShadow: "0 16px 40px rgba(0, 0, 0, 0.45)",
          }}
        >
          <div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--store-accent)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Estimativa em Tempo Real
            </span>
            <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#fff", marginTop: "6px" }}>
              {quote.projectLabel}
            </h3>
          </div>

          <div
            style={{
              background: "rgba(212, 175, 55, 0.08)",
              border: "1px solid rgba(212, 175, 55, 0.3)",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <div style={{ fontSize: "12px", color: "var(--store-muted)" }}>Investimento estimado</div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--store-accent)", marginTop: "4px" }}>
              {formatBRL(quote.minEstimateCents)} – {formatBRL(quote.maxEstimateCents)}
            </div>
            <div style={{ fontSize: "13px", color: "#fff", marginTop: "6px" }}>
              ⏱️ Prazo estimado: <strong>{quote.estimatedDays} dias úteis</strong>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: "13px", fontWeight: 700, color: "#fff", marginBottom: "8px" }}>
              Entregáveis inclusos no escopo:
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "7px", fontSize: "12px", color: "#d4d4d8" }}>
              {quote.deliverables.map((item) => (
                <li key={item}>✓ {item}</li>
              ))}
            </ul>
          </div>

          <div>
            <h4 style={{ fontSize: "13px", fontWeight: 700, color: "#fff", marginBottom: "8px" }}>
              Stack tecnológica recomendada:
            </h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {quote.recommendedStack.map((tech) => (
                <span
                  key={tech}
                  style={{
                    fontSize: "11px",
                    padding: "4px 10px",
                    borderRadius: "999px",
                    background: "rgba(255, 255, 255, 0.06)",
                    border: "1px solid var(--store-border)",
                    color: "#fff",
                  }}
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {proposal && (
            <div
              style={{
                background: "rgba(34, 197, 94, 0.1)",
                border: "1px solid rgba(34, 197, 94, 0.35)",
                borderRadius: "12px",
                padding: "16px",
                display: "grid",
                gap: "10px",
              }}
            >
              <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--store-success)" }}>
                ✅ Proposta {proposal.protocol} gerada!
              </div>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  fontSize: "11px",
                  color: "#e4e4e7",
                  fontFamily: "inherit",
                  lineHeight: "1.5",
                }}
              >
                {proposal.summaryText}
              </pre>
              {proposal.whatsappUrl && (
                <a
                  href={proposal.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="store-btn store-btn-primary"
                  style={{ textAlign: "center", padding: "10px 14px", fontSize: "13px" }}
                >
                  Enviar Proposta no WhatsApp ↗
                </a>
              )}
            </div>
          )}

          <Link href="/loja" style={{ fontSize: "12px", color: "var(--store-muted)", textDecoration: "none", textAlign: "center" }}>
            ← Voltar para a Loja SMKON
          </Link>
        </aside>
      </div>
    </div>
  );
}
