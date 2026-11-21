"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/PageHeader";
import type { PendingExternalActionRow } from "@/lib/actions/external";

const ACTION_LABEL: Record<string, string> = {
  publish_post: "Publicar post",
  update_bio: "Atualizar bio",
  update_photo: "Atualizar foto",
  update_link: "Atualizar link",
};

export function ExternalActionsPanel() {
  const [items, setItems] = useState<PendingExternalActionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/actions/external", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível carregar as ações pendentes.");
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar ações externas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (active) await load();
    })();
    return () => {
      active = false;
    };
  }, [load]);

  async function handleDecide(
    requestId: string,
    decision: "approved" | "rejected",
    expectedHash: string,
    publishImmediately = false,
  ) {
    setBusyId(requestId);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/actions/external/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, decision, expectedHash }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Não foi possível registrar a decisão.");
      }

      if (decision === "approved" && publishImmediately) {
        const execRes = await fetch("/api/actions/external/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId }),
        });
        const execData = await execRes.json().catch(() => ({}));
        if (!execRes.ok) {
          throw new Error(`Aprovado, mas erro ao publicar no Metricool: ${execData.error}`);
        }
        setNotice("Ação externa aprovada e publicada no Metricool com sucesso!");
      } else {
        setNotice(decision === "approved" ? "Ação externa aprovada com sucesso." : "Ação externa recusada.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao decidir ação externa.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleExecute(requestId: string) {
    setBusyId(requestId);
    setError("");
    setNotice("");
    try {
      const execRes = await fetch("/api/actions/external/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      const execData = await execRes.json().catch(() => ({}));
      if (!execRes.ok) {
        throw new Error(execData.error || "Falha ao publicar ação externa.");
      }
      setNotice("Publicação enviada com sucesso ao Metricool!");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao executar ação externa.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(requestId: string) {
    setBusyId(requestId);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/actions/external/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Não foi possível cancelar a ação.");
      }
      setNotice("Ação externa cancelada.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cancelar ação externa.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="muted">Carregando ações externas...</p>;
  }

  return (
    <div>
      {error ? (
        <p className="feedback feedback-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="feedback feedback-ok" role="status">
          {notice}
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className="empty">
          <p className="empty-title">Nenhuma ação aguardando aprovação ou envio</p>
          <p className="muted">
            Quando agentes ou analistas propuserem publicações ou alterações de perfil, elas aparecerão aqui para
            conferência do hash exato e aprovação humana.
          </p>
        </div>
      ) : (
        <ul className="rows">
          {items.map((item) => {
            const isBusy = busyId === item.id;
            const payload = item.payload || {};
            const network = item.account?.network || "Rede social";
            const handle = item.account?.handle ? `@${item.account.handle}` : item.account?.display_name || "Conta";
            const isApproved = item.status === "approved";

            return (
              <li className="row" key={item.id} style={{ display: "block", padding: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <div>
                    <strong style={{ textTransform: "capitalize" }}>{network}</strong>
                    <span className="muted" style={{ marginLeft: "0.5rem" }}>{handle}</span>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Badge tone={isApproved ? "ok" : "warn"}>
                      {isApproved ? "Aprovado" : "Aguardando aprovação"}
                    </Badge>
                    <Badge tone="neutral">{ACTION_LABEL[item.action] || item.action}</Badge>
                  </div>
                </div>

                {/* Prévia do conteúdo / payload */}
                {typeof payload.caption === "string" && payload.caption.length > 0 ? (
                  <div
                    style={{
                      background: "rgba(255, 255, 255, 0.04)",
                      padding: "0.75rem",
                      borderRadius: "6px",
                      marginBottom: "0.75rem",
                      fontSize: "0.9rem",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {payload.caption}
                  </div>
                ) : null}

                {typeof payload.bio === "string" ? (
                  <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                    <strong>Nova Bio:</strong> {payload.bio}
                  </p>
                ) : null}

                {typeof payload.url === "string" ? (
                  <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                    <strong>Novo Link:</strong>{" "}
                    <a href={payload.url} target="_blank" rel="noopener noreferrer" style={{ wordBreak: "break-all" }}>
                      {payload.url}
                    </a>
                  </p>
                ) : null}

                {/* Hash de Segurança SHA-256 */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "0.8rem",
                    marginBottom: "1rem",
                    background: "rgba(0, 0, 0, 0.2)",
                    padding: "0.4rem 0.6rem",
                    borderRadius: "4px",
                  }}
                >
                  <span className="muted">SHA-256 (Hash Aprovado):</span>
                  <code style={{ fontSize: "0.75rem", letterSpacing: "0.03em" }}>{item.payload_hash}</code>
                </div>

                {/* Botões de Ação */}
                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={isBusy}
                    onClick={() => handleCancel(item.id)}
                    style={{ fontSize: "0.85rem", padding: "0.35rem 0.75rem" }}
                  >
                    Cancelar
                  </button>

                  {!isApproved ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={isBusy}
                        onClick={() => handleDecide(item.id, "rejected", item.payload_hash)}
                        style={{ fontSize: "0.85rem", padding: "0.35rem 0.75rem" }}
                      >
                        Recusar
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={isBusy}
                        onClick={() => handleDecide(item.id, "approved", item.payload_hash, false)}
                        style={{ fontSize: "0.85rem", padding: "0.35rem 0.75rem" }}
                      >
                        Apenas Aprovar
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={isBusy}
                        onClick={() => handleDecide(item.id, "approved", item.payload_hash, true)}
                        style={{ fontSize: "0.85rem", padding: "0.35rem 0.75rem" }}
                      >
                        {isBusy ? "Processando..." : "Aprovar & Publicar"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={isBusy}
                      onClick={() => handleExecute(item.id)}
                      style={{ fontSize: "0.85rem", padding: "0.35rem 0.75rem" }}
                    >
                      {isBusy ? "Publicando..." : "Publicar no Metricool Agora ↗"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
