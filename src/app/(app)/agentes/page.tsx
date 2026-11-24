import type { Metadata } from "next";
import Link from "next/link";
import { CancelRunForm } from "@/components/agents/CancelRunForm";
import { KillSwitchForm } from "@/components/agents/KillSwitchForm";
import { LimitsForm } from "@/components/agents/LimitsForm";
import { MissionControls } from "@/components/agents/MissionControls";
import { MissionForm } from "@/components/agents/MissionForm";
import { StartRunForm } from "@/components/agents/StartRunForm";
import { ToolToggle } from "@/components/agents/ToolToggle";
import { Badge, PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { Pager, pageHref } from "@/components/ui/Pager";
import { failureReason } from "@/lib/agents/detail";
import {
  canControlAgents,
  canManageMissions,
  canOperateRuns,
  loadAgents,
  loadMissions,
  type AgentOverview,
  type MissionList,
} from "@/lib/agents/service";
import {
  AGENT_LABEL,
  AGENT_TOOL_LABEL,
  AGENT_TOOLS,
  describeSchedule,
  isActive,
  isAgentKind,
  MAX_ACTIVE_MISSIONS,
  missionSkipReason,
  RUN_STATUS_LABEL,
  RUN_STATUS_TONE,
  STEP_PHASE_LABEL,
} from "@/lib/agents/types";
import { InvalidCursorError } from "@/lib/pagination/keyset";
import { WORKSPACE_TIMEZONE } from "@/lib/publication/types";
import { createClient } from "@/lib/supabase/server";
import { errorFields, log } from "@/lib/observability/log";
import { findWorkspace, type MemberRole } from "@/lib/tenancy/service";

export const metadata: Metadata = { title: "Agentes de IA" };

type Data =
  | { state: "no-workspace" }
  | { state: "error" }
  | { state: "ok"; role: MemberRole; agents: AgentOverview; missions: MissionList; cursorReset: boolean };

async function load(cursor: string | null): Promise<Data> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { state: "no-workspace" };
    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return { state: "no-workspace" };
    const missions = await loadMissions(supabase, workspace.organizationId);
    try {
      return { state: "ok", role: workspace.role, agents: await loadAgents(supabase, workspace.organizationId, { cursor }), missions, cursorReset: false };
    } catch (error) {
      if (!(error instanceof InvalidCursorError)) throw error;
      return { state: "ok", role: workspace.role, agents: await loadAgents(supabase, workspace.organizationId), missions, cursorReset: true };
    }
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

export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const params = await searchParams;
  const cursor = typeof params.cursor === "string" ? params.cursor : null;
  const data = await load(cursor);
  const ok = data.state === "ok" ? data : null;
  const isOwner = ok ? canControlAgents(ok.role) : false;
  const canOperate = ok ? canOperateRuns(ok.role) : false;
  const canMissions = ok ? canManageMissions(ok.role) : false;
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

          <section className="panel" aria-labelledby="missoes-titulo">
            <SectionHeading
              id="missoes-titulo"
              title="Missões"
              aside={
                ok.missions.state === "ok" ? (
                  <span className="muted">{ok.missions.missions.length} de {MAX_ACTIVE_MISSIONS} · horário de Brasília</span>
                ) : null
              }
            />
            <p className="row-meta">
              Uma missão coloca uma execução na fila sozinha, no horário agendado. Ela respeita o kill switch, os limites e as
              ferramentas liberadas, e não cria outra execução enquanto a anterior estiver ativa.
            </p>
            {ok.missions.state === "unavailable" ? (
              <p className="feedback feedback-info" role="status">Missões ainda não estão disponíveis neste ambiente (migration pendente).</p>
            ) : ok.missions.missions.length === 0 ? (
              <div className="empty"><p className="empty-title">Nenhuma missão</p><p>Crie uma abaixo para o agente trabalhar sozinho no horário escolhido.</p></div>
            ) : (
              <ul className="rows">
                {ok.missions.missions.map((mission) => {
                  const skipped = missionSkipReason(mission.last_skip_reason);
                  return (
                    <li className="row row-top" key={mission.id}>
                      <div className="row-main">
                        <p className="row-title">{mission.name}</p>
                        <p className="row-meta">
                          {isAgentKind(mission.agent) ? AGENT_LABEL[mission.agent] : mission.agent} · {describeSchedule(mission)} · até {mission.max_steps} passos
                        </p>
                        <p className="row-meta">
                          {mission.enabled && mission.next_run_at ? `Próxima: ${dateTime.format(new Date(mission.next_run_at))}` : "Pausada"}
                          {mission.last_enqueued_at ? ` · última na fila: ${dateTime.format(new Date(mission.last_enqueued_at))}` : ""}
                          {mission.last_run_id ? <> · <Link href={`/agentes/${mission.last_run_id}`}>ver execução</Link></> : null}
                        </p>
                        {skipped && mission.last_skipped_at ? (
                          <p className="row-meta">Pulou em {dateTime.format(new Date(mission.last_skipped_at))}: {skipped}.</p>
                        ) : null}
                        {canMissions ? <MissionControls missionId={mission.id} name={mission.name} enabled={mission.enabled} /> : null}
                      </div>
                      <Badge tone={mission.enabled ? "ok" : skipped ? "warn" : "neutral"}>{mission.enabled ? "Ativa" : "Pausada"}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
            {canMissions && ok.missions.state === "ok" ? (
              <>
                <h3 className="subheading">Nova missão</h3>
                <MissionForm
                  limit={settings.max_steps_per_run}
                  disabled={settings.kill_switch || ok.missions.missions.length >= MAX_ACTIVE_MISSIONS}
                />
              </>
            ) : null}
          </section>

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
            <SectionHeading
              id="execucoes-titulo"
              title="Execuções recentes"
              aside={<span className="muted">{cursor && !ok.cursorReset ? "páginas anteriores" : "mais recentes primeiro"}</span>}
            />
            {ok.cursorReset ? (
              <p className="feedback feedback-info" role="status">O link de paginação não é mais válido. Mostrando as execuções mais recentes.</p>
            ) : null}
            {ok.agents.runs.length === 0 ? (
              <div className="empty"><p className="empty-title">Nenhuma execução</p><p>Execuções criadas aparecem aqui com cada passo registrado.</p></div>
            ) : (
              <ul className="rows">
                {ok.agents.runs.map((run) => (
                  <li className="row row-top" key={run.id}>
                    <div className="row-main">
                      <Link className="row-title" href={`/agentes/${run.id}`}>{isAgentKind(run.agent) ? AGENT_LABEL[run.agent] : run.agent} · {run.goal}</Link>
                      <p className="row-meta">
                        {dateTime.format(new Date(run.created_at))} · {run.step_count}/{run.max_steps} passos
                        {run.error_code ? ` · ${failureReason(run.error_code)}` : ""}
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
            <Pager
              shown={ok.agents.runs.length}
              nextHref={ok.agents.nextCursor ? pageHref("/agentes", { cursor: ok.agents.nextCursor }) : null}
              firstHref={cursor && !ok.cursorReset ? pageHref("/agentes", {}) : null}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
