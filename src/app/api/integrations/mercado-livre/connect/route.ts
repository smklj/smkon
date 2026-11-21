import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findWorkspace } from "@/lib/tenancy/workspace";
import { loadMercadoLivreTokenKeyring } from "@/lib/integrations/mercado-livre/token-crypto.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Creates/reuses the pending connection for the authenticated active workspace. */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Entre na sua conta SMKON para conectar o Mercado Livre." }, { status: 401 });
    }

    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) {
      return NextResponse.json({ error: "Seu usuário ainda não possui um workspace ativo." }, { status: 409 });
    }
    if (workspace.role !== "owner" && workspace.role !== "admin") {
      return NextResponse.json({ error: "Somente Owner ou Admin pode conectar uma conta." }, { status: 403 });
    }

    const required = [
      "MERCADO_LIVRE_CLIENT_ID",
      "MERCADO_LIVRE_CLIENT_SECRET",
      "MERCADO_LIVRE_REDIRECT_URI",
      "MERCADO_LIVRE_TOKEN_ENCRYPTION_KEY",
      "SUPABASE_SECRET_KEY",
    ];
    const missing = required.filter((name) => !process.env[name]);
    if (missing.length) {
      return NextResponse.json({
        error: "A integração ainda não está configurada neste ambiente.",
        setupRequired: true,
        missing,
      }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }

    // Validate key format/keyring before creating a pending connection.
    loadMercadoLivreTokenKeyring();

    const { data: existing, error: lookupError } = await supabase
      .from("source_connections")
      .select("id,status")
      .eq("organization_id", workspace.organizationId)
      .eq("provider", "mercado_livre")
      .eq("domain", "owned_sales")
      .is("external_account_id", null)
      .in("status", ["pending", "error"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lookupError) throw lookupError;

    let connectionId = existing?.id;
    if (!connectionId) {
      const { data: created, error: insertError } = await supabase
        .from("source_connections")
        .insert({
          organization_id: workspace.organizationId,
          provider: "mercado_livre",
          domain: "owned_sales",
          display_name: "Mercado Livre",
          status: "pending",
        })
        .select("id")
        .single();
      if (insertError || !created) throw insertError ?? new Error("Connection could not be created.");
      connectionId = created.id;
    }

    return NextResponse.json({
      organizationId: workspace.organizationId,
      connectionId,
      status: "ready_to_authorize",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível preparar a conexão do Mercado Livre." }, { status: 500 });
  }
}
