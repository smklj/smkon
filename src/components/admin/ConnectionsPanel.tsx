import { Badge } from "@/components/ui/PageHeader";
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
import { findWorkspace } from "@/lib/tenancy/workspace";

type Row = {
  id: string;
  provider: string;
  domain: RevenueDomain;
  display_name: string | null;
  status: ConnectionStatus;
  last_synced_at: string | null;
};

type State = { state: "ok"; rows: Row[] } | { state: "no-workspace" } | { state: "error" };

async function load(): Promise<State> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { state: "no-workspace" };
    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return { state: "no-workspace" };

    // Só metadados: conta externa, escopos e códigos de erro ficam fora da tela.
    const { data, error } = await supabase
      .from("source_connections")
      .select("id,provider,domain,display_name,status,last_synced_at")
      .eq("organization_id", workspace.organizationId)
      .order("domain")
      .order("provider");
    if (error) throw error;
    return { state: "ok", rows: data ?? [] };
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
  if (data.state === "no-workspace" || data.rows.length === 0) {
    return (
      <div className="empty">
        <p className="empty-title">Nenhuma conexão registrada</p>
        <p>Uma integração só aparece aqui depois de autenticada, com leitura de dados e teste funcional.</p>
      </div>
    );
  }

  return (
    <ul className="rows">
      {data.rows.map((row) => (
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
  );
}
