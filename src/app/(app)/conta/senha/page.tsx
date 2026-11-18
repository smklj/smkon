import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { safeNextPath } from "@/lib/http/safe-redirect";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Definir senha" };

type Props = { searchParams: Promise<{ next?: string }> };

export default async function PasswordPage({ searchParams }: Props) {
  const { next } = await searchParams;
  return (
    <div className="page page-narrow">
      <PageHeader eyebrow="Conta" title="Definir senha" description="Crie a senha que você vai usar para entrar no SMKON." />
      <section className="panel">
        <PasswordForm next={safeNextPath(next, "/")} />
      </section>
    </div>
  );
}
