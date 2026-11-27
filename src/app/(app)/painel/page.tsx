import Link from "next/link";
import type { Metadata } from "next";
import { DailyBars } from "@/components/charts/DailyBars";
import { StateBar } from "@/components/charts/StateBar";
import { CountUp } from "@/components/ui/CountUp";
import { Icon } from "@/components/ui/Icon";
import { Badge, PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { formatMoney } from "@/lib/finance/commissions";
import { NAV_ITEMS, STATUS_LABEL } from "@/lib/navigation";
import { onboardingSteps, type OnboardingStep } from "@/lib/overview/onboarding";
import { loadWorkspaceOverview } from "@/lib/overview/server";
import {
  affiliateOpen,
  costPerClick,
  type WorkspaceOverview,
} from "@/lib/overview/types";
import {
  PUBLICATION_STATUS_LABEL,
  PUBLICATION_STATUS_TONE,
  WORKSPACE_TIMEZONE,
  type PublicationStatus,
} from "@/lib/publication/types";
import { createClient } from "@/lib/supabase/server";
import { errorFields, log } from "@/lib/observability/log";
import { findWorkspace } from "@/lib/tenancy/service";

export const metadata: Metadata = { title: "Visão geral" };

type Overview =
  | { state: "no-workspace" }
  | { state: "error" }
  | { state: "ok"; data: WorkspaceOverview; complete: boolean };

async function loadOverview(): Promise<Overview> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { state: "no-workspace" };

    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return { state: "no-workspace" };

    const result = await loadWorkspaceOverview(supabase, workspace.organizationId);
    if (!result.complete) log("warn", "page.overview.partial", { reason: "workspace_overview_missing" });
    return { state: "ok", data: result.overview, complete: result.complete };
  } catch (error) {
    log("error", "page.overview", errorFields(error));
    return { state: "error" };
  }
}

const GOVERNANCE_RULES = [
  "Nenhum conteúdo é publicado sem aprovação humana da versão exata.",
  "Mídia paga, vendas próprias e afiliados ficam em domínios financeiros separados.",
  "Integrações só aparecem como conectadas após autenticação, leitura de dados e teste funcional.",
  "Toda alteração relevante fica registrada na trilha de auditoria.",
  "Gastos, campanhas, pagamentos e publicação externa exigem autorização explícita.",
];

const integer = new Intl.NumberFormat("pt-BR");

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: WORKSPACE_TIMEZONE });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: WORKSPACE_TIMEZONE,
  });
}

function isPublicationStatus(value: string): value is PublicationStatus {
  return value in PUBLICATION_STATUS_LABEL;
}

/** Valor numérico anima na primeira exibição; texto (ex.: "—", "2/3") é mostrado como está. */
function Metric({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{typeof value === "number" ? <CountUp value={value} /> : value}</strong>
      {hint ? <small className="metric-hint">{hint}</small> : null}
    </div>
  );
}

function FinanceDomain({
  code,
  title,
  kind,
  children,
}: {
  code: string;
  title: string;
  kind: string;
  children: React.ReactNode;
}) {
  return (
    <article className="domain">
      <p className="row-meta">{code} · {kind}</p>
      <h3>{title}</h3>
      {children}
    </article>
  );
}

function EmptyDomain({ text }: { text: string }) {
  return <p className="row-meta domain-empty">{text}</p>;
}

