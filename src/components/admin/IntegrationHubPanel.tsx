import { Badge } from "@/components/ui/PageHeader";
import {
  REVENUE_PROVIDERS,
  SOCIAL_NETWORKS,
  type IntegrationPhase,
  type SocialNetwork,
} from "@/lib/integrations/registry";
import { CONNECTION_STATUS_LABEL, CONNECTION_STATUS_TONE, type ConnectionStatus } from "@/lib/overview/types";
import { createClient } from "@/lib/supabase/server";
import { errorFields, log } from "@/lib/observability/log";
import { findWorkspace } from "@/lib/tenancy/workspace";

type AccountRow = {
  id: string;
  network: SocialNetwork;
  account_type: string;
  via: "metricool" | "native";
  handle: string | null;
  display_name: string | null;
  status: ConnectionStatus;
};

type State =
  | { state: "ok"; accounts: AccountRow[]; pendingActions: number }
  | { state: "no-workspace" }
  | { state: "not-migrated" }
  | { state: "error" };

const PHASE_LABEL: Record<IntegrationPhase, string> = { active: "Ativa", next: "Próxima", planned: "Planejada" };
const PHASE_TONE: Record<IntegrationPhase, "ok" | "info" | "neutral"> = { active: "ok", next: "info", planned: "neutral" };

function isMissingRelation(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

async function load(): Promise<State> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { state: "no-workspace" };
    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return { state: "no-workspace" };

    const [accounts, pending] = await Promise.all([
      supabase
        .from("social_accounts")
        .select("id,network,account_type,via,handle,display_name,status")
        .eq("organization_id", workspace.organizationId)
        .order("network"),
      supabase
        .from("external_action_requests")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", workspace.organizationId)
        .eq("status", "pending_approval"),
    ]);
    if (isMissingRelation(accounts.error) || isMissingRelation(pending.error)) return { state: "not-migrated" };
    if (accounts.error) throw accounts.error;
    if (pending.error) throw pending.error;
    return { state: "ok", accounts: (accounts.data ?? []) as AccountRow[], pendingActions: pending.count ?? 0 };
  } catch (error) {
    log("error", "admin.integration_hub", errorFields(error));
    return { state: "error" };
  }
}

/** Hub de Conectores: contas sociais reais, o que cada rede permite e provedores de receita. */
export async function IntegrationHubPanel() {
  const data = await load();
  if (data.state === "error") {
    return <p className="feedback feedback-error" role="alert">Não foi possível carregar o hub de integrações agora.</p>;
  }

  const accounts = data.state === "ok" ? data.accounts : [];
  const byNetwork = new Map<SocialNetwork, AccountRow[]>();
  for (const account of accounts) {
    byNetwork.set(account.network, [...(byNetwork.get(account.network) ?? []), account]);
  }

  return (
    <div>
      {data.state === "not-migrated" ? (
        <p className="feedback">
          O banco deste ambiente ainda não tem as tabelas do hub. Aplique a migration do S17 para ver as contas conectadas.
        </p>
      ) : null}
      {data.state === "ok" && data.pendingActions > 0 ? (
        <p className="feedback">
          {data.pendingActions === 1
            ? "1 ação externa aguarda aprovação."
            : `${data.pendingActions} ações externas aguardam aprovação.`}
        </p>
      ) : null}

      <h3 className="subheading">Redes sociais</h3>
      <ul className="rows">
        {SOCIAL_NETWORKS.map((info) => {
          const connected = byNetwork.get(info.network) ?? [];
          return (
            <li className="row" key={info.network}>
              <div className="row-main">
                <p className="row-title">{info.label}</p>
                <p className="row-meta">
                  {connected.length > 0
                    ? connected
                        .map((account) => `${account.handle ? `@${account.handle}` : account.display_name ?? "conta"} (${account.via === "metricool" ? "Metricool" : "API oficial"})`)
                        .join(", ")
                    : info.via.includes("metricool")
                      ? "Nenhuma conta. Conexão pelo Metricool."
                      : "Nenhuma conta. Exige API oficial paga."}
                  {info.manualOnly.length > 0 ? ` · Só no app: ${info.manualOnly.join(", ")}.` : ""}
                </p>
              </div>
              {connected.length > 0 ? (
                <Badge tone={CONNECTION_STATUS_TONE[connected[0].status]}>{CONNECTION_STATUS_LABEL[connected[0].status]}</Badge>
              ) : (
                <Badge>Não conectada</Badge>
              )}
            </li>
          );
        })}
      </ul>

      <h3 className="subheading">Vendas, afiliados e mídia</h3>
      <ul className="rows">
        {REVENUE_PROVIDERS.map((info) => (
          <li className="row" key={info.provider}>
            <div className="row-main">
              <p className="row-title">{info.label}</p>
              <p className="row-meta">{info.summary}</p>
            </div>
            <Badge tone={PHASE_TONE[info.phase]}>{PHASE_LABEL[info.phase]}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
