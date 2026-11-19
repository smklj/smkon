import type { Metadata } from "next";
import Link from "next/link";
import { Badge, PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { ProductForm } from "@/components/products/ProductForm";
import { Score } from "@/components/products/Score";
import { Pager, pageHref } from "@/components/ui/Pager";
import { createClient } from "@/lib/supabase/server";
import { errorFields, log } from "@/lib/observability/log";
import { InvalidCursorError } from "@/lib/pagination/keyset";
import { canEditProducts, listProducts } from "@/lib/products/server";
import { REVENUE_DOMAIN_LABEL, SOURCE_LABEL, STATUS_LABEL, type ProductRow } from "@/lib/products/types";
import { findWorkspace, type Workspace } from "@/lib/tenancy/workspace";

export const metadata: Metadata = { title: "Produtos" };

type Data =
  | { state: "no-workspace" }
  | { state: "error" }
  | { state: "ok"; workspace: Workspace; products: ProductRow[]; nextCursor: string | null; cursorReset: boolean };

async function load(includeArchived: boolean, cursor: string | null): Promise<Data> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { state: "no-workspace" };
    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) return { state: "no-workspace" };
    try {
      const page = await listProducts(supabase, workspace.organizationId, { includeArchived, cursor });
      return { state: "ok", workspace, products: page.items, nextCursor: page.nextCursor, cursorReset: false };
    } catch (error) {
      if (!(error instanceof InvalidCursorError)) throw error;
      // Link antigo ou adulterado: mostra a primeira página em vez de erro.
      const page = await listProducts(supabase, workspace.organizationId, { includeArchived });
      return { state: "ok", workspace, products: page.items, nextCursor: page.nextCursor, cursorReset: true };
    }
  } catch (error) {
    log("error", "page.produtos", errorFields(error));
    return { state: "error" };
  }
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ arquivados?: string; cursor?: string }> }) {
  const params = await searchParams;
  const includeArchived = params.arquivados === "1";
  const cursor = typeof params.cursor === "string" ? params.cursor : null;
  const data = await load(includeArchived, cursor);
  const archivedParam = includeArchived ? "1" : null;
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
        {data.state === "ok" && data.cursorReset ? (
          <p className="feedback feedback-info" role="status">O link de paginação expirou. Mostrando a primeira página.</p>
        ) : null}
        {data.state === "no-workspace" ? (
          <div className="empty"><p className="empty-title">Workspace ainda não criado</p><p>Ele é criado no primeiro login.</p></div>
        ) : data.state === "ok" && data.products.length === 0 && !cursor ? (
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
        {data.state === "ok" ? (
          <Pager
            shown={data.products.length}
            nextHref={data.nextCursor ? pageHref("/produtos", { arquivados: archivedParam, cursor: data.nextCursor }) : null}
            firstHref={cursor && !data.cursorReset ? pageHref("/produtos", { arquivados: archivedParam }) : null}
          />
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
