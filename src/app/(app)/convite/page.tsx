import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { isWellFormedInviteToken } from "@/lib/invitations/token";
import { AcceptForm } from "./accept-form";

export const metadata: Metadata = { title: "Convite" };

type Props = { searchParams: Promise<{ token?: string }> };

export default async function InvitePage({ searchParams }: Props) {
  const { token } = await searchParams;
  const valid = isWellFormedInviteToken(token);

  return (
    <div className="page page-narrow">
      <PageHeader
        eyebrow="Convite"
        title="Entrar no workspace"
        description="Você foi convidado para um workspace SMKON. O convite só funciona com o mesmo e-mail que recebeu o convite."
      />
      <section className="panel">
        {valid ? (
          <AcceptForm token={token} />
        ) : (
          <p className="feedback feedback-error" role="alert">Link de convite inválido ou incompleto.</p>
        )}
      </section>
    </div>
  );
}
