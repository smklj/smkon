/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { ContentItem, ContentStatus } from "@/types/content";
import { contentFingerprint } from "@/lib/hash";

const STORAGE_KEY = "smkon-fila-v1";

const seed: ContentItem[] = [
  {
    id: "c1",
    title: "Achado da semana — fone ANC",
    body: "Testamos o modelo X. Cancelamento excelente, bateria 30h, preço justo. Link na bio.",
    status: "draft",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "c2",
    title: "Comparativo: dois monitores 27\"",
    body: "Modelo A vs B. Um ganha em cores, o outro em taxa de atualização. Recomendação clara no final.",
    status: "pending_review",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "c3",
    title: "Guia rápido de direitos de imagem",
    body: "Lembrete interno: só publicamos ativos com licença validada e disclosure quando aplicável.",
    status: "approved",
    updatedAt: new Date().toISOString(),
  },
];

function nextStatus(current: ContentStatus): ContentStatus | null {
  if (current === "draft") return "pending_review";
  if (current === "pending_review") return "approved";
  if (current === "approved") return "scheduled";
  return null;
}

const statusLabel: Record<ContentStatus, string> = {
  draft: "Rascunho",
  pending_review: "Aguardando revisão",
  approved: "Aprovado",
  scheduled: "Agendado",
};

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

function getServerSnapshot(): string {
  return "";
}

export default function FilaPage() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [items, setItems] = useState<ContentItem[]>(seed);
  const [message, setMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (raw) {
      try {
        setItems(JSON.parse(raw));
      } catch {
        /* keep seed */
      }
    }
  }, [raw, mounted]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, mounted]);

  function transition(id: string, target: ContentStatus) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const fingerprint = contentFingerprint(it);
        return {
          ...it,
          status: target,
          contentHash: target === "approved" || target === "scheduled" ? fingerprint : it.contentHash,
          updatedAt: new Date().toISOString(),
        };
      })
    );
    setMessage(`Status atualizado → ${statusLabel[target]}`);
  }

  function simulateMetricool(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const hash = contentFingerprint(item);
    setMessage(
      `SIMULADO — Enviado para Metricool Review (sem chamada real).\nHash da versão: ${hash}\nTítulo: ${item.title}`
    );
  }

  function reset() {
    const fresh = seed.map((s) => ({ ...s, updatedAt: new Date().toISOString() }));
    setItems(fresh);
    setMessage("Fila reiniciada com dados de demonstração.");
  }

  if (!mounted) {
    return (
      <main className="shell">
        <header className="topbar">
          <Link className="brand" href="/">
            <span className="brand-mark">S</span>
            <span>SMKON</span>
          </Link>
          <span className="environment"><i /> FILA · SPRINT 0</span>
        </header>
        <p style={{ padding: "40px 0", color: "var(--muted)" }}>Carregando fila…</p>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="SMKON início">
          <span className="brand-mark">S</span>
          <span>SMKON</span>
        </Link>
        <span className="environment">
          <i /> FILA · SPRINT 0
        </span>
      </header>

      <section className="hero" style={{ paddingBottom: 40 }}>
        <p className="eyebrow">CONTENT QUEUE · OWNER APPROVAL</p>
        <h1 style={{ fontSize: "clamp(32px,5vw,52px)" }}>
          Máquina de status da fila
        </h1>
        <p className="intro">
          draft → pending_review → approved → scheduled. Aprovação do Owner com hash simples da versão exata. Botão Metricool é apenas simulado.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button className="btn" onClick={reset} type="button">
            Reiniciar demo
          </button>
          <Link href="/" className="btn ghost">
            Voltar
          </Link>
        </div>
      </section>

      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}

      <section className="queue">
        {items.map((item) => {
          const hash = contentFingerprint(item);
          const next = nextStatus(item.status);
          return (
            <article key={item.id} className="card">
              <header className="card-head">
                <h3>{item.title}</h3>
                <span className={`badge status-${item.status}`}>{statusLabel[item.status]}</span>
              </header>
              <p className="body">{item.body}</p>
              <dl className="meta">
                <div>
                  <dt>Hash da versão</dt>
                  <dd>
                    <code>{hash}</code>
                  </dd>
                </div>
                <div>
                  <dt>Atualizado</dt>
                  <dd>{new Date(item.updatedAt).toLocaleString("pt-BR")}</dd>
                </div>
              </dl>

              <div className="actions">
                {item.status === "pending_review" && (
                  <div className="approval">
                    <p>
                      <strong>Owner approval:</strong> confirme o hash acima antes de aprovar. Só a versão com este hash pode avançar.
                    </p>
                    <button
                      className="btn primary"
                      type="button"
                      onClick={() => transition(item.id, "approved")}
                    >
                      Aprovar versão ({hash.slice(0, 6)}…)
                    </button>
                  </div>
                )}

                {next && item.status !== "pending_review" && (
                  <button className="btn" type="button" onClick={() => transition(item.id, next)}>
                    Avançar para {statusLabel[next]}
                  </button>
                )}

                {(item.status === "approved" || item.status === "scheduled") && (
                  <button className="btn warn" type="button" onClick={() => simulateMetricool(item.id)}>
                    Enviar para Metricool Review (simulado)
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

