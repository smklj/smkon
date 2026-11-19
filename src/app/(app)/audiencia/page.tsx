import type { Metadata } from "next";
import Link from "next/link";
import { Badge, PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import {
  AnonymizeForm,
  ConsentForm,
  CorrectionForm,
  NewContactForm,
  RequestForm,
  ResolveRequestForm,
  RevokeAllForm,
} from "@/components/audience/AudienceForms";
import {
  canManageAudience,
  getContact,
  listConsentEvents,
  listConsentState,
  listContacts,
  listRequests,
} from "@/lib/audience/server";
import {
  CHANNEL_LABEL,
  EVIDENCE_LABEL,
  LEGAL_BASIS_LABEL,
  PURPOSE_LABEL,
  REQUEST_CHANNEL_LABEL,
  REQUEST_KIND_LABEL,
  REQUEST_STATUS_LABEL,
  SOURCE_LABEL,
  contactLabel,
  requestDeadline,
  type ConsentEventRow,
  type ConsentStateRow,
  type ContactRow,
  type DeadlineStatus,
  type RequestRow,
} from "@/lib/audience/types";
import { sanitizeSearch } from "@/lib/audience/validation";
import { isUuid } from "@/lib/content/server";
import { todayInBrazil } from "@/lib/media/types";
import { errorFields, log } from "@/lib/observability/log";
import { createClient } from "@/lib/supabase/server";
import { findWorkspace, type Workspace } from "@/lib/tenancy/workspace";

export const metadata: Metadata = { title: "Audiência e CRM" };

type Detail = { contact: ContactRow; events: ConsentEventRow[]; requests: RequestRow[] };

type Data =
  | { state: "no-workspace" }
  | { state: "not-migrated" }
  | { state: "error" }
  | {
      state: "ok";
      workspace: Workspace;
      contacts: ContactRow[];
      consent: ConsentStateRow[];
      openRequests: RequestRow[];
      contactsById: Map<string, ContactRow>;
      detail: Detail | null;
    };

/** Tabela ainda não criada no banco do ambiente (migration do S15 não aplicada). */
function isMissingRelation(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "PGRST205" || code === "42P01";
}

async function load(search: string, includeAnonymized: boolean, contactId: string | null): Promise<Data> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { state: "no-workspace" };
    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return { state: "no-workspace" };
    const org = workspace.organizationId;
    const [contacts, openRequests, selected] = await Promise.all([
      listContacts(supabase, org, { search, includeAnonymized }),
      listRequests(supabase, org, { openOnly: true }),
      contactId ? getContact(supabase, org, contactId) : Promise.resolve(null),
    ]);
    let detail: Detail | null = null;
    if (selected) {
      const [events, requests] = await Promise.all([
        listConsentEvents(supabase, org, selected.id),
        listRequests(supabase, org, { contactId: selected.id }),
      ]);
      detail = { contact: selected, events, requests };
    }
    const ids = Array.from(new Set([...contacts.map((c) => c.id), ...(selected ? [selected.id] : [])]));
    const consent = await listConsentState(supabase, org, ids);
    // Contatos citados nos pedidos abertos (podem estar fora da página atual da lista).
    const missing = openRequests.map((r) => r.contact_id).filter((id) => !contacts.some((c) => c.id === id));
    const extra = await Promise.all(Array.from(new Set(missing)).slice(0, 50).map((id) => getContact(supabase, org, id)));
    const contactsById = new Map<string, ContactRow>();
    for (const contact of [...contacts, ...extra, selected]) if (contact) contactsById.set(contact.id, contact);
    return { state: "ok", workspace, contacts, consent, openRequests, contactsById, detail };
  } catch (error) {
    if (isMissingRelation(error)) return { state: "not-migrated" };
    log("error", "page.audiencia", errorFields(error));
    return { state: "error" };
  }
}

function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

const DEADLINE_BADGE: Record<DeadlineStatus, { tone: "ok" | "warn" | "danger" | "neutral"; label: string }> = {
  overdue: { tone: "danger", label: "Prazo vencido" },
  due_soon: { tone: "warn", label: "Vence em até 3 dias" },
  on_time: { tone: "neutral", label: "No prazo" },
  done: { tone: "ok", label: "Resolvido" },
};

function ConsentSummary({ state }: { state: ConsentStateRow[] }) {
  const granted = state.filter((s) => s.granted);
  if (state.length === 0) return <Badge>Sem registro de consentimento</Badge>;
  if (granted.length === 0) return <Badge tone="warn">Tudo revogado</Badge>;
  return <Badge tone="ok">{granted.length} consentimento(s) ativo(s)</Badge>;
}

function hrefFor(params: { q?: string; anonimizados?: boolean; contato?: string }): string {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.anonimizados) query.set("anonimizados", "1");
  if (params.contato) query.set("contato", params.contato);
  const value = query.toString();
  return value ? `/audiencia?${value}` : "/audiencia";
}

