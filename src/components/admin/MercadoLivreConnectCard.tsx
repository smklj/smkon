"use client";

import { useEffect, useState } from "react";

type ConnectResponse = {
  error?: string;
  setupRequired?: boolean;
  missing?: string[];
  organizationId?: string;
  connectionId?: string;
};

type SyncResponse = {
  error?: string;
  syncStatus?: "ready" | "completed" | "blocked";
  pageOffset?: number;
  pageSize?: number;
  persistedCount?: number;
  providerTotal?: number | null;
  nextOffset?: number | null;
  hasMore?: boolean;
  paginationLimitReached?: boolean;
  createdFrom?: string;
  createdTo?: string;
  message?: string;
};

export function MercadoLivreConnectCard({ connected, canManage }: { connected: boolean; canManage: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mercadoLivre") === "connected") {
      window.history.replaceState({}, "", window.location.pathname);
      queueMicrotask(() => setMessage("Conta Mercado Livre conectada com sucesso."));
    }
  }, []);

  async function runPreview() {
    setBusy(true);
    setMessage(null);
    setPreview(null);
    setSyncResult(null);
    try {
      const response = await fetch("/api/integrations/mercado-livre/sync/preview", { method: "POST", cache: "no-store" });
      const result = await response.json() as { error?: string; pageSize?: number; providerTotal?: number | null; currencies?: Array<{ currency: string; orders: number; gross: number; fees: number }> };
      if (!response.ok) throw new Error(result.error ?? "Não foi possível validar a leitura.");
      const currencySummary = (result.currencies ?? []).map((item) =>
        item.currency + ": " + item.orders + " pedidos · bruto " + item.gross.toFixed(2) + " · tarifas estimadas " + item.fees.toFixed(2)
      ).join(" | ");
      setPreview(
        "Dry-run: " + (result.pageSize ?? 0) + " pedidos nesta página; total informado pelo provedor: " +
        (result.providerTotal ?? "indisponível") + ". " + currencySummary + ". Nenhum dado foi gravado."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na validação.");
    } finally {
      setBusy(false);
    }
  }

  async function runSync(action: "next" | "restart" = "next") {
    if (action === "restart" && !window.confirm("Reiniciar o histórico do Mercado Livre desde o início dos últimos 12 meses? Os snapshots existentes serão atualizados idempotentemente.")) {
      return;
    }

    setBusy(true);
    setMessage(null);
    setPreview(null);
    setSyncResult(null);
    try {
      const response = await fetch("/api/integrations/mercado-livre/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
        cache: "no-store",
      });
      const result = await response.json() as SyncResponse;
      if (!response.ok || typeof result.persistedCount !== "number" || !result.syncStatus) {
        throw new Error(result.error ?? "Não foi possível importar os pedidos.");
      }

      if (result.syncStatus === "completed" && result.pageSize === 0) {
        setSyncResult(result.message ?? "O histórico já está concluído.");
        return;
      }

      const pageNumber = Math.floor((result.pageOffset ?? 0) / 50) + 1;
      const stateMessage = result.syncStatus === "ready"
        ? "Cursor salvo. A próxima chamada retoma no offset " + (result.nextOffset ?? "indisponível") + "."
        : result.syncStatus === "blocked" || result.paginationLimitReached
          ? "Limite de paginação atingido; é necessário dividir a janela em intervalos menores."
          : "Fim da janela histórica.";
      setSyncResult(
        "Página " + pageNumber + ": " + result.persistedCount + " snapshot(s) processado(s) de " +
        (result.pageSize ?? 0) + " pedido(s). Total informado: " + (result.providerTotal ?? "indisponível") +
        ". " + stateMessage + " " + (result.message ?? "Nenhum lançamento de liquidação foi criado.")
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na importação.");
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
        const missing = setup.missing?.length
          ? " Configuração pendente: " + setup.missing.join(", ") + "."
          : "";
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
              ? "Conta autorizada. A importação manual grava snapshots sem PII; não gera liquidação financeira."
              : "Conecte sua conta para autorizar a leitura dos dados de vendas."}
          </p>
        </div>
        <button className="button button-primary" type="button" onClick={connect} disabled={busy || !canManage}>
          {busy ? "Preparando…" : connected ? "Renovar autorização" : "Conectar Mercado Livre"}
        </button>
      </div>
      {connected ? (
        <div className="row">
          <button className="button" type="button" onClick={runPreview} disabled={busy || !canManage}>
            Testar leitura
          </button>
          <button className="button button-primary" type="button" onClick={() => runSync("next")} disabled={busy || !canManage}>
            {busy ? "Importando…" : "Importar / retomar histórico"}
          </button>
          <button className="button" type="button" onClick={() => runSync("restart")} disabled={busy || !canManage}>
            Reiniciar histórico
          </button>
        </div>
      ) : null}
      {message ? <p className="feedback feedback-error" role="alert">{message}</p> : null}
      {preview ? <p className="feedback" role="status">{preview}</p> : null}
      {syncResult ? <p className="feedback" role="status">{syncResult}</p> : null}
      <p className="row-meta">
        A importação percorre os últimos 12 meses disponíveis em páginas de até 50 pedidos. O cursor fica no servidor e é retomado após recarregar a tela; repetir páginas é idempotente. A busca de vendedor pode filtrar pedidos cancelados. {!canManage ? "Somente Owner ou Admin pode gerenciar esta integração." : "Nenhum lançamento financeiro ou valor liquidado é criado nesta etapa."}
      </p>
    </div>
  );
}
