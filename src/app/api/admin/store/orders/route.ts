import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { jsonError, toErrorResponse } from "@/lib/http/errors";
import { findWorkspace } from "@/lib/tenancy/service";

async function authContext() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { response: jsonError(401, "not_authenticated", "Não autenticado.") } as const;
  const workspace = await findWorkspace(supabase, user.id);
  if (!workspace) return { response: jsonError(409, "no_workspace", "Workspace ainda não criado.") } as const;
  const isAdmin = workspace.role === "owner" || workspace.role === "admin";
  if (!isAdmin) return { response: jsonError(403, "forbidden", "Acesso restrito a administradores.") } as const;

  return { supabase, workspace } as const;
}

export async function GET() {
  try {
    const ctx = await authContext();
    if ("response" in ctx) return ctx.response;

    const serviceClient = createServiceClient() || ctx.supabase;

    const { data: orders, error: ordersError } = await serviceClient
      .from("store_orders")
      .select("*")
      .eq("organization_id", ctx.workspace.organizationId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (ordersError) throw ordersError;

    // Métricas agregadas
    type OrderRow = { payment_status: string; status: string; total_amount_cents: number };
    const list = (orders ?? []) as unknown as OrderRow[];
    const totalRevenueCents = list
      .filter((o) => o.payment_status === "approved" || o.status === "payment_confirmed")
      .reduce((acc, o) => acc + Number(o.total_amount_cents || 0), 0);

    const paidOrdersCount = list.filter(
      (o) => o.payment_status === "approved" || o.status === "payment_confirmed",
    ).length;

    const pendingOrdersCount = list.filter((o) => o.status === "awaiting_payment").length;

    const averageTicketCents = paidOrdersCount > 0 ? Math.round(totalRevenueCents / paidOrdersCount) : 0;

    return NextResponse.json({
      orders: list,
      metrics: {
        totalRevenueCents,
        totalOrdersCount: list.length,
        paidOrdersCount,
        pendingOrdersCount,
        averageTicketCents,
      },
    });
  } catch (err) {
    return toErrorResponse("api.admin.store.orders.get", err, "Falha ao consultar pedidos da loja.");
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await authContext();
    if ("response" in ctx) return ctx.response;

    const body = await request.json();
    const { orderId, status, trackingCode, trackingUrl, carrierName, eventDescription } = body;

    if (!orderId) return jsonError(400, "missing_order_id", "ID do pedido é obrigatório.");

    const serviceClient = createServiceClient() || ctx.supabase;

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status) updatePayload.status = status;
    if (trackingCode !== undefined) updatePayload.tracking_code = trackingCode;
    if (trackingUrl !== undefined) updatePayload.tracking_url = trackingUrl;
    if (carrierName !== undefined) updatePayload.shipping_carrier_name = carrierName;

    const { data: updatedOrder, error: updateError } = await serviceClient
      .from("store_orders")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(updatePayload as any)
      .eq("id", orderId)
      .eq("organization_id", ctx.workspace.organizationId)
      .select()
      .single();

    if (updateError || !updatedOrder) throw updateError || new Error("Pedido não encontrado.");

    const orderRow = updatedOrder as unknown as Record<string, unknown>;

    // Registra evento de tracking caso fornecido ou quando muda de status
    if (eventDescription || status || trackingCode) {
      const eventPayload = {
        order_id: orderId,
        status: status || String(orderRow.status),
        description:
          eventDescription ||
          (status === "shipped"
            ? `Pedido enviado via ${String(orderRow.shipping_carrier_name || "transportadora")}. Rastreio: ${trackingCode || String(orderRow.tracking_code || "disponível")}.`
            : status === "delivered"
            ? "Pedido entregue com sucesso no endereço cadastrado."
            : `Status atualizado para: ${status || String(orderRow.status)}`),
        location: "Painel de Gestão SMKON",
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await serviceClient.from("store_shipment_events").insert(eventPayload as any);
    }

    return NextResponse.json({ order: orderRow });
  } catch (err) {
    return toErrorResponse("api.admin.store.orders.patch", err, "Falha ao atualizar pedido.");
  }
}
