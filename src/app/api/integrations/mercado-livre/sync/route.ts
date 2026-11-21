import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { findWorkspace } from "@/lib/tenancy/workspace";
import { decryptMercadoLivreTokens, loadMercadoLivreTokenKeyring } from "@/lib/integrations/mercado-livre/token-crypto.server";
import { refreshMercadoLivreConnection } from "@/lib/integrations/mercado-livre/refresh";
import { mercadoLivreGet } from "@/lib/integrations/mercado-livre/client";
import { normalizeMercadoLivreOrder, type MercadoLivreOrderInput } from "@/lib/integrations/mercado-livre/order-snapshot";
import {
  MERCADO_LIVRE_ORDER_MAX_OFFSET,
  MERCADO_LIVRE_ORDER_PAGE_SIZE,
  parseMercadoLivreOrderSyncAction,
} from "@/lib/integrations/mercado-livre/order-sync-window";
import type { MercadoLivreTokenSet } from "@/lib/integrations/mercado-livre/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderSearch = { paging?: { total?: number }; results?: MercadoLivreOrderInput[] };

type ClaimedSyncState = {
  sync_id: string;
  sync_status: "running" | "busy" | "ready" | "completed" | "blocked";
  created_from: string;
  created_to: string;
  next_offset: number;
  page_size: number;
  provider_total: number | null;
  lease_id: string | null;
};

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

