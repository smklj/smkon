import type { Metadata } from "next";
import { Badge, PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import {
  COMMISSION_DESCRIPTION,
  COMMISSION_LABEL,
  type CommissionStatus,
  formatMoney,
} from "@/lib/finance/commissions";
import { isCommissionStatus } from "@/lib/finance/schema";
import { loadCommissionOverview } from "@/lib/finance/service";
import type { CommissionHistoryRow, CommissionSummary } from "@/lib/finance/types";
import { createClient } from "@/lib/supabase/server";
import { errorFields, log } from "@/lib/observability/log";
import { findWorkspace } from "@/lib/tenancy/workspace";

export const metadata: Metadata = { title: "Financeiro" };

type Data = { state: "no-workspace" } | { state: "error" } | { state: "ok"; summaries: CommissionSummary[]; history: CommissionHistoryRow[] };

const STATE_COLUMNS: Array<{ status: CommissionStatus; key: keyof CommissionSummary }> = [
  { status: "pending", key: "forecast_amount" },
  { status: "approved", key: "approved_amount" },
  { status: "settled", key: "settled_amount" },
  { status: "paid", key: "paid_amount" },
  { status: "cancelled", key: "cancelled_amount" },
  { status: "reversed", key: "reversed_amount" },
];

const TONE: Record<CommissionStatus, "neutral" | "info" | "ok" | "warn" | "danger"> = {
  pending: "neutral",
  approved: "info",
  settled: "warn",
  paid: "ok",
  cancelled: "neutral",
  reversed: "danger",
};

async function load(): Promise<Data> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { state: "no-workspace" };
    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return { state: "no-workspace" };

    const { summaries, history } = await loadCommissionOverview(supabase, workspace.organizationId);
    return { state: "ok", summaries, history };
  } catch (error) {
    log("error", "page.financeiro", errorFields(error));
    return { state: "error" };
  }
}

export default async function FinancePage() {
  const data = await load();
  const summaries = data.state === "ok" ? data.summaries : [];

  return (
    <div className="page">
      <PageHeader
        eyebrow="05 · Financeiro"
        title="Financeiro"
        description="Comissões de afiliado por estado. Cada mudança de estado gera histórico e lançamento imutável no ledger."
      />

      {data.state === "error" ? (
        <p className="feedback feedback-error" role="alert">Não foi possível carregar os dados financeiros agora.</p>
      ) : null}

      <section className="panel" aria-labelledby="comissoes-titulo">
        <SectionHeading id="comissoes-titulo" title="Comissões de afiliado" aside={<span className="muted">valores na moeda de origem</span>} />
        {data.state === "no-workspace" ? (
          <div className="empty">
            <p className="empty-title">Workspace ainda não criado</p>
            <p>Ele é criado no primeiro login ou ao salvar o primeiro conteúdo.</p>
          </div>
        ) : summaries.length === 0 && data.state === "ok" ? (
          <div className="empty">
            <p className="empty-title">Nenhuma comissão registrada</p>
            <p>As comissões aparecem aqui quando a primeira conexão de afiliado for integrada.</p>
          </div>
        ) : (
          summaries.map((summary) => (
            <div key={summary.currency ?? "-"} className="finance-currency">
              <p className="row-meta">{summary.currency} · {summary.conversions ?? 0} conversões</p>
              <dl className="metrics finance-metrics">
                {STATE_COLUMNS.map(({ status, key }) => (
                  <div className="metric" key={status} title={COMMISSION_DESCRIPTION[status]}>
                    <dt>{COMMISSION_LABEL[status]}</dt>
                    <dd>{formatMoney(summary[key] as number | null, summary.currency ?? "BRL")}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))
        )}
      </section>

      <div className="split">
        <section className="panel" aria-labelledby="historico-titulo">
          <SectionHeading id="historico-titulo" title="Últimas mudanças de estado" />
          {data.state === "ok" && data.history.length > 0 ? (
            <ul className="rows">
              {data.history.map((row) => {
                const to = isCommissionStatus(row.to_status) ? row.to_status : "pending";
                const from = row.from_status && isCommissionStatus(row.from_status) ? COMMISSION_LABEL[row.from_status] : "—";
                return (
                  <li className="row" key={row.id}>
                    <div className="row-main">
                      <p className="row-title">{from} → {COMMISSION_LABEL[to]}</p>
                      <p className="row-meta">
                        {row.commission_amount === null ? "sem valor informado" : formatMoney(row.commission_amount, row.currency)} ·{" "}
                        {new Date(row.changed_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <Badge tone={TONE[to]}>{COMMISSION_LABEL[to]}</Badge>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="empty"><p>Nenhuma mudança registrada.</p></div>
          )}
        </section>

        <section className="panel" aria-labelledby="estados-titulo">
          <SectionHeading id="estados-titulo" title="Como os estados funcionam" />
          <ul className="rows">
            {STATE_COLUMNS.map(({ status }) => (
              <li className="row" key={status}>
                <Badge tone={TONE[status]}>{COMMISSION_LABEL[status]}</Badge>
                <p className="row-meta">{COMMISSION_DESCRIPTION[status]}</p>
              </li>
            ))}
          </ul>
          <p className="muted finance-note">
            Caminho: prevista → aprovada → liquidada → paga. Prevista pode ser cancelada; aprovada, liquidada ou paga podem ser estornadas.
            Valores travam ao sair de prevista. Vendas próprias e mídia paga entram nos próximos splits.
          </p>
        </section>
      </div>
    </div>
  );
}