export default async function AudiencePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; contato?: string; anonimizados?: string }>;
}) {
  const params = await searchParams;
  const search = sanitizeSearch(params.q);
  const includeAnonymized = params.anonimizados === "1";
  const contactId = isUuid(params.contato) ? params.contato : null;
  const data = await load(search, includeAnonymized, contactId);
  const canManage = data.state === "ok" && canManageAudience(data.workspace.role);
  const today = todayInBrazil();
  const now = new Date();

  return (
    <div className="page">
      <PageHeader
        eyebrow="07 · Audiência e CRM"
        title="Audiência e CRM"
        description="Contatos com origem, finalidade e base legal; consentimento com prova e histórico imutável; pedidos do titular com prazo de 15 dias. Nenhuma mensagem é enviada daqui."
      />

      {data.state === "error" ? <p className="feedback feedback-error" role="alert">Não foi possível carregar a audiência agora.</p> : null}
      {data.state === "not-migrated" ? (
        <p className="feedback feedback-info" role="status">
          O módulo de audiência ainda não foi ativado no banco deste ambiente (migration do S15 pendente). Nada foi perdido.
        </p>
      ) : null}
      {data.state === "no-workspace" ? (
        <div className="empty"><p className="empty-title">Workspace ainda não criado</p><p>Ele é criado no primeiro login.</p></div>
      ) : null}

      {data.state === "ok" && data.openRequests.length > 0 ? (
        <section className="panel" aria-labelledby="pedidos-titulo">
          <SectionHeading id="pedidos-titulo" title="Pedidos do titular em aberto" aside={<span className="muted">{data.openRequests.length}</span>} />
          <ul className="rows">
            {data.openRequests.map((request) => {
              const contact = data.contactsById.get(request.contact_id);
              const deadline = DEADLINE_BADGE[requestDeadline(request, now)];
              return (
                <li className="row row-top" key={request.id}>
                  <div className="row-main">
                    <p className="row-title">
                      {REQUEST_KIND_LABEL[request.kind]} ·{" "}
                      <Link className="link" href={hrefFor({ contato: request.contact_id })}>{contact ? contactLabel(contact) : "Contato"}</Link>
                    </p>
                    <p className="row-meta">
                      Recebido em {formatDate(request.received_at)} por {REQUEST_CHANNEL_LABEL[request.received_via].toLowerCase()} · prazo {formatDate(request.due_at)}
                    </p>
                    {request.details ? <p className="row-meta">{request.details}</p> : null}
                    {canManage ? <ResolveRequestForm requestId={request.id} kind={request.kind} /> : null}
                  </div>
                  <div className="evidence-review"><Badge tone={deadline.tone}>{deadline.label}</Badge></div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {data.state === "ok" && data.detail ? (
        <ContactDetail detail={data.detail} consent={data.consent} canManage={canManage} today={today} now={now} />
      ) : null}
      {data.state === "ok" && contactId && !data.detail ? (
        <p className="feedback feedback-error" role="alert">Contato não encontrado neste workspace.</p>
      ) : null}

      {data.state === "ok" ? (
        <section className="panel" aria-labelledby="contatos-titulo">
          <SectionHeading id="contatos-titulo" title="Contatos" aside={<span className="muted">{data.contacts.length}{data.contacts.length === 100 ? "+" : ""}</span>} />
          <form className="inline-form" method="get" action="/audiencia" role="search">
            <label className="sr-only" htmlFor="busca-contatos">Buscar por nome, e-mail ou telefone</label>
            <input id="busca-contatos" name="q" type="search" defaultValue={search} maxLength={80} placeholder="Buscar por nome, e-mail ou telefone" />
            <label className="inline-form"><input type="checkbox" name="anonimizados" value="1" defaultChecked={includeAnonymized} /> Incluir anonimizados</label>
            <button type="submit" className="button button-secondary button-small">Buscar</button>
            {search || includeAnonymized ? <Link className="link" href="/audiencia">Limpar</Link> : null}
          </form>
          {data.contacts.length === 0 ? (
            <div className="empty stack-top">
              <p className="empty-title">{search ? "Nenhum contato encontrado" : "Nenhum contato ainda"}</p>
              <p>{search ? "Tente outro termo." : "Cadastre contatos com a base legal e a prova do consentimento."}</p>
            </div>
          ) : (
            <ul className="rows stack-top">
              {data.contacts.map((contact) => (
                <li className="row" key={contact.id}>
                  <div className="row-main">
                    <p className="row-title">
                      <Link className="link" href={hrefFor({ q: search, anonimizados: includeAnonymized, contato: contact.id })}>{contactLabel(contact)}</Link>
                    </p>
                    <p className="row-meta">
                      {contact.anonymized_at ? `Anonimizado em ${formatDate(contact.anonymized_at)}` : [contact.email, contact.phone].filter(Boolean).join(" · ")}
                      {" · "}{PURPOSE_LABEL[contact.purpose]} · {LEGAL_BASIS_LABEL[contact.legal_basis]} · {SOURCE_LABEL[contact.source]}
                    </p>
                  </div>
                  <div className="evidence-review">
                    {contact.anonymized_at ? <Badge>Anonimizado</Badge> : <ConsentSummary state={data.consent.filter((s) => s.contact_id === contact.id)} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {canManage ? (
        <section className="panel" aria-labelledby="novo-titulo">
          <SectionHeading id="novo-titulo" title="Novo contato" />
          <NewContactForm today={today} />
        </section>
      ) : null}
    </div>
  );
}

function ContactDetail({ detail, consent, canManage, today, now }: {
  detail: Detail;
  consent: ConsentStateRow[];
  canManage: boolean;
  today: string;
  now: Date;
}) {
  const { contact, events, requests } = detail;
  const state = consent.filter((s) => s.contact_id === contact.id);
  const anonymized = Boolean(contact.anonymized_at);
  return (
    <section className="panel" aria-labelledby="contato-titulo">
      <SectionHeading
        id="contato-titulo"
        title={contactLabel(contact)}
        aside={<Link className="link" href="/audiencia">Fechar</Link>}
      />
      <dl className="facts">
        <dt>E-mail</dt><dd>{contact.email ?? "—"}</dd>
        <dt>Telefone</dt><dd>{contact.phone ?? "—"}</dd>
        <dt>Origem</dt><dd>{SOURCE_LABEL[contact.source]}{contact.source_detail ? ` · ${contact.source_detail}` : ""}</dd>
        <dt>Finalidade</dt><dd>{PURPOSE_LABEL[contact.purpose]}</dd>
        <dt>Base legal</dt><dd>{LEGAL_BASIS_LABEL[contact.legal_basis]}</dd>
        <dt>Cadastrado em</dt><dd>{formatDate(contact.created_at)}</dd>
        <dt>Última atividade</dt><dd>{formatDate(contact.last_activity_at)}</dd>
        {anonymized ? <><dt>Anonimizado em</dt><dd>{formatDateTime(contact.anonymized_at!)}</dd></> : null}
      </dl>

      {canManage ? (
        <div className="state-actions stack-top">
          <a className="button button-secondary button-small" href={`/api/audience/contacts/${contact.id}/export`} download>Exportar dados (JSON)</a>
          {!anonymized ? <RevokeAllForm contactId={contact.id} /> : null}
        </div>
      ) : null}
      {canManage && !anonymized ? <CorrectionForm contact={contact} /> : null}

      <h3 className="stack-top">Consentimento atual</h3>
      {state.length === 0 ? (
        <p className="muted">Sem registro de consentimento.</p>
      ) : (
        <p className="chips">
          {state.map((s) => (
            <span key={`${s.purpose}-${s.channel}`}>
              <Badge tone={s.granted ? "ok" : "neutral"}>
                {PURPOSE_LABEL[s.purpose]} · {CHANNEL_LABEL[s.channel]}: {s.granted ? "concedido" : "revogado"} desde {formatDate(s.occurred_at)}
              </Badge>
            </span>
          ))}
        </p>
      )}
      {canManage && !anonymized ? (
        <details className="stack-top">
          <summary className="link">Registrar consentimento ou revogação</summary>
          <div className="stack-top"><ConsentForm contactId={contact.id} today={today} /></div>
        </details>
      ) : null}

      <h3 className="stack-top">Histórico de consentimento</h3>
      {events.length === 0 ? (
        <p className="muted">Nenhum registro.</p>
      ) : (
        <ul className="reasons">
          {events.map((event) => (
            <li key={event.id}>
              <strong>{event.action === "opt_in" ? "Consentiu" : "Revogou"}</strong> · {PURPOSE_LABEL[event.purpose]} · {CHANNEL_LABEL[event.channel]} ·{" "}
              {formatDateTime(event.occurred_at)} · {EVIDENCE_LABEL[event.evidence_type]}
              {event.evidence_ref ? ` · ${event.evidence_ref}` : ""}
              <span className="muted"> · registrado em {formatDateTime(event.created_at)}</span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="stack-top">Pedidos do titular</h3>
      {requests.length === 0 ? (
        <p className="muted">Nenhum pedido.</p>
      ) : (
        <ul className="reasons">
          {requests.map((request) => {
            const deadline = DEADLINE_BADGE[requestDeadline(request, now)];
            return (
              <li key={request.id}>
                {REQUEST_KIND_LABEL[request.kind]} · recebido em {formatDate(request.received_at)} · prazo {formatDate(request.due_at)} ·{" "}
                <Badge tone={request.status === "open" ? deadline.tone : request.status === "completed" ? "ok" : "neutral"}>
                  {request.status === "open" ? deadline.label : REQUEST_STATUS_LABEL[request.status]}
                </Badge>
                {request.details ? <span className="muted"> · {request.details}</span> : null}
                {request.resolution_note ? <span className="muted"> · {request.resolution_note}</span> : null}
              </li>
            );
          })}
        </ul>
      )}
      {canManage && !anonymized ? <RequestForm contactId={contact.id} today={today} /> : null}
      {canManage && !anonymized ? <AnonymizeForm contactId={contact.id} /> : null}
    </section>
  );
}
