import { Badge } from "@/components/ui/PageHeader";
import { MercadoLivreConnectCard } from "@/components/admin/MercadoLivreConnectCard";
import { REVENUE_DOMAIN_LABEL, type RevenueDomain } from "@/lib/products/types";
import {
  CONNECTION_STATUS_LABEL,
  CONNECTION_STATUS_TONE,
  type ConnectionStatus,
  providerLabel,
} from "@/lib/overview/types";
import { WORKSPACE_TIMEZONE } from "@/lib/publication/types";
import { createClient } from "@/lib/supabase/server";
import { errorFields, log } from "@/lib/observability/log";
import { findWorkspace } from "@/lib/tenancy/service";

type Row = {
  id: string;
  provider: string;
  domain: RevenueDomain;
  display_name: string | null;
  status: ConnectionStatus;
  last_synced_at: string | null;
};

type State = { state: "ok"; rows: Row[]; canManage: boolean } | { state: "no-workspace" } | { state: "error" };

async function load(): Promise<State> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { state: "no-workspace" };
    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return { state: "no-workspace" };

    const { data, error } = await supabase
      .from("source_connections")
      .select("id,provider,domain,display_name,status,last_synced_at")
      .eq("organization_id", workspace.organizationId)
      .order("domain")
      .order("provider");
    if (error) throw error;
    return { state: "ok", rows: data ?? [], canManage: workspace.role === "owner" || workspace.role === "admin" };
  } catch (error) {
    log("error", "admin.connections", errorFields(error));
    return { state: "error" };
  }
}

/** Conexões reais do workspace (public.source_connections), sob RLS. */
export async function ConnectionsPanel() {
  const data = await load();
  if (data.state === "error") {
    return <p className="feedback feedback-error" role="alert">Não foi possível carregar as conexões agora.</p>;
  }

  const rows = data.state === "ok" ? data.rows : [];
  const canManage = data.state === "ok" && data.canManage;
  const mercadoLivreConnected = rows.some((row) => row.provider === "mercado_livre" && row.status === "connected");

  return (
    <div>
      <MercadoLivreConnectCard connected={mercadoLivreConnected} canManage={canManage} />
      {rows.length > 0 ? (
        <ul className="rows">
          {rows.map((row) => (
            <li className="row" key={row.id}>
              <div className="row-main">
                <p className="row-title">{row.display_name || providerLabel(row.provider)}</p>
                <p className="row-meta">
                  {providerLabel(row.provider)} · {REVENUE_DOMAIN_LABEL[row.domain]} ·{" "}
                  {row.last_synced_at
                    ? `última sincronização ${new Date(row.last_synced_at).toLocaleString("pt-BR", { timeZone: WORKSPACE_TIMEZONE })}`
                    : "nunca sincronizada"}
                </p>
              </div>
              <Badge tone={CONNECTION_STATUS_TONE[row.status]}>{CONNECTION_STATUS_LABEL[row.status]}</Badge>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty">
          <p className="empty-title">Nenhuma outra conexão registrada</p>
          <p>As demais integrações aparecerão aqui depois de autenticadas e validadas.</p>
        </div>
      )}
    </div>
  );
}
