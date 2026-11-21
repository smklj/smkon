import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataStudioGrid } from "@/components/data-studio/DataStudioGrid";
import { loadDataStudio } from "@/lib/data-studio/server";

export const metadata: Metadata = {
  title: "Data Studio",
  description: "Explorador somente leitura dos produtos, conteúdos e lançamentos do workspace.",
};

export default async function DataStudioPage() {
  const result = await loadDataStudio();

  return (
    <div className="page">
      <PageHeader
        eyebrow="08 · Segurança e admin"
        title="Data Studio"
        description="Busque, ordene, filtre e exporte os dados reais do workspace. A RLS decide o que cada papel vê."
        actions={
          <Link className="link" href="/admin">
            Voltar para Administração
          </Link>
        }
      />

      <section className="panel" aria-label="Dados do workspace">
        {result.state === "ok" ? <DataStudioGrid data={result.data} /> : null}
        {result.state === "no-workspace" ? (
          <div className="empty">
            <p className="empty-title">Workspace ainda não criado</p>
            <p>Ele é criado no primeiro login.</p>
          </div>
        ) : null}
        {result.state === "error" ? (
          <p className="feedback feedback-error" role="alert">
            Não foi possível carregar os dados agora. Tente de novo em instantes.
          </p>
        ) : null}
      </section>
    </div>
  );
}
