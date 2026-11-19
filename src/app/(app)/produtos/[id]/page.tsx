import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { EvidenceForm } from "@/components/products/EvidenceForm";
import { ReviewControls } from "@/components/products/ReviewControls";
import { Score } from "@/components/products/Score";
import { StatusForm } from "@/components/products/StatusForm";
import { isUuid } from "@/lib/content/server";
import { formatMoney } from "@/lib/finance/commissions";
import { errorFields, log } from "@/lib/observability/log";
import { canAddEvidence, canEditProducts, getProduct, listEvidence } from "@/lib/products/server";
import { workspaceDate } from "@/lib/products/validation";
import {
  EVIDENCE_KIND_META,
  REVENUE_DOMAIN_LABEL,
  REVIEW_LABEL,
  SOURCE_LABEL,
  TYPE_LABEL,
  type EvidenceRow,
  type ProductRow,
  type ReviewStatus,
} from "@/lib/products/types";
import { createClient } from "@/lib/supabase/server";
import { findWorkspace, type Workspace } from "@/lib/tenancy/workspace";

export const metadata: Metadata = { title: "Produto" };

const REVIEW_TONE: Record<ReviewStatus, "warn" | "ok" | "danger"> = { pending: "warn", verified: "ok", rejected: "danger" };

type Data = { state: "error" } | { state: "ok"; workspace: Workspace; product: ProductRow; evidence: EvidenceRow[] };

async function load(id: string): Promise<Data | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return null;
    const product = await getProduct(supabase, workspace.organizationId, id);
    if (!product) return null;
    const evidence = await listEvidence(supabase, workspace.organizationId, id);
    return { state: "ok", workspace, product, evidence };
  } catch (error) {
    log("error", "page.produto", errorFields(error));
    return { state: "error" };
  }
}

function safeHost(url: string | null): string | null {
  if (!url?.startsWith("https://")) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function evidenceValue(item: EvidenceRow, currency: string): string | null {
  if (item.value === null) return null;
  if (item.kind === "price") return formatMoney(item.value, currency);
  if (item.kind === "commission") return `${item.value}%`;
  if (item.kind === "rating") return `${item.value}/5`;
  if (item.kind === "refund_policy") return `${item.value} dias`;
  return String(item.value);
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await load(id);
  if (!data) notFound();
  if (data.state === "error") {
    return (
      <div className="page">
        <p className="feedback feedback-error" role="alert">Não foi possível carregar o produto agora.</p>
      </div>
    );
  }

  const { product, evidence, workspace } = data;
  const canEdit = canEditProducts(workspace.role);
  const pending = evidence.filter((item) => item.review_status === "pending").length;
  const today = workspaceDate();
  const affiliateHost = safeHost(product.affiliate_url);

  return (
    <div className="page">
      <PageHeader
        eyebrow="02 · Produtos"
        title={product.name}
        description={`${SOURCE_LABEL[product.source]} · ${TYPE_LABEL[product.type]} · ${REVENUE_DOMAIN_LABEL[product.revenue_domain]}`}
        actions={<Link className="link" href="/produtos">Voltar ao catálogo</Link>}
      />

      <div className="split">
        <section className="panel" aria-labelledby="score-titulo">
          <SectionHeading id="score-titulo" title="Score" aside={<Score value={product.score} />} />
          {product.score !== null ? <p className="score-large">{Math.round(product.score)}<span className="muted"> /100</span></p> : null}
          <ul className="reasons">
            {(product.score_reasons.length ? product.score_reasons : ["Nenhuma evidência revisada ainda."]).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </section>

        <section className="panel" aria-labelledby="dados-titulo">
          <SectionHeading id="dados-titulo" title="Dados informados" aside={<span className="muted">não entram no score</span>} />
          <dl className="facts">
            <dt>Preço</dt><dd>{product.price_cents === null ? "—" : formatMoney(product.price_cents / 100, product.currency)}</dd>
            <dt>Comissão</dt><dd>{product.commission_percent === null ? "—" : `${product.commission_percent}%`}</dd>
            <dt>Link de afiliado</dt>
            <dd>{affiliateHost ? <a className="link" href={product.affiliate_url ?? undefined} target="_blank" rel="noopener noreferrer nofollow">{affiliateHost}</a> : "—"}</dd>
          </dl>
          {canEdit ? <div className="stack-top"><StatusForm productId={product.id} status={product.status} /></div> : null}
        </section>
      </div>

      <section className="panel" aria-labelledby="evidencias-titulo">
        <SectionHeading
          id="evidencias-titulo"
          title="Evidências"
          aside={<span className="muted">{evidence.length} registrada(s){pending ? ` · ${pending} pendente(s)` : ""}</span>}
        />
        {evidence.length === 0 ? (
          <div className="empty">
            <p className="empty-title">Nenhuma evidência</p>
            <p>Comece pela página de venda: sem ela verificada, o produto não recebe score.</p>
          </div>
        ) : (
          <ul className="rows">
            {evidence.map((item) => {
              const value = evidenceValue(item, product.currency);
              return (
                <li className="row row-top" key={item.id}>
                  <div className="row-main">
                    <p className="row-meta">
                      {EVIDENCE_KIND_META[item.kind].label}
                      {value ? ` · ${value}` : ""} · observada em {new Date(item.observed_at).toLocaleDateString("pt-BR")}
                    </p>
                    <p className="evidence-claim">{item.claim}</p>
                    <a className="evidence-source" href={item.source_url} target="_blank" rel="noopener noreferrer nofollow">{item.source_url}</a>
                    {item.review_status !== "pending" ? (
                      <p className="row-meta">
                        {REVIEW_LABEL[item.review_status]} em {item.reviewed_at ? new Date(item.reviewed_at).toLocaleDateString("pt-BR") : "—"}
                        {item.review_note ? ` · ${item.review_note}` : ""}
                      </p>
                    ) : canEdit ? (
                      <ReviewControls productId={product.id} evidenceId={item.id} />
                    ) : null}
                  </div>
                  <Badge tone={REVIEW_TONE[item.review_status]}>{REVIEW_LABEL[item.review_status]}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {canAddEvidence(workspace.role) ? (
        <section className="panel" aria-labelledby="nova-evidencia-titulo">
          <SectionHeading id="nova-evidencia-titulo" title="Registrar evidência" />
          <EvidenceForm productId={product.id} today={today} />
        </section>
      ) : null}
    </div>
  );
}
