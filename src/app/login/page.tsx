import Link from "next/link";
import { signIn, signUp } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

const errorMessages: Record<string, string> = {
  "invalid-input": "Confira o e-mail e use uma senha entre 8 e 128 caracteres.",
  "invalid-credentials": "E-mail ou senha inválidos.",
  "signup-failed": "Não foi possível criar a conta. Verifique os dados e tente novamente.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = params.error ? errorMessages[params.error] : undefined;

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <Link className="auth-brand" href="/">SMKON</Link>
        <p className="eyebrow">CONTROL CENTER</p>
        <h1>Acesse sua operação.</h1>
        <p className="auth-copy">Entre na sua conta para continuar no ambiente privado da SMKON.</p>
        {error ? <p className="auth-alert" role="alert">{error}</p> : null}
        {params.message === "check-email" ? (
          <p className="auth-success" role="status">Conta criada. Confira seu e-mail para confirmar o acesso.</p>
        ) : null}
        <form action={signIn} className="auth-form">
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
          <label htmlFor="password">Senha</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} maxLength={128} />
          <button type="submit">Entrar</button>
        </form>
        <div className="auth-divider"><span>PRIMEIRO ACESSO</span></div>
        <form action={signUp} className="auth-form">
          <label htmlFor="signup-email">E-mail para cadastro</label>
          <input id="signup-email" name="email" type="email" autoComplete="email" required maxLength={254} />
          <label htmlFor="signup-password">Crie uma senha</label>
          <input id="signup-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
          <button className="auth-secondary" type="submit">Criar conta</button>
        </form>
        <p className="auth-footnote">A confirmação de e-mail pode ser exigida conforme as configurações do Supabase Auth.</p>
      </section>
    </main>
  );
}
