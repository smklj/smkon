import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { findWorkspace } from "@/lib/tenancy/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UntypedCredentialsStore = {
  from: (table: string) => {
    delete: () => {
      eq: (col1: string, val1: string) => {
        eq: (col2: string, val2: string) => Promise<{ error: Error | null }>;
      };
    };
  };
};

/**
 * Disconnects the Mercado Livre integration safely.
 * Permanently removes the encrypted token envelope and updates the connection status.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Entre na sua conta SMKON para desconectar a conta." }, { status: 401 });
    }

    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) {
      return NextResponse.json({ error: "Seu usuário ainda não possui um workspace ativo." }, { status: 409 });
    }
    if (workspace.role !== "owner" && workspace.role !== "admin") {
      return NextResponse.json({ error: "Somente Owner ou Admin pode desconectar a conta." }, { status: 403 });
    }

    const service = createServiceClient();
    if (!service) {
      return NextResponse.json({ error: "Server database credentials are not configured." }, { status: 503 });
    }

    const { data: connection, error: connError } = await supabase
      .from("source_connections")
      .select("id,external_account_id,status")
      .eq("organization_id", workspace.organizationId)
      .eq("provider", "mercado_livre")
      .eq("domain", "owned_sales")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connError || !connection) {
      return NextResponse.json({ error: "Nenhuma conexão do Mercado Livre encontrada neste workspace." }, { status: 404 });
    }

    // Purge credentials irreversibly
    const untypedService = service as unknown as UntypedCredentialsStore;
    const { error: credDeleteError } = await untypedService
      .from("mercado_livre_credentials")
      .delete()
      .eq("connection_id", connection.id)
      .eq("organization_id", workspace.organizationId);

    if (credDeleteError) {
      throw new Error("Could not purge Mercado Livre credentials.");
    }

    // Disable connection status
    const { error: updateError } = await service
      .from("source_connections")
      .update({
        status: "disabled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id)
      .eq("organization_id", workspace.organizationId);

    if (updateError) {
      throw new Error("Could not disable connection status.");
    }

    return NextResponse.json({
      success: true,
      connectionId: connection.id,
      status: "disconnected",
      message: "Conta desconectada e credenciais expurgadas com sucesso.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Falha ao desconectar a conta do Mercado Livre." }, { status: 500 });
  }
}
