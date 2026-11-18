import type { Metadata } from "next";
import Link from "next/link";
import { Badge, PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { ProductForm } from "@/components/products/ProductForm";
import { Score } from "@/components/products/Score";
import { createClient } from "@/lib/supabase/server";
import { errorFields, log } from "@/lib/observability/log";
import { canEditProducts, listProducts } from "@/lib/products/server";
import { REVENUE_DOMAIN_LABEL, SOURCE_LABEL, STATUS_LABEL, type ProductRow } from "@/lib/products/types";
import { findWorkspace, type Workspace } from "@/lib/tenancy/workspace";

export const metadata: Metadata = { title: "Produtos" };

type Data =
  | { state: "no-workspace" }
  | { state: "error" }
  | { state: "ok"; workspace: Workspace; products: ProductRow[] };

async function load(includeArchived: boolean): Promise<Data> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { state: "no-workspace" };
    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return { state: "no-workspace" };
    return { state: "ok", workspace, products: await listProducts(supabase, workspace.organizationId, includeArchived) };
  } catch (error) {
    log("error", "page.produtos", errorFields(error));
    return { state: "error" };
  }
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ arquivados?: string }> }) {
  const params = await searchParams;
  const includeArchived = params.arquivados === "1";
  const data = await load(includeArchived);
  const canEdit = data.state === "ok" && canEditProducts(data.workspace.role);

  return (
    <div className="page">
      <PageHeader
        eyebrow="02 · Produtos"
        title="Inteligência de produtos"
        description="Catálogo com score explicável. O score só considera evidências com link da fonte, verificadas por owner ou admin nos últimos 180 dias."
      />

      {data.state === "error" ? (
        <p className="feedback feedback-error" role="alert">Não foi possível carregar os produtos agora.</p>
      ) : null}

      <section className="panel" aria-labelledby="catalogo-titulo">
        <SectionHeading
          id="catalogo-titulo"
          title="Catálogo"
          aside={
            <Link className="link" href={includeArchived ? "/produtos" : "/produtos?arquivados=1"}>
              {includeArchived ? "Ocultar arquivados" : "Mostrar arquivados"}
            </Link>
          }
        />
        {data.state === "no-workspace" ? (
          <div className="empty"><p className="empty-title">Workspace ainda não criado</p><p>Ele é criado no primeiro login.</p></div>
        ) : data.state === "ok" && data.products.length === 0 ? (
          <div className="empty">
            <p className="empty-title">Nenhum produto cadastrado</p>
            <p>{canEdit ? "Cadastre o primeiro produto abaixo e registre evidências para gerar o score." : "Peça a um owner ou admin para cadastrar produtos."}</p>
          </div>
        ) : data.state === "ok" ? (
          <ul className="rows">
            {data.products.map((product) => (
              <li className="row" key={product.id}>
                <Score value={product.score} />
                <div className="row-main">
                  <Link className="row-title" href={`/produtos/${product.id}`}>{product.name}</Link>
                  <p className="row-meta">
                    {SOURCE_LABEL[product.source]} · {REVENUE_DOMAIN_LABEL[product.revenue_domain]} · atualizado em{" "}
                    {new Date(product.updated_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Badge tone={product.status === "active" ? "ok" : product.status === "archived" ? "neutral" : "info"}>
                  {STATUS_LABEL[product.status]}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {canEdit ? (
        <section className="panel" aria-labelledby="novo-produto-titulo">
          <SectionHeading id="novo-produto-titulo" title="Cadastrar produto" />
          <ProductForm />
        </section>
      ) : null}
    </div>
  );
}
