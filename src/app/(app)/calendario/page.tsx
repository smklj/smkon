import type { Metadata } from "next";
import Link from "next/link";
import { Badge, PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { JobActions } from "@/components/publication/JobActions";
import { ScheduleForm } from "@/components/publication/ScheduleForm";
import { errorFields, log } from "@/lib/observability/log";
import { listApprovedContent, listPublicationJobs, type ApprovedContent } from "@/lib/publication/repository";
import {
  defaultScheduleValue,
  PUBLICATION_STATUS_LABEL,
  PUBLICATION_STATUS_TONE,
  WORKSPACE_TIMEZONE,
  type PublicationJobRow,
} from "@/lib/publication/types";
import { createClient } from "@/lib/supabase/server";
import { canOperateCalendar } from "@/lib/publication/service";
import { findWorkspace } from "@/lib/tenancy/workspace";

export const metadata: Metadata = { title: "Calendário" };

type Data =
  | { state: "no-workspace" }
  | { state: "error" }
  | { state: "ok"; canEdit: boolean; jobs: PublicationJobRow[]; contents: ApprovedContent[] };

const DAY = 24 * 60 * 60 * 1000;

async function load(): Promise<Data> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { state: "no-workspace" };
    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return { state: "no-workspace" };
    const now = Date.now();
    const [jobs, contents] = await Promise.all([
      listPublicationJobs(supabase, workspace.organizationId, new Date(now - 7 * DAY).toISOString(), new Date(now + 60 * DAY).toISOString()),
      listApprovedContent(supabase, workspace.organizationId),
    ]);
    return { state: "ok", canEdit: canOperateCalendar(workspace.role), jobs, contents };
  } catch (error) {
    log("error", "page.calendario", errorFields(error));
    return { state: "error" };
  }
}

const dayFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: WORKSPACE_TIMEZONE, weekday: "long", day: "2-digit", month: "long" });
const timeFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: WORKSPACE_TIMEZONE, hour: "2-digit", minute: "2-digit" });

function groupByDay(jobs: PublicationJobRow[]): Array<[string, PublicationJobRow[]]> {
  const groups = new Map<string, PublicationJobRow[]>();
  for (const job of jobs) {
    const key = dayFormat.format(new Date(job.scheduled_for));
    groups.set(key, [...(groups.get(key) ?? []), job]);
  }
  return [...groups.entries()];
}

export default async function CalendarPage() {
  const data = await load();
  const jobs = data.state === "ok" ? data.jobs : [];

  return (
    <div className="page">
      <PageHeader
        eyebrow="03 · Content Studio"
        title="Calendário editorial"
        description="Fila de publicação em modo dry-run: o SMKON confere cada agendamento como se fosse publicar, sem enviar nada às redes."
        actions={<Link className="link" href="/studio">Abrir Content Studio</Link>}
      />

      {data.state === "error" ? <p className="feedback feedback-error" role="alert">Não foi possível carregar o calendário agora.</p> : null}

      <section className="panel" aria-labelledby="fila-titulo">
        <SectionHeading id="fila-titulo" title="Próximas publicações" aside={<span className="muted">últimos 7 dias e próximos 60 · horário de Brasília</span>} />
        {data.state === "no-workspace" ? (
          <div className="empty"><p className="empty-title">Workspace ainda não criado</p><p>Ele é criado no primeiro login.</p></div>
        ) : jobs.length === 0 ? (
          <div className="empty"><p className="empty-title">Nada agendado</p><p>Aprove um conteúdo no Studio e agende abaixo.</p></div>
        ) : (
          groupByDay(jobs).map(([day, items]) => (
            <div key={day} className="stack-top">
              <p className="row-meta">{day}</p>
              <ul className="rows">
                {items.map((job) => (
                  <li className="row row-top" key={job.id}>
                    <div className="row-main">
                      <p className="row-title">{job.content_title}</p>
                      <p className="row-meta">
                        {timeFormat.format(new Date(job.scheduled_for))} · {job.channel} · versão {job.content_version}
                        {job.last_run_at ? ` · verificado ${timeFormat.format(new Date(job.last_run_at))}` : ""}
                      </p>
                      {job.checks.length ? (
                        <ul className="reasons">
                          {job.checks.map((check) => (
                            <li key={check.check}>
                              {check.ok ? "✓" : check.severity === "error" ? "✗" : "!"} {check.detail}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {job.status === "cancelled" && job.cancel_reason ? <p className="row-meta">Motivo: {job.cancel_reason}</p> : null}
                      {data.state === "ok" && data.canEdit && job.status !== "cancelled" ? (
                        <JobActions jobId={job.id} label={`${job.content_title} em ${job.channel}`} />
                      ) : null}
                    </div>
                    <Badge tone={PUBLICATION_STATUS_TONE[job.status]}>{PUBLICATION_STATUS_LABEL[job.status]}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      {data.state === "ok" && data.canEdit ? (
        <section className="panel" aria-labelledby="agendar-titulo">
          <SectionHeading id="agendar-titulo" title="Agendar publicação" />
          {data.contents.length === 0 ? (
            <div className="empty"><p className="empty-title">Nenhum conteúdo aprovado</p><p>Aprove a versão de uma peça no Content Studio para agendar.</p></div>
          ) : (
            <ScheduleForm contents={data.contents} defaultWhen={defaultScheduleValue()} />
          )}
        </section>
      ) : null}
    </div>
  );
}
