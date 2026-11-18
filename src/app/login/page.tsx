import type { Metadata } from "next";
import { Logo } from "@/components/brand/Logo";
import { safeNextPath } from "@/lib/http/safe-redirect";
import { signIn } from "./actions";

export const metadata: Metadata = { title: "Entrar" };

type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

const errorMessages: Record<string, string> = {
  "invalid-input": "Confira o e-mail e use uma senha entre 8 e 128 caracteres.",
  "invalid-credentials": "E-mail ou senha inválidos.",
  "rate-limited": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  "workspace-setup": "Não foi possível preparar seu workspace. Tente novamente em instantes.",
  "callback-failed": "O link de acesso expirou ou já foi usado. Peça um novo convite ou redefinição de senha.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = params.error ? errorMessages[params.error] : undefined;
  const next = safeNextPath(params.next, "/");
  const invited = next.startsWith("/convite");

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <Logo variant="horizontal" className="auth-logo" />
        <p className="eyebrow">Plataforma de operação digital</p>
        <h1>Acesse sua operação.</h1>
        <p className="auth-copy">
          {invited
            ? "Entre com o e-mail que recebeu o convite para entrar no workspace."
            : "Entre na sua conta para continuar no ambiente privado da SMKON."}
        </p>
        {error ? <p className="auth-alert" role="alert">{error}</p> : null}
        <form action={signIn} className="auth-form">
          <input type="hidden" name="next" value={next} />
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
          <label htmlFor="password">Senha</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} maxLength={128} />
          <button type="submit" className="button button-primary">Entrar</button>
        </form>
        <p className="auth-footnote">Acesso somente por convite. Se você ainda não tem conta, peça um convite ao administrador do workspace.</p>
      </section>
    </main>
  );
}
