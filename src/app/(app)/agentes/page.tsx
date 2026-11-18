import type { Metadata } from "next";
import { CancelRunForm } from "@/components/agents/CancelRunForm";
import { KillSwitchForm } from "@/components/agents/KillSwitchForm";
import { LimitsForm } from "@/components/agents/LimitsForm";
import { StartRunForm } from "@/components/agents/StartRunForm";
import { ToolToggle } from "@/components/agents/ToolToggle";
import { Badge, PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { loadAgents, type AgentOverview } from "@/lib/agents/server";
import {
  AGENT_LABEL,
  AGENT_TOOL_LABEL,
  AGENT_TOOLS,
  isActive,
  isAgentKind,
  RUN_STATUS_LABEL,
  RUN_STATUS_TONE,
  STEP_PHASE_LABEL,
} from "@/lib/agents/types";
import { WORKSPACE_TIMEZONE } from "@/lib/publication/types";
import { createClient } from "@/lib/supabase/server";
import { errorFields, log } from "@/lib/observability/log";
import { findWorkspace, type MemberRole } from "@/lib/tenancy/workspace";

export const metadata: Metadata = { title: "Agentes de IA" };

type Data =
  | { state: "no-workspace" }
  | { state: "error" }
  | { state: "ok"; role: MemberRole; agents: AgentOverview };

async function load(): Promise<Data> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { state: "no-workspace" };
    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return { state: "no-workspace" };
    return { state: "ok", role: workspace.role, agents: await loadAgents(supabase, workspace.organizationId) };
  } catch (error) {
    log("error", "page.agentes", errorFields(error));
    return { state: "error" };
  }
}

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: WORKSPACE_TIMEZONE,
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AgentsPage() {
  const data = await load();
  const ok = data.state === "ok" ? data : null;
  const isOwner = ok?.role === "owner";
  const canOperate = ok?.role === "owner" || ok?.role === "admin";
  const settings = ok?.agents.settings;

  return (
    <div className="page">
      <PageHeader
        eyebrow="04 · Agentes de IA"
        title="Agentes de IA"
        description="Execuções Planner → Executor → Verifier com limites, ferramentas liberadas e kill switch. Nenhum agente publica conteúdo."
      />

      {data.state === "error" ? <p className="feedback feedback-error" role="alert">Não foi possível carregar os agentes agora.</p> : null}
      {data.state === "no-workspace" ? (
        <div className="empty"><p className="empty-title">Workspace ainda não criado</p><p>Ele é criado no primeiro login.</p></div>
      ) : null}

      {ok && settings ? (
        <>
          <section className={`panel ${settings.kill_switch ? "panel-alert" : ""}`} aria-labelledby="kill-titulo">
            <SectionHeading
              id="kill-titulo"
              title="Kill switch"
              aside={<Badge tone={settings.kill_switch ? "danger" : "ok"}>{settings.kill_switch ? "Ligado" : "Desligado"}</Badge>}
            />
            <p className="row-meta">
              {settings.kill_switch
                ? `Nenhuma execução pode começar. Motivo: ${settings.kill_reason ?? "—"}${settings.kill_changed_at ? ` · desde ${dateTime.format(new Date(settings.kill_changed_at))}` : ""}.`
                : "Ligar interrompe na hora todas as execuções ativas e bloqueia novas, até ser desligado."}
            </p>
            {isOwner ? <div className="agents-control"><KillSwitchForm on={settings.kill_switch} /></div> : <p className="muted agents-control">Somente o owner controla o kill switch.</p>}
          </section>

          <div className="split">
            <section className="panel" aria-labelledby="ferramentas-titulo">
              <SectionHeading id="ferramentas-titulo" title="Ferramentas liberadas" aside={<span className="muted">allowlist do banco</span>} />
              <ul className="rows">
                {AGENT_TOOLS.map((tool) => {
                  const enabled = ok.agents.grants.includes(tool);
                  return (
                    <li className="row" key={tool}>
                      <div className="row-main">
                        <p className="row-title">{AGENT_TOOL_LABEL[tool]}</p>
                        <p className="row-meta">{tool === "draft_content" ? "Escrita: só propõe rascunho, nunca aprova nem publica." : "Somente leitura."}</p>
                      </div>
                      <Badge tone={enabled ? "ok" : "neutral"}>{enabled ? "Liberada" : "Bloqueada"}</Badge>
                      {canOperate ? <ToolToggle tool={tool} label={AGENT_TOOL_LABEL[tool]} enabled={enabled} /> : null}
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="panel" aria-labelledby="limites-titulo">
              <SectionHeading
                id="limites-titulo"
                title="Limites"
                aside={<span className="muted">{ok.agents.runsLast24h} de {settings.max_runs_per_day} execuções nas últimas 24 h</span>}
              />
              {isOwner ? (
                <LimitsForm maxRuns={settings.max_runs_per_day} maxSteps={settings.max_steps_per_run} />
              ) : (
                <p className="row-meta">
                  {settings.max_runs_per_day} execuções por 24 h · {settings.max_steps_per_run} passos por execução. Somente o owner altera.
                </p>
              )}
            </section>
          </div>

          {canOperate ? (
            <section className="panel" aria-labelledby="nova-titulo">
              <SectionHeading id="nova-titulo" title="Nova execução" />
              <p className="feedback feedback-info agents-note" role="status">
                O executor do servidor (S14) ainda não está ativo: execuções novas ficam na fila até ele ser ligado.
              </p>
              <StartRunForm limit={settings.max_steps_per_run} disabled={settings.kill_switch} />
            </section>
          ) : null}

          <section className="panel" aria-labelledby="execucoes-titulo">
            <SectionHeading id="execucoes-titulo" title="Execuções recentes" aside={<span className="muted">últimas 20</span>} />
            {ok.agents.runs.length === 0 ? (
              <div className="empty"><p className="empty-title">Nenhuma execução</p><p>Execuções criadas aparecem aqui com cada passo registrado.</p></div>
            ) : (
              <ul className="rows">
                {ok.agents.runs.map((run) => (
                  <li className="row row-top" key={run.id}>
                    <div className="row-main">
                      <p className="row-title">{isAgentKind(run.agent) ? AGENT_LABEL[run.agent] : run.agent} · {run.goal}</p>
                      <p className="row-meta">
                        {dateTime.format(new Date(run.created_at))} · {run.step_count}/{run.max_steps} passos
                        {run.error_code ? ` · ${run.error_code}` : ""}
                        {run.cancel_reason ? ` · ${run.cancel_reason}` : ""}
                      </p>
                      {run.steps.length > 0 ? (
                        <ol className="agent-steps">
                          {run.steps.map((step) => (
                            <li key={step.seq}>
                              <span className="agent-step-phase">{STEP_PHASE_LABEL[step.phase]}</span>
                              {step.tool ? <code>{step.tool}</code> : null}
                              <Badge tone={step.status === "ok" ? "ok" : step.status === "rejected" ? "warn" : "danger"}>{step.status}</Badge>
                              {step.detail ? <span className="muted">{step.detail}</span> : null}
                            </li>
                          ))}
                        </ol>
                      ) : null}
                      {canOperate && isActive(run.status) ? <CancelRunForm runId={run.id} /> : null}
                    </div>
                    <Badge tone={RUN_STATUS_TONE[run.status]}>{RUN_STATUS_LABEL[run.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
