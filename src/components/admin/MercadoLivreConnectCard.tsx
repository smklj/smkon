"use client";

import { useEffect, useState } from "react";

type ConnectResponse = {
  error?: string;
  setupRequired?: boolean;
  missing?: string[];
  organizationId?: string;
  connectionId?: string;
};

export function MercadoLivreConnectCard({ connected, canManage }: { connected: boolean; canManage: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mercadoLivre") === "connected") {
      setMessage("Conta Mercado Livre conectada com sucesso.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function runPreview() {
    setBusy(true);
    setMessage(null);
    setPreview(null);
    try {
      const response = await fetch("/api/integrations/mercado-livre/sync/preview", { method: "POST", cache: "no-store" });
      const result = await response.json() as { error?: string; pageSize?: number; providerTotal?: number | null; currencies?: Array<{ currency: string; orders: number; gross: number; fees: number }>; message?: string };
      if (!response.ok) throw new Error(result.error ?? "Não foi possível validar a leitura.");
      const currencySummary = (result.currencies ?? []).map((item) => `${item.currency}: ${item.orders} pedidos · bruto ${item.gross.toFixed(2)} · tarifas estimadas ${item.fees.toFixed(2)}`).join(" | ");
      setPreview(`Dry-run: ${result.pageSize ?? 0} pedidos nesta página; total informado pelo provedor: ${result.providerTotal ?? "indisponível"}. ${currencySummary}. Nenhum dado foi gravado.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na validação.");
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    setBusy(true);
    setMessage(null);
    try {
      const prepared = await fetch("/api/integrations/mercado-livre/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      const setup = await prepared.json() as ConnectResponse;
      if (!prepared.ok || !setup.organizationId || !setup.connectionId) {
        const missing = setup.missing?.length ? ` Configuração pendente: ${setup.missing.join(", ")}.` : "";
        throw new Error((setup.error ?? "Não foi possível preparar a conexão.") + missing);
      }

      const started = await fetch("/api/integrations/mercado-livre/oauth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: setup.organizationId,
          connectionId: setup.connectionId,
        }),
        cache: "no-store",
      });
      const authorization = await started.json() as { authorizationUrl?: string; error?: string };
      if (!started.ok || !authorization.authorizationUrl) {
        throw new Error(authorization.error ?? "Não foi possível iniciar a autorização.");
      }
      window.location.assign(authorization.authorizationUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao iniciar a conexão.");
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="row">
        <div className="row-main">
          <p className="row-title">Mercado Livre</p>
          <p className="row-meta">
            {connected
              ? "Conta autorizada. A sincronização financeira permanece controlada."
              : "Conecte sua conta para autorizar a leitura dos dados de vendas."}
          </p>
        </div>
        <button className="button button-primary" type="button" onClick={connect} disabled={busy || !canManage}>
          {busy ? "Preparando…" : connected ? "Reconectar" : "Conectar Mercado Livre"}
        </button>
      </div>
      {message ? <p className="feedback feedback-error" role="alert">{message}</p> : null}
      {preview ? <p className="feedback" role="status">{preview}</p> : null}
      <p className="row-meta">A autorização acontece no Mercado Livre. O SMKON não recebe sua senha. A leitura de vendas será liberada após a validação da conexão. {!canManage ? "Somente Owner ou Admin pode gerenciar esta integração." : ""}</p>
    </div>
  );
}
