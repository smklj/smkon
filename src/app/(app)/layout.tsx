import { AppShell } from "@/components/shell/AppShell";
import type { WorkspaceOption } from "@/components/shell/WorkspaceSwitcher";
import { errorFields, log } from "@/lib/observability/log";
import { createClient } from "@/lib/supabase/server";
import { loadWorkspaceContext } from "@/lib/tenancy/workspace";
import { signOut } from "./actions";

// Área autenticada: o Proxy já bloqueia anônimos; aqui só lemos o usuário e os workspaces para o shell.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  let workspaces: WorkspaceOption[] = [];
  let activeWorkspaceId: string | null = null;
  if (data.user) {
    try {
      const context = await loadWorkspaceContext(supabase, data.user.id);
      workspaces = context.memberships.map((item) => ({ id: item.organizationId, name: item.name, role: item.role }));
      activeWorkspaceId = context.active?.organizationId ?? null;
    } catch (error) {
      // O seletor é acessório: sem ele, as páginas seguem resolvendo o workspace por conta própria.
      log("error", "shell.workspaces", errorFields(error));
    }
  }

  return (
    <AppShell
      userEmail={data.user?.email ?? null}
      workspaces={workspaces}
      activeWorkspaceId={activeWorkspaceId}
      signOutAction={signOut}
    >
      {children}
    </AppShell>
  );
}