/** Manual historical import with a durable, leased cursor and atomic page/checkpoint writes. */
export async function POST(request: Request) {
  let payload: unknown = undefined;
  try {
    const raw = await request.text();
    if (raw.trim()) payload = JSON.parse(raw) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid sync request." }, { status: 400 });
  }

  const parsedAction = parseMercadoLivreOrderSyncAction(payload);
  if (!parsedAction.ok) {
    return NextResponse.json({ error: parsedAction.error }, { status: 400 });
  }

  let service: SupabaseClient | null = null;
  let activeLease: { connectionId: string; organizationId: string; leaseId: string } | null = null;

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
    if (!typedService) {
      return NextResponse.json({ error: "Server database credentials are not configured." }, { status: 503 });
    }
    service = typedService as unknown as SupabaseClient;

    const { data: claimData, error: claimError } = await service.rpc("mercado_livre_claim_order_sync", {
      p_connection_id: connection.id,
      p_organization_id: workspace.organizationId,
      p_action: parsedAction.value,
      p_lease_seconds: 300,
    });
    if (claimError) throw new Error("Could not claim the durable order sync cursor.");

    const claim = (Array.isArray(claimData) ? claimData[0] : claimData) as ClaimedSyncState | null;
    if (!claim || typeof claim.sync_status !== "string") {
      throw new Error("Durable order sync cursor was not returned.");
    }

    if (claim.sync_status === "busy") {
      return NextResponse.json({ error: "Another Mercado Livre import is already processing this workspace." }, {
        status: 409,
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (claim.sync_status === "completed") {
      return NextResponse.json({
        mode: "manual_historical_snapshot_import",
        syncStatus: "completed",
        pageOffset: claim.next_offset,
        pageSize: 0,
        providerTotal: claim.provider_total,
        nextOffset: null,
        createdFrom: claim.created_from,
        createdTo: claim.created_to,
        persistedCount: 0,
        persisted: false,
        message: "Este histórico já foi concluído. Use Reiniciar histórico para iniciar uma nova janela.",
      }, { headers: { "Cache-Control": "no-store" } });
    }
    if (claim.sync_status === "blocked") {
      return NextResponse.json({
        mode: "manual_historical_snapshot_import",
        syncStatus: "blocked",
        pageOffset: claim.next_offset,
        pageSize: 0,
        providerTotal: claim.provider_total,
        nextOffset: null,
        createdFrom: claim.created_from,
        createdTo: claim.created_to,
        persistedCount: 0,
        persisted: false,
        paginationLimitReached: true,
        message: "O limite de offset do provedor foi atingido. A janela precisa ser dividida antes de continuar.",
      }, { headers: { "Cache-Control": "no-store" } });
    }

    if (
      claim.sync_status !== "running" ||
      typeof claim.lease_id !== "string" ||
      !Number.isSafeInteger(claim.next_offset) ||
      claim.next_offset < 0 ||
      claim.next_offset > MERCADO_LIVRE_ORDER_MAX_OFFSET ||
      claim.next_offset % MERCADO_LIVRE_ORDER_PAGE_SIZE !== 0 ||
      claim.page_size !== MERCADO_LIVRE_ORDER_PAGE_SIZE ||
      typeof claim.created_from !== "string" ||
      typeof claim.created_to !== "string"
    ) {
      throw new Error("Durable order sync cursor is invalid.");
    }

    const offset = claim.next_offset;
    const createdFrom = claim.created_from;
    const createdTo = claim.created_to;
    activeLease = {
      connectionId: connection.id,
      organizationId: workspace.organizationId,
      leaseId: claim.lease_id,
    };

    const { data: credential, error: credentialError } = await service
      .from("mercado_livre_credentials")
      .select("encrypted_tokens,token_expires_at")
      .eq("connection_id", connection.id)
      .eq("organization_id", workspace.organizationId)
      .maybeSingle();
    if (credentialError || !credential) {
      throw new Error("Encrypted Mercado Livre credentials were not found.");
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
      throw new Error("Connected account identity mismatch.");
    }

    const profile = await mercadoLivreGet<{ id: number }>(tokens.accessToken, "/users/me");
    if (String(profile.id) !== connection.external_account_id) {
      throw new Error("Provider identity check failed.");
    }

    const page = await mercadoLivreGet<OrderSearch>(tokens.accessToken, "/orders/search", {
      seller: connection.external_account_id,
      limit: MERCADO_LIVRE_ORDER_PAGE_SIZE,
      offset,
      sort: "date_desc",
      "order.date_created.from": createdFrom,
      "order.date_created.to": createdTo,
    });
    const orders = Array.isArray(page.results) ? page.results : [];
    const snapshots = orders.map(normalizeMercadoLivreOrder);

    const providerTotal = typeof page.paging?.total === "number" &&
      Number.isSafeInteger(page.paging.total) && page.paging.total >= 0
      ? page.paging.total
      : null;
    const candidateNextOffset = offset + orders.length;
    const hasMore = orders.length === MERCADO_LIVRE_ORDER_PAGE_SIZE &&
      (providerTotal === null || candidateNextOffset < providerTotal);
    const paginationLimitReached = hasMore && candidateNextOffset > MERCADO_LIVRE_ORDER_MAX_OFFSET;

    const { data: processed, error: persistError } = await service.rpc("mercado_livre_persist_order_sync_page", {
      p_connection_id: connection.id,
      p_organization_id: workspace.organizationId,
      p_lease_id: claim.lease_id,
      p_expected_offset: offset,
      p_orders: snapshots,
      p_provider_total: providerTotal,
      p_has_more: hasMore,
      p_synced_at: new Date().toISOString(),
    });
    if (persistError || typeof processed !== "number") {
      throw new Error("Atomic Mercado Livre page and checkpoint persistence failed.");
    }

    activeLease = null;
    const syncStatus = paginationLimitReached ? "blocked" : hasMore ? "ready" : "completed";
    const nextOffset = hasMore && !paginationLimitReached ? candidateNextOffset : null;

    return NextResponse.json({
      mode: "manual_historical_snapshot_import",
      accountValidated: true,
      syncStatus,
      pageOffset: offset,
      pageSize: orders.length,
      providerTotal,
      nextOffset,
      hasMore,
      paginationLimitReached,
      createdFrom,
      createdTo,
      persistedCount: processed,
      persisted: true,
      ledgerEntriesCreated: 0,
      message: "Página e checkpoint persistidos atomicamente. Sem PII, sem payload bruto e sem liquidação inferida.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    if (service && activeLease) {
      await service.rpc("mercado_livre_release_order_sync", {
        p_connection_id: activeLease.connectionId,
        p_organization_id: activeLease.organizationId,
        p_lease_id: activeLease.leaseId,
        p_error_code: "sync_failed",
      }).catch(() => undefined);
    }
    return NextResponse.json({ error: "Mercado Livre snapshot import failed. Check connection, authorization and server configuration." }, {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
