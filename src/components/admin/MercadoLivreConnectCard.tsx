"use client";

import { useState } from "react";

type ConnectResponse = {
  error?: string;
  setupRequired?: boolean;
  missing?: string[];
  organizationId?: string;
  connectionId?: string;
};

export function MercadoLivreConnectCard({ connected }: { connected: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
    <div className="stack-sm">
      <div className="row">
        <div className="row-main">
          <p className="row-title">Mercado Livre</p>
          <p className="row-meta">
            {connected
              ? "Conta autorizada. A sincronização financeira permanece controlada."
              : "Conecte sua conta para autorizar a leitura dos dados de vendas."}
          </p>
        </div>
        <button className="button button-primary" type="button" onClick={connect} disabled={busy}>
          {busy ? "Preparando…" : connected ? "Reconectar" : "Conectar Mercado Livre"}
        </button>
      </div>
      {message ? <p className="feedback feedback-error" role="alert">{message}</p> : null}
      <p className="row-meta">A autorização acontece no Mercado Livre. O SMKON não recebe sua senha.</p>
    </div>
  );
}
