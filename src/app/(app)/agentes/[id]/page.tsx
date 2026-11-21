import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelRunForm } from "@/components/agents/CancelRunForm";
import { Badge, PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { isUuid } from "@/lib/validation/fields";
import {
  draftFromStep,
  failureReason,
  formatTokens,
  formatUsd,
  parseOutcome,
  prettyPayload,
  stepDetailText,
  summarizePayload,
  usageTotals,
} from "@/lib/agents/detail";
import { canOperateRuns, loadRunDetail, type AgentRunDetail, type AgentStepDetail } from "@/lib/agents/service";
import { AGENT_LABEL, isActive, isAgentKind, RUN_STATUS_LABEL, RUN_STATUS_TONE, STEP_PHASE_LABEL } from "@/lib/agents/types";
import { errorFields, log } from "@/lib/observability/log";
import { WORKSPACE_TIMEZONE } from "@/lib/publication/types";
import { createClient } from "@/lib/supabase/server";
import { findWorkspace, type MemberRole } from "@/lib/tenancy/service";

export const metadata: Metadata = { title: "Execução de agente" };

type Data = { state: "error" } | { state: "ok"; role: MemberRole; run: AgentRunDetail };

async function load(id: string): Promise<Data | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return null;
    const run = await loadRunDetail(supabase, workspace.organizationId, id);
    if (!run) return null;
    return { state: "ok", role: workspace.role, run };
  } catch (error) {
    log("error", "page.agente_execucao", errorFields(error));
    return { state: "error" };
  }
}

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: WORKSPACE_TIMEZONE,
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const STEP_STATUS_LABEL: Record<AgentStepDetail["status"], string> = { ok: "ok", error: "erro", rejected: "reprovado" };

