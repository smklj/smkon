import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataStudioGrid } from "@/components/data-studio/DataStudioGrid";

export const metadata: Metadata = {
  title: "Data Studio · Prisma REA",
  description:
    "Gerenciador visual de banco de dados e operações do SMKON estilo Prisma Studio com staging buffer e navegação relacional.",
};

export default function DataStudioPage() {
  return (
    <div className="page data-studio-page">
      <PageHeader
        eyebrow="08 · Engenharia Reversa (REA) · Prisma Studio"
        title="SMKON Data Studio"
        description="Visualizador e editor de dados operacionais em formato planilha com staging buffer, diff atômico em lote e navegação relacional."
        actions={
          <>
            <Link className="link" href="/produtos">
              Catálogo de Produtos
            </Link>
            <Link className="link" href="/admin">
              Administração
            </Link>
          </>
        }
      />

      <section className="panel" aria-label="SMKON Data Studio Spreadsheet">
        <DataStudioGrid />
      </section>
    </div>
  );
}
