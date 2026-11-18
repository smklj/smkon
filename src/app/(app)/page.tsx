import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/components/ui/Icon";
import { Badge, PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { NAV_ITEMS, STATUS_LABEL } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";
import { findWorkspace } from "@/lib/tenancy/workspace";

export const metadata: Metadata = { title: "Visão geral" };

type QueueItem = { id: string; title: string; product: string; version: number; updated_at: string };

type Overview =
  | { state: "no-workspace" }
  | { state: "error" }
  | {
      state: "ok";
      counts: { total: number; draft: number; approved: number; archived: number };
      queue: QueueItem[];
    };

async function loadOverview(): Promise<Overview> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { state: "no-workspace" };

    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return { state: "no-workspace" };

    const { data, error } = await supabase
      .from("content_items")
      .select("id,title,product,version,status,updated_at")
      .eq("organization_id", workspace.organizationId)
      .order("updated_at", { ascending: false });
    if (error) throw error;

    const rows = data ?? [];
    const count = (status: string) => rows.filter((row) => row.status === status).length;
    return {
      state: "ok",
      counts: { total: rows.length, draft: count("draft"), approved: count("approved"), archived: count("archived") },
      queue: rows.filter((row) => row.status === "draft").slice(0, 5) as QueueItem[],
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        scope: "page.overview",
        message: error instanceof Error ? error.message : (error as { message?: string })?.message ?? "unknown",
      }),
    );
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default async function OverviewPage() {
  const overview = await loadOverview();
  const counts = overview.state === "ok" ? overview.counts : null;
  const metric = (value: number | undefined) => (counts ? String(value ?? 0) : "—");

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

      <section className="metrics" aria-label="Indicadores de conteúdo">
        <div className="metric"><span>Conteúdos</span><strong>{metric(counts?.total)}</strong></div>
        <div className="metric"><span>Aguardando aprovação</span><strong>{metric(counts?.draft)}</strong></div>
        <div className="metric"><span>Aprovados</span><strong>{metric(counts?.approved)}</strong></div>
        <div className="metric"><span>Arquivados</span><strong>{metric(counts?.archived)}</strong></div>
      </section>

      <div className="split">
        <section className="panel" aria-labelledby="fila-titulo">
          <SectionHeading id="fila-titulo" title="Fila de aprovação" aside={<Link className="link" href="/studio">Ver tudo</Link>} />
          {overview.state === "no-workspace" ? (
            <div className="empty">
              <p className="empty-title">Seu workspace ainda não foi criado</p>
              <p>Ele é criado automaticamente quando você salva o primeiro conteúdo no Content Studio.</p>
            </div>
          ) : overview.state === "ok" && overview.queue.length === 0 ? (
            <div className="empty">
              <p className="empty-title">Nada aguardando aprovação</p>
              <p>Rascunhos salvos no Content Studio aparecem aqui até serem aprovados.</p>
            </div>
          ) : overview.state === "ok" ? (
            <ul className="rows">
              {overview.queue.map((item) => (
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
