import { PageSkeleton } from "@/components/ui/PageSkeleton";

/** Resposta imediata ao navegar entre módulos: o shell fica, o conteúdo mostra o esqueleto. */
export default function Loading() {
  return <PageSkeleton metrics panels={2} />;
}
