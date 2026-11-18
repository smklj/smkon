"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/PageHeader";

type Invitation = {
  id: string;
  email: string;
  role: "admin" | "analyst" | "viewer";
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

const ROLE_LABEL: Record<Invitation["role"], string> = { admin: "Admin", analyst: "Analista", viewer: "Leitura" };

function statusOf(item: Invitation): { label: string; tone: "ok" | "warn" | "neutral" | "danger" } {
  if (item.accepted_at) return { label: "Aceito", tone: "ok" };
  if (item.revoked_at) return { label: "Revogado", tone: "neutral" };
  if (new Date(item.expires_at).getTime() <= Date.now()) return { label: "Expirado", tone: "danger" };
  return { label: "Pendente", tone: "warn" };
}

export function InvitationsPanel() {
  const [items, setItems] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [acceptUrl, setAcceptUrl] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Invitation["role"]>("viewer");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/invitations", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) throw new Error(body.error || "Não foi possível carregar os convites.");
      setItems(body.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os convites.");
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

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setAcceptUrl("");
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Não foi possível criar o convite.");
      if (body.created) {
        setAcceptUrl(body.acceptUrl);
        setNotice("Convite criado. Copie o link abaixo e envie ao convidado: ele não será exibido de novo.");
        setEmail("");
      } else {
        setNotice("Já existe um convite pendente para este e-mail. Para gerar um novo link, revogue o atual.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar o convite.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!window.confirm("Revogar este convite? O link deixará de funcionar.")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/invitations?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Não foi possível revogar.");
      setNotice("Convite revogado.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível revogar.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(acceptUrl);
      setNotice("Link copiado. Ele não será exibido de novo.");
    } catch {
      setNotice("Selecione e copie o link manualmente.");
    }
  }

  if (forbidden) {
    return <p className="muted">Apenas owner ou admin gerenciam convites.</p>;
  }

  return (
    <div className="invitations">
      <form className="invite-row" onSubmit={invite}>
        <label className="sr-only" htmlFor="invite-email">E-mail do convidado</label>
        <input
          id="invite-email"
          type="email"
          placeholder="email@empresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={254}
          disabled={busy}
        />
        <label className="sr-only" htmlFor="invite-role">Papel</label>
        <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as Invitation["role"])} disabled={busy}>
          <option value="viewer">Leitura</option>
          <option value="analyst">Analista</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" className="button button-primary" disabled={busy}>
          {busy ? "Enviando…" : "Convidar"}
        </button>
      </form>

      {error ? <p className="feedback feedback-error" role="alert">{error}</p> : null}
      {notice ? <p className="feedback feedback-ok" role="status">{notice}</p> : null}
      {acceptUrl ? (
        <div className="invite-link">
          <input readOnly value={acceptUrl} aria-label="Link do convite" onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="button button-secondary" onClick={copyLink}>Copiar link</button>
        </div>
      ) : null}

      {loading ? (
        <div className="skeleton-list" aria-busy="true" aria-label="Carregando convites"><span /><span /></div>
      ) : items.length === 0 ? (
        <div className="empty"><p className="empty-title">Nenhum convite</p><p>Convide pessoas para o workspace com o papel adequado.</p></div>
      ) : (
        <ul className="rows">
          {items.map((item) => {
            const status = statusOf(item);
            const pending = status.label === "Pendente";
            return (
              <li className="row" key={item.id}>
                <div className="row-main">
                  <p className="row-title">{item.email}</p>
                  <p className="row-meta">
                    {ROLE_LABEL[item.role]} · enviado em {new Date(item.created_at).toLocaleDateString("pt-BR")}
                    {pending ? ` · expira em ${new Date(item.expires_at).toLocaleDateString("pt-BR")}` : ""}
                  </p>
                </div>
                <Badge tone={status.tone}>{status.label}</Badge>
                {pending ? (
                  <button type="button" className="link" onClick={() => revoke(item.id)} disabled={busy}>Revogar</button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
