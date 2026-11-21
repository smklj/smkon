import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { findWorkspace } from "@/lib/tenancy/workspace";
import { decryptMercadoLivreTokens, loadMercadoLivreTokenKeyring } from "@/lib/integrations/mercado-livre/token-crypto.server";
import { refreshMercadoLivreConnection } from "@/lib/integrations/mercado-livre/refresh";
import { mercadoLivreGet } from "@/lib/integrations/mercado-livre/client";
import { normalizeMercadoLivreOrder, type MercadoLivreOrderInput } from "@/lib/integrations/mercado-livre/order-snapshot";
import type { MercadoLivreTokenSet } from "@/lib/integrations/mercado-livre/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderSearch = { paging?: { total?: number }; results?: MercadoLivreOrderInput[] };

function parseTokenSet(value: string): MercadoLivreTokenSet {
  const parsed = JSON.parse(value) as Partial<MercadoLivreTokenSet>;
  if (
    typeof parsed.accessToken !== "string" ||
    typeof parsed.refreshToken !== "string" ||
    parsed.tokenType !== "bearer" ||
    typeof parsed.expiresAt !== "string" ||
    typeof parsed.userId !== "string" ||
    !Array.isArray(parsed.scopes) ||
    !parsed.scopes.every((scope) => typeof scope === "string")
  ) throw new Error("Invalid stored credential.");
  return parsed as MercadoLivreTokenSet;
}

/** Manual, bounded snapshot import. It stores no raw provider payload or PII and creates no ledger entries. */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace || (workspace.role !== "owner" && workspace.role !== "admin")) {
      return NextResponse.json({ error: "Workspace administrator access required." }, { status: 403 });
    }

    const { data: connection, error: connectionError } = await supabase
      .from("source_connections")
      .select("id,external_account_id,status")
      .eq("organization_id", workspace.organizationId)
      .eq("provider", "mercado_livre")
      .eq("domain", "owned_sales")
      .eq("status", "connected")
      .not("external_account_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connectionError || !connection?.external_account_id) {
      return NextResponse.json({ error: "No connected Mercado Livre account was found in this workspace." }, { status: 404 });
    }

    const typedService = createServiceClient();
    if (!typedService) return NextResponse.json({ error: "Server database credentials are not configured." }, { status: 503 });
    const service = typedService as unknown as SupabaseClient;

    const { data: credential, error: credentialError } = await service
      .from("mercado_livre_credentials")
      .select("encrypted_tokens,token_expires_at")
      .eq("connection_id", connection.id)
      .eq("organization_id", workspace.organizationId)
      .maybeSingle();
    if (credentialError || !credential) {
      return NextResponse.json({ error: "Encrypted Mercado Livre credentials were not found." }, { status: 409 });
    }

    const expiry = new Date(credential.token_expires_at).getTime();
    if (!Number.isFinite(expiry)) throw new Error("Stored token expiry is invalid.");
    if (expiry < Date.now() + 120_000) {
      const refreshed = await refreshMercadoLivreConnection(connection.id);
      if (!refreshed) throw new Error("Could not acquire the token refresh lease.");
    }

    const { data: current, error: currentError } = await service
      .from("mercado_livre_credentials")
      .select("encrypted_tokens")
      .eq("connection_id", connection.id)
      .eq("organization_id", workspace.organizationId)
      .single();
    if (currentError || !current) throw new Error("Credential refresh/read failed.");

    const tokens = parseTokenSet(decryptMercadoLivreTokens(
      current.encrypted_tokens as Parameters<typeof decryptMercadoLivreTokens>[0],
      {
        organizationId: workspace.organizationId,
        provider: "mercado_livre",
        externalUserId: connection.external_account_id,
      },
      loadMercadoLivreTokenKeyring(),
    ));
    if (tokens.userId !== connection.external_account_id) {
      return NextResponse.json({ error: "Connected account identity mismatch." }, { status: 409 });
    }

    const profile = await mercadoLivreGet<{ id: number }>(tokens.accessToken, "/users/me");
    if (String(profile.id) !== connection.external_account_id) {
      return NextResponse.json({ error: "Provider identity check failed." }, { status: 409 });
    }

    const page = await mercadoLivreGet<OrderSearch>(tokens.accessToken, "/orders/search", {
      seller: connection.external_account_id,
      limit: 50,
      offset: 0,
      sort: "date_desc",
    });
    const orders = Array.isArray(page.results) ? page.results : [];
    const snapshots = orders.map(normalizeMercadoLivreOrder);

    const { data: processed, error: persistError } = await service.rpc("mercado_livre_persist_order_snapshots", {
      p_connection_id: connection.id,
      p_organization_id: workspace.organizationId,
      p_orders: snapshots,
      p_synced_at: new Date().toISOString(),
    });
    if (persistError || typeof processed !== "number") {
      throw new Error("Atomic Mercado Livre order snapshot persistence failed.");
    }

    return NextResponse.json({
      mode: "manual_snapshot_import",
      accountValidated: true,
      pageSize: orders.length,
      providerTotal: page.paging?.total ?? null,
      persistedCount: processed,
      persisted: true,
      ledgerEntriesCreated: 0,
      message: "Snapshots normalizados gravados atomicamente. Sem PII, sem payload bruto e sem liquidação inferida.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Mercado Livre snapshot import failed. Check connection, authorization and server configuration." }, {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