function duration(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return `${ms} ms`;
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

function Payload({ label, value }: { label: string; value: unknown }) {
  const full = prettyPayload(value);
  const summary = summarizePayload(value);
  return (
    <div className="agent-payload">
      <p className="agent-payload-line"><span className="agent-payload-label">{label}</span> <span>{summary}</span></p>
      {summary !== "—" ? (
        <details className="agent-payload-full">
          <summary>Ver {label.toLowerCase()} completa{full.truncated ? " (cortada em 8 KB)" : ""}</summary>
          <pre>{full.text}</pre>
        </details>
      ) : null}
    </div>
  );
}

export default async function AgentRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await load(id);
  if (!data) notFound();
  if (data.state === "error") {
    return (
      <div className="page">
        <p className="feedback feedback-error" role="alert">Não foi possível carregar a execução agora.</p>
        <p><Link className="link" href="/agentes">Voltar aos agentes</Link></p>
      </div>
    );
  }

  const { run, role } = data;
  const canOperate = canOperateRuns(role);
  const reason = failureReason(run.error_code);
  const outcome = parseOutcome(run.outcome);
  const totals = run.usage.state === "ok" ? usageTotals(run.usage.rows) : null;
  const took = duration(run.started_at, run.finished_at);
  const agentLabel = isAgentKind(run.agent) ? AGENT_LABEL[run.agent] : run.agent;

  return (
    <div className="page">
      <PageHeader
        eyebrow="04 · Agentes de IA"
        title="Execução de agente"
        description={`${agentLabel} · ${run.goal}`}
        actions={<Link className="link" href="/agentes">Voltar aos agentes</Link>}
      />

      <div className="split">
        <section className="panel" aria-labelledby="resumo-titulo">
          <SectionHeading id="resumo-titulo" title="Resumo" aside={<Badge tone={RUN_STATUS_TONE[run.status]}>{RUN_STATUS_LABEL[run.status]}</Badge>} />
          <dl className="facts">
            <dt>Criada</dt><dd>{dateTime.format(new Date(run.created_at))}</dd>
            <dt>Iniciada</dt><dd>{run.started_at ? dateTime.format(new Date(run.started_at)) : "—"}</dd>
            <dt>Encerrada</dt><dd>{run.finished_at ? `${dateTime.format(new Date(run.finished_at))}${took ? ` · ${took}` : ""}` : "—"}</dd>
            <dt>Passos</dt><dd>{run.step_count} de {run.max_steps}</dd>
          </dl>
          {reason ? (
            <p className="feedback feedback-error stack-top" role="status">
              <strong>{run.status === "killed" ? "Motivo da interrupção" : "Motivo da falha"}:</strong> {reason}
            </p>
          ) : null}
          {run.cancel_reason ? (
            <p className="feedback feedback-info stack-top" role="status">
              <strong>Motivo do cancelamento:</strong> {run.cancel_reason}
            </p>
          ) : null}
          {canOperate && isActive(run.status) ? <div className="stack-top"><CancelRunForm runId={run.id} /></div> : null}
        </section>

        <section className="panel" aria-labelledby="consumo-titulo">
          <SectionHeading id="consumo-titulo" title="Consumo do modelo" aside={totals ? <span className="muted">custo estimado</span> : null} />
          {run.usage.state === "unavailable" ? (
            <p className="row-meta">O registro de consumo ainda não está disponível neste ambiente (migration pendente).</p>
          ) : totals && totals.calls > 0 ? (
            <>
              <dl className="facts">
                <dt>Custo</dt><dd>{formatUsd(totals.costUsd)}</dd>
                <dt>Chamadas</dt><dd>{totals.calls}</dd>
                <dt>Tokens de entrada</dt><dd>{formatTokens(totals.inputTokens)}</dd>
                <dt>Tokens de saída</dt><dd>{formatTokens(totals.outputTokens)}</dd>
                <dt>Modelo</dt><dd>{totals.models.join(", ")}</dd>
              </dl>
              <ul className="agent-usage">
                {run.usage.rows.map((row, index) => (
                  <li key={`${row.created_at}-${index}`}>
                    <span className="agent-step-phase">{row.phase === "plan" ? "Plano" : "Resumo"}</span>
                    <span className="muted">{formatTokens(row.input_tokens)} → {formatTokens(row.output_tokens)} tokens</span>
                    <span>{formatUsd(row.cost_usd)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="row-meta">Nenhuma chamada ao modelo registrada nesta execução.</p>
          )}
        </section>
      </div>

      {outcome ? (
        <section className="panel" aria-labelledby="resultado-titulo">
          <SectionHeading id="resultado-titulo" title="Resultado verificado" aside={<span className="muted">{outcome.claims.length} afirmação(ões)</span>} />
          <p className="agent-outcome">{outcome.summary}</p>
          {outcome.claims.length ? (
            <ul className="reasons">
              {outcome.claims.map((claim, index) => (
                <li key={index}>
                  {claim.text}
                  {claim.productId ? (
                    <> · <Link className="link" href={`/produtos/${claim.productId}`}>produto e evidências</Link> ({claim.evidenceIds.length} evidência(s) verificada(s))</>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="panel" aria-labelledby="passos-titulo">
        <SectionHeading id="passos-titulo" title="Passos" aside={<span className="muted">Planner → Executor → Verifier</span>} />
        {run.steps.length === 0 ? (
          <div className="empty">
            <p className="empty-title">Nenhum passo registrado</p>
            <p>{isActive(run.status) ? "A execução está na fila ou começando." : "A execução terminou antes do primeiro passo."}</p>
          </div>
        ) : (
          <ol className="rows agent-step-list">
            {run.steps.map((step) => {
              const draft = draftFromStep(step);
              const detail = stepDetailText(step.detail);
              return (
                <li className="row row-top" key={step.seq}>
                  <div className="row-main">
                    <p className="row-title">
                      {step.seq}. {STEP_PHASE_LABEL[step.phase]}
                      {step.tool ? <> · <code>{step.tool}</code></> : null}
                    </p>
                    <p className="row-meta">{dateTime.format(new Date(step.created_at))}</p>
                    <Payload label="Entrada" value={step.input} />
                    <Payload label="Saída" value={step.output} />
                    {detail ? <p className={step.status === "ok" ? "row-meta" : "agent-step-detail"}>{detail}</p> : null}
                    {draft ? (
                      <p className="feedback feedback-info agent-draft" role="status">
                        Rascunho criado{draft.version !== null ? ` (versão ${draft.version})` : ""}, aguardando revisão humana.
                        O agente não aprova nem publica: a aprovação da versão exata é feita no <Link className="link" href="/studio">Content Studio</Link>.
                      </p>
                    ) : null}
                  </div>
                  <Badge tone={step.status === "ok" ? "ok" : step.status === "rejected" ? "warn" : "danger"}>{STEP_STATUS_LABEL[step.status]}</Badge>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
