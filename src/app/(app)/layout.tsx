import { AppShell } from "@/components/shell/AppShell";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

// Área autenticada: o Proxy já bloqueia anônimos; aqui só lemos o usuário para o shell.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return (
    <AppShell userEmail={data.user?.email ?? null} signOutAction={signOut}>
      {children}
    </AppShell>
  );
}
