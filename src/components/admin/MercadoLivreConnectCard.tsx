"use client";

import { useEffect, useState } from "react";
import type { MercadoLivreOrderSyncWindow } from "@/lib/integrations/mercado-livre/order-sync-window";

type ConnectResponse = {
  error?: string;
  setupRequired?: boolean;
  missing?: string[];
  organizationId?: string;
  connectionId?: string;
};

type SyncResponse = {
  error?: string;
  pageOffset?: number;
  pageSize?: number;
  persistedCount?: number;
  providerTotal?: number | null;
  nextOffset?: number | null;
  createdFrom?: string;
  createdTo?: string;
  message?: string;
};

export function MercadoLivreConnectCard({ connected, canManage }: { connected: boolean; canManage: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncWindow, setSyncWindow] = useState<MercadoLivreOrderSyncWindow | null>(null);
  const [nextOffset, setNextOffset] = useState<number | null>(null);

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
      const currencySummary = (result.currencies ?? []).map((item) => `${item.currency}: ${item.orders} pedidos · bruto ${item.gross.toFixed(2)} · tarifas estimadas ${item.fees.toFixed(2)}`).join(" | ");
      setPreview(`Dry-run: ${result.pageSize ?? 0} pedidos nesta página; total informado pelo provedor: ${result.providerTotal ?? "indisponível"}. ${currencySummary}. Nenhum dado foi gravado.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na validação.");
    } finally {
      setBusy(false);
    }
  }

  async function runSync(offset = 0, window: MercadoLivreOrderSyncWindow | null = null) {
    setBusy(true);
    setMessage(null);
    setPreview(null);
    setSyncResult(null);
    if (offset === 0) {
      setSyncWindow(null);
      setNextOffset(null);
    }
    try {
      const response = await fetch("/api/integrations/mercado-livre/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offset, ...(window ?? {}) }),
        cache: "no-store",
      });
      const result = await response.json() as SyncResponse;
      if (!response.ok || result.persistedCount === undefined || !result.createdFrom || !result.createdTo) {
        throw new Error(result.error ?? "Não foi possível importar os pedidos.");
      }

      const next = typeof result.nextOffset === "number" ? result.nextOffset : null;
      const pageNumber = Math.floor((result.pageOffset ?? offset) / 50) + 1;
      setSyncWindow({ createdFrom: result.createdFrom, createdTo: result.createdTo });
      setNextOffset(next);
      setSyncResult(
        `Página ${pageNumber}: ${result.persistedCount} snapshot(s) processado(s) de ${result.pageSize ?? 0} pedido(s). Total na janela: ${result.providerTotal ?? "indisponível"}. ${next !== null ? `Próxima página disponível (offset ${next}).` : "Fim da janela."} ${result.message ?? "Sem lançamentos de liquidação."}`,
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
          <button className="button button-primary" type="button" onClick={() => runSync(0)} disabled={busy || !canManage}>
            {busy ? "Importando…" : "Importar histórico (50 por página)"}
          </button>
          {nextOffset !== null && syncWindow ? (
            <button className="button" type="button" onClick={() => runSync(nextOffset, syncWindow)} disabled={busy || !canManage}>
              Importar próxima página
            </button>
          ) : null}
        </div>
      ) : null}
      {message ? <p className="feedback feedback-error" role="alert">{message}</p> : null}
      {preview ? <p className="feedback" role="status">{preview}</p> : null}
      {syncResult ? <p className="feedback" role="status">{syncResult}</p> : null}
      <p className="row-meta">
        A importação percorre os últimos 12 meses disponíveis em páginas de até 50 pedidos. A busca de vendedor pode filtrar pedidos cancelados; repetir uma página é idempotente. {!canManage ? "Somente Owner ou Admin pode gerenciar esta integração." : "Nenhum lançamento financeiro ou valor liquidado é criado nesta etapa."}
      </p>
    </div>
  );
}
