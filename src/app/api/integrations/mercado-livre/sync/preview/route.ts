import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { findWorkspace } from "@/lib/tenancy/workspace";
import { decryptMercadoLivreTokens, loadMercadoLivreTokenKeyring } from "@/lib/integrations/mercado-livre/token-crypto.server";
import { refreshMercadoLivreConnection } from "@/lib/integrations/mercado-livre/refresh";
import { mercadoLivreGet } from "@/lib/integrations/mercado-livre/client";
import type { MercadoLivreTokenSet } from "@/lib/integrations/mercado-livre/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Order = {
  id: number;
  status: string;
  currency_id: string;
  total_amount: number;
  date_created: string;
  order_items?: Array<{ sale_fee?: number; quantity?: number; unit_price?: number }>;
};
type OrderSearch = { paging?: { total?: number }; results?: Order[] };

function parseTokenSet(value: string): MercadoLivreTokenSet {
  const parsed = JSON.parse(value) as Partial<MercadoLivreTokenSet>;
  if (
    typeof parsed.accessToken !== "string" ||
    typeof parsed.refreshToken !== "string" ||
    parsed.tokenType !== "bearer" ||
    typeof parsed.expiresAt !== "string" ||
    typeof parsed.userId !== "string" ||
    !Array.isArray(parsed.scopes)
  ) throw new Error("Invalid stored credential.");
  return parsed as MercadoLivreTokenSet;
}

/** Read-only smoke test: validates account identity and fetches one bounded orders page. */
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

    if (new Date(credential.token_expires_at).getTime() < Date.now() + 120_000) {
      await refreshMercadoLivreConnection(connection.id);
    }

    const { data: current, error: currentError } = await service
      .from("mercado_livre_credentials")
      .select("encrypted_tokens")
      .eq("connection_id", connection.id)
      .eq("organization_id", workspace.organizationId)
      .single();
    if (currentError || !current) throw new Error("Credential refresh/read failed.");

    const tokenContext = {
      organizationId: workspace.organizationId,
      provider: "mercado_livre" as const,
      externalUserId: connection.external_account_id,
    };
    const tokens = parseTokenSet(decryptMercadoLivreTokens(
      current.encrypted_tokens as Parameters<typeof decryptMercadoLivreTokens>[0],
      tokenContext,
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
    const totals = new Map<string, { orders: number; gross: number; fees: number }>();
    const statuses: Record<string, number> = {};
    for (const order of orders) {
      const currency = typeof order.currency_id === "string" ? order.currency_id : "UNKNOWN";
      const bucket = totals.get(currency) ?? { orders: 0, gross: 0, fees: 0 };
      bucket.orders += 1;
      bucket.gross += Number.isFinite(order.total_amount) ? order.total_amount : 0;
      for (const item of order.order_items ?? []) {
        bucket.fees += Number.isFinite(item.sale_fee) ? (item.sale_fee ?? 0) * (item.quantity ?? 1) : 0;
      }
      totals.set(currency, bucket);
      const status = typeof order.status === "string" ? order.status : "unknown";
      statuses[status] = (statuses[status] ?? 0) + 1;
    }

    return NextResponse.json({
      mode: "read_only_dry_run",
      accountValidated: true,
      pageSize: orders.length,
      providerTotal: page.paging?.total ?? null,
      currencies: Array.from(totals, ([currency, value]) => ({ currency, ...value })),
      statuses,
      persisted: false,
      message: "Leitura validada. Nenhum pedido ou lançamento financeiro foi gravado.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Read-only Mercado Livre validation/sync preview failed. Check connection and authorization." }, { status: 502 });
  }
}