/** Some quando todos os passos estiverem feitos. */
function FirstSteps({ steps }: { steps: OnboardingStep[] }) {
  const done = steps.filter((step) => step.done).length;
  if (done === steps.length) return null;
  const next = steps.find((step) => !step.done);
  return (
    <section className="panel first-steps" aria-labelledby="primeiros-passos-titulo">
      <SectionHeading
        id="primeiros-passos-titulo"
        title="Primeiros passos"
        aside={<span className="muted">{done} de {steps.length} concluídos</span>}
      />
      <div className="first-steps-progress" role="progressbar" aria-label="Primeiros passos" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done}>
        <span style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="first-steps-list">
        {steps.map((step) => (
          <li key={step.id} className={`first-step${step.done ? " is-done" : ""}${step === next ? " is-next" : ""}`}>
            <span className="first-step-mark" aria-hidden="true">{step.done ? "✓" : ""}</span>
            <div className="first-step-body">
              <p className="first-step-title">
                {step.title}
                <span className="sr-only">{step.done ? " (concluído)" : " (pendente)"}</span>
              </p>
              {step.done ? null : <p className="row-meta">{step.description}</p>}
            </div>
            {step === next ? (
              <Link className="button button-secondary button-small" href={step.href}>{step.action}</Link>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default async function OverviewPage() {
  const overview = await loadOverview();
  const data = overview.state === "ok" ? overview.data : null;
  const complete = overview.state === "ok" && overview.complete;
  // Só mostra números dos módulos quando vieram do banco; sem a função S12, "—" em vez de zero.
  const show = (value: number | undefined, available = complete) =>
    data && available ? integer.format(value ?? 0) : "—";

  return (
    <div className="page">
      <PageHeader
        eyebrow="01 · Visão geral"
        title="Operação SMKON"
        description="O que precisa da sua atenção hoje, com dados do seu workspace."
        actions={
          <Link className="button button-primary" href="/studio">
            Abrir Content Studio
          </Link>
        }
      />

      {overview.state === "error" ? (
        <p className="feedback feedback-error" role="alert">
          Não foi possível carregar os indicadores agora. Tente novamente em instantes.
        </p>
      ) : null}

      {overview.state === "ok" && !overview.complete ? (
        <p className="feedback feedback-info" role="status">
          Indicadores de produtos, publicação, financeiro e conexões ainda não estão disponíveis neste ambiente.
          Os números de conteúdo abaixo são reais.
        </p>
      ) : null}

      {complete && data ? <FirstSteps steps={onboardingSteps(data)} /> : null}

      <section className="metrics metrics-open" aria-label="Indicadores principais">
        <Metric
          label="Aguardando aprovação"
          value={data ? data.content.draft : "—"}
          hint={data ? `${integer.format(data.content.total)} conteúdos no total` : undefined}
        />
        <Metric
          label="Publicações em 7 dias"
          value={complete && data ? data.publication.next_7_days : "—"}
          hint={complete && data ? `${integer.format(data.publication.dry_run_failed)} com dry-run reprovado` : undefined}
        />
        <Metric
          label="Evidências para revisar"
          value={complete && data ? data.products.evidence_pending : "—"}
          hint={complete && data ? `${integer.format(data.products.total)} produtos no catálogo` : undefined}
        />
        <Metric
          label="Conexões ativas"
          value={complete && data ? `${data.connections.connected}/${data.connections.total}` : "—"}
          hint={complete && data && data.connections.attention > 0 ? `${data.connections.attention} precisam de atenção` : undefined}
        />
      </section>

      <div className="split">
        <section className="panel" aria-labelledby="fila-titulo">
          <SectionHeading id="fila-titulo" title="Fila de aprovação" aside={<Link className="link" href="/studio">Ver tudo</Link>} />
          {overview.state === "no-workspace" ? (
            <div className="empty">
              <p className="empty-title">Seu workspace ainda não foi criado</p>
              <p>Ele é criado automaticamente no primeiro login ou ao salvar o primeiro conteúdo.</p>
            </div>
          ) : data && data.approval_queue.length === 0 ? (
            <div className="empty">
              <p className="empty-title">Nada aguardando aprovação</p>
              <p>Rascunhos salvos no Content Studio aparecem aqui até serem aprovados.</p>
              <Link className="button button-secondary button-small empty-action" href="/studio">Criar conteúdo</Link>
            </div>
          ) : data ? (
            <ul className="rows">
              {data.approval_queue.map((item) => (
                <li key={item.id} className="row">
                  <span className="row-icon"><Icon name="clock" size={16} /></span>
                  <div className="row-main">
                    <p className="row-title">{item.title}</p>
                    <p className="row-meta">{item.product || "Produto não informado"} · v{item.version} · {formatDate(item.updated_at)}</p>
                  </div>
                  <Badge tone="warn">Rascunho</Badge>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="panel" aria-labelledby="publicacoes-titulo">
          <SectionHeading
            id="publicacoes-titulo"
            title="Próximas publicações"
            aside={<Link className="link" href="/calendario">Calendário</Link>}
          />
          {!complete || !data ? (
            <div className="empty"><p>Sem dados da fila de publicação.</p></div>
          ) : data.publication.upcoming.length === 0 ? (
            <div className="empty">
              <p className="empty-title">Nada agendado</p>
              <p>Conteúdo aprovado pode ser agendado no calendário. Nada é publicado de verdade: a fila roda em dry-run.</p>
              <Link className="button button-secondary button-small empty-action" href="/calendario">Agendar no calendário</Link>
            </div>
          ) : (
            <ul className="rows">
              {data.publication.upcoming.map((job) => {
                const status = isPublicationStatus(job.status) ? job.status : "scheduled";
                return (
                  <li key={job.id} className="row">
                    <span className="row-icon"><Icon name="content" size={16} /></span>
                    <div className="row-main">
                      <p className="row-title">{job.title}</p>
                      <p className="row-meta">{job.channel} · {formatDateTime(job.scheduled_for)}</p>
                    </div>
                    <Badge tone={PUBLICATION_STATUS_TONE[status]}>{PUBLICATION_STATUS_LABEL[status]}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {complete && data ? (
        <section className="panel" aria-labelledby="ritmo-titulo">
          <SectionHeading id="ritmo-titulo" title="Ritmo da operação" aside={<span className="muted">por dia · horário de Brasília</span>} />
          <div className="trends">
            <DailyBars
              title="Conteúdos criados · 14 dias"
              points={data.trends.content_created}
              unit={["conteúdo", "conteúdos"]}
              today={data.trends.content_created.at(-1)?.day}
              emptyText="Nenhum conteúdo criado no período."
            />
            <DailyBars
              title="Publicações agendadas · próximos 7 dias"
              points={data.trends.publications_scheduled}
              unit={["publicação", "publicações"]}
              today={data.trends.publications_scheduled[0]?.day}
              emptyText="Nada agendado para a semana (dry-run)."
            />
            <DailyBars
              title="Execuções de agentes · 14 dias"
              points={data.trends.agent_runs}
              unit={["execução", "execuções"]}
              today={data.trends.agent_runs.at(-1)?.day}
              emptyText="Nenhuma execução no período."
            />
          </div>
        </section>
      ) : null}

      <section className="panel" aria-labelledby="financeiro-titulo">
        <SectionHeading
          id="financeiro-titulo"
          title="Financeiro por domínio"
          aside={<Link className="link" href="/financeiro">Detalhes</Link>}
        />
        <p className="muted finance-note-top">
          Domínios nunca são somados entre si. Valores na moeda de origem. Vendas e mídia: últimos {data?.finance.period_days ?? 30} dias.
        </p>
        <div className="domains">
          <FinanceDomain code="R3" title="Afiliados e comissões" kind="receita de parceria">
            {!complete || !data ? (
              <EmptyDomain text="Sem dados." />
            ) : data.finance.affiliate.length === 0 ? (
              <EmptyDomain text="Nenhuma comissão registrada." />
            ) : (
              data.finance.affiliate.map((row) => (
                <div key={row.currency}>
                <StateBar
                  label={`Comissões em ${row.currency} por estado`}
                  segments={[
                    { key: "forecast", label: "Prevista", value: row.forecast, display: formatMoney(row.forecast, row.currency), tone: "s1" },
                    { key: "approved", label: "Aprovada", value: row.approved, display: formatMoney(row.approved, row.currency), tone: "s2" },
                    { key: "settled", label: "Liquidada", value: row.settled, display: formatMoney(row.settled, row.currency), tone: "s3" },
                    { key: "paid", label: "Paga", value: row.paid, display: formatMoney(row.paid, row.currency), tone: "s4" },
                    { key: "reversed", label: "Estornada", value: row.reversed, display: formatMoney(row.reversed, row.currency), tone: "danger" },
                  ]}
                />
                <dl className="domain-figures">
                  <div><dt>Em aberto</dt><dd>{formatMoney(affiliateOpen(row), row.currency)}</dd></div>
                  <div><dt>Paga</dt><dd>{formatMoney(row.paid, row.currency)}</dd></div>
                  <div><dt>Estornada</dt><dd>{formatMoney(row.reversed, row.currency)}</dd></div>
                  <div><dt>Conversões</dt><dd>{integer.format(row.conversions)}</dd></div>
                </dl>
                </div>
              ))
            )}
          </FinanceDomain>

          <FinanceDomain code="R2" title="Vendas próprias" kind="receita de operação">
            {!complete || !data ? (
              <EmptyDomain text="Sem dados." />
            ) : data.finance.owned_sales.length === 0 ? (
              <EmptyDomain text="Nenhum pedido no período. A ingestão de pedidos chega com o primeiro conector (S11)." />
            ) : (
              data.finance.owned_sales.map((row) => (
                <dl className="domain-figures" key={row.currency}>
                  <div><dt>Bruto</dt><dd>{formatMoney(row.gross, row.currency)}</dd></div>
                  <div><dt>Reembolsos</dt><dd>{formatMoney(row.refunds, row.currency)}</dd></div>
                  <div><dt>Taxas</dt><dd>{formatMoney(row.fees, row.currency)}</dd></div>
                  <div><dt>Pedidos</dt><dd>{integer.format(row.orders)}</dd></div>
                </dl>
              ))
            )}
          </FinanceDomain>

          <FinanceDomain code="R1" title="Mídia e anúncios" kind="custo de aquisição">
            {!complete || !data ? (
              <EmptyDomain text="Sem dados." />
            ) : data.finance.paid_media.length === 0 ? (
              <EmptyDomain text="Nenhum gasto registrado no período." />
            ) : (
              data.finance.paid_media.map((row) => {
                const cpc = costPerClick(row);
                return (
                  <dl className="domain-figures" key={row.currency}>
                    <div><dt>Gasto</dt><dd>{formatMoney(row.spend, row.currency)}</dd></div>
                    <div><dt>CPC</dt><dd>{cpc === null ? "—" : formatMoney(cpc, row.currency)}</dd></div>
                    <div><dt>Cliques</dt><dd>{integer.format(row.clicks)}</dd></div>
                    <div><dt>Impressões</dt><dd>{integer.format(row.impressions)}</dd></div>
                  </dl>
                );
              })
            )}
          </FinanceDomain>
        </div>
      </section>

      <div className="split">
        <section className="panel" aria-labelledby="operacao-titulo">
          <SectionHeading id="operacao-titulo" title="Conteúdo e produtos" />
          <ul className="rows">
            <li className="row">
              <span className="row-icon"><Icon name="content" size={16} /></span>
              <div className="row-main">
                <p className="row-title">Conteúdo</p>
                <p className="row-meta">
                  {show(data?.content.draft, true)} rascunhos · {show(data?.content.approved, true)} aprovados · {show(data?.content.archived, true)} arquivados
                </p>
              </div>
            </li>
            <li className="row">
              <span className="row-icon"><Icon name="products" size={16} /></span>
              <div className="row-main">
                <p className="row-title">Produtos</p>
                <p className="row-meta">
                  {show(data?.products.discovered)} descobertos · {show(data?.products.selected)} selecionados · {show(data?.products.active)} ativos · {show(data?.products.scored)} com score
                </p>
              </div>
            </li>
            <li className="row">
              <span className="row-icon"><Icon name="clock" size={16} /></span>
              <div className="row-main">
                <p className="row-title">Fila de publicação (dry-run)</p>
                <p className="row-meta">
                  {show(data?.publication.awaiting_dry_run)} aguardando checagem · {show(data?.publication.dry_run_passed)} aprovados · {show(data?.publication.dry_run_failed)} reprovados
                </p>
              </div>
            </li>
          </ul>
        </section>

        <section className="panel" aria-labelledby="modulos-titulo">
          <SectionHeading id="modulos-titulo" title="Módulos" />
          <ul className="rows">
            {NAV_ITEMS.map((item) => (
              <li key={item.area} className="row">
                <span className="row-icon" style={{ color: item.accent }}><Icon name={item.icon} size={16} /></span>
                <div className="row-main">
                  <p className="row-title">{item.area} · {item.label}</p>
                  <p className="row-meta">{item.summary}</p>
                </div>
                <Badge tone={item.status === "available" ? "ok" : item.status === "building" ? "info" : "neutral"}>
                  {STATUS_LABEL[item.status]}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel" aria-labelledby="regras-titulo">
        <SectionHeading id="regras-titulo" title="Regras de operação" />
        <ol className="rules">
          {GOVERNANCE_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
