import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findWorkspace } from "@/lib/tenancy/workspace";
import {
  generateReconciliationReport,
  type StoredSalesOrder,
} from "@/lib/integrations/mercado-livre/reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns a structured financial reconciliation report for the Mercado Livre sales domain.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const workspace = await findWorkspace(supabase, user.id);
    if (!workspace) {
      return NextResponse.json({ error: "Workspace required." }, { status: 409 });
    }

    const { searchParams } = new URL(request.url);
    const targetCurrency = searchParams.get("currency") ?? "BRL";
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    let query = supabase
      .from("sales_orders")
      .select("id,external_order_id,order_status,currency,gross_amount,discount_amount,fee_amount,shipping_amount,refund_amount,occurred_at,settled_at")
      .eq("organization_id", workspace.organizationId)
      .eq("provider", "mercado_livre")
      .order("occurred_at", { ascending: false });

    if (dateFrom) query = query.gte("occurred_at", dateFrom);
    if (dateTo) query = query.lte("occurred_at", dateTo);

    const { data: orders, error: ordersError } = await query;
    if (ordersError) {
      throw new Error("Failed to fetch sales orders for reconciliation.");
    }

    const report = generateReconciliationReport((orders ?? []) as StoredSalesOrder[], {
      targetCurrency,
    });

    return NextResponse.json(report, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate reconciliation report." }, { status: 500 });
  }
}
