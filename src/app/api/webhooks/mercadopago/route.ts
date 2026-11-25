import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { log } from "@/lib/observability/log";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyMercadoPagoWebhook } from "@/lib/integrations/mercado-pago/validator";
import { getMercadoPagoPayment } from "@/lib/integrations/mercado-pago/client";

export async function POST(request: NextRequest) {
  try {
    const xSignature = request.headers.get("x-signature");
    const xRequestId = request.headers.get("x-request-id");
    const searchParams = request.nextUrl.searchParams;

    let body: { data?: { id?: string | number }; type?: string; action?: string } = {};
    try {
      body = (await request.json()) as { data?: { id?: string | number }; type?: string; action?: string };
    } catch {
      // Alguns pings do MP mandam corpo vazio com query string
    }

    const dataId = body?.data?.id || searchParams.get("id") || searchParams.get("data.id");
    const topic = String(body?.type || body?.action || searchParams.get("topic") || searchParams.get("type") || "");

    // Validação criptográfica da assinatura
    const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || "";
    const isValid = verifyMercadoPagoWebhook({
      xSignatureHeader: xSignature,
      xRequestIdHeader: xRequestId,
      dataId: dataId ? String(dataId) : null,
      webhookSecret,
    });

    if (!isValid) {
      log("warn", "mp.webhook.invalid_signature", { dataId, xSignature });
      return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
    }

    // Se não for evento de pagamento, responde 200 OK (ex: merchant_order)
    if (!dataId || (topic && !topic.includes("payment"))) {
      return NextResponse.json({ received: true });
    }

    // Busca detalhes oficiais do pagamento na API do Mercado Pago
    const payment = await getMercadoPagoPayment(dataId);
    if (!payment) {
      log("warn", "mp.webhook.payment_not_found", { dataId });
      return NextResponse.json({ received: true });
    }

    const externalReference = String(payment.external_reference || "");
    const paymentStatus = String(payment.status || "");
    const transactionAmount = Number(payment.transaction_amount || 0);
    const amountCents = Math.round(transactionAmount * 100);

    if (!externalReference) {
      log("warn", "mp.webhook.no_external_reference", { dataId });
      return NextResponse.json({ received: true });
    }

    const supabase = createServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 });
    }

    // Tenta confirmar via RPC atômica idempotente
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)("store_confirm_payment", {
        p_order_code: externalReference,
        p_payment_id: String(dataId),
        p_provider: "mercado_pago",
        p_status: paymentStatus === "approved" ? "approved" : "rejected",
        p_amount_cents: amountCents,
        p_payload: payment,
      });

      if (!rpcError && rpcResult) {
        log("info", "mp.webhook.confirmed_via_rpc", { orderCode: externalReference, rpcResult });
        return NextResponse.json({ ok: true, source: "rpc" });
      }
    } catch {
      // Fallback para caso a migration ainda não esteja executada no ambiente
    }

    // Fallback de confirmação direta
    const { data: order, error: orderErr } = await supabase
      .from("store_orders")
      .select("id, organization_id, status, payment_status")
      .eq("order_code", externalReference)
      .maybeSingle();

    if (orderErr || !order) {
      log("warn", "mp.webhook.order_not_found_in_db", { externalReference });
      return NextResponse.json({ received: true });
    }

    if (paymentStatus === "approved" && order.payment_status !== "approved") {
      const now = new Date().toISOString();

      await supabase
        .from("store_orders")
        .update({
          payment_status: "approved",
          status: "payment_confirmed",
          paid_at: now,
          updated_at: now,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .eq("id", order.id);

      // Registra evento de tracking/histórico
      await supabase.from("store_shipment_events").insert({
        order_id: order.id,
        status: "PAGAMENTO_APROVADO",
        description: "Pagamento aprovado com sucesso via Mercado Pago (PIX/Cartão).",
        location: "Sistema Central",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      // Gera tokens de entrega digital para produtos digitais
      const { data: items } = await supabase
        .from("store_order_items")
        .select("id, product_id, product_name, fulfillment_mode")
        .eq("order_id", order.id);

      if (items && items.length > 0) {
        for (const item of items) {
          if (item.fulfillment_mode === "internal_digital") {
            const token = randomBytes(24).toString("hex");
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 dias

            await supabase.from("store_digital_deliveries").insert({
              order_id: order.id,
              product_id: item.product_id,
              product_name: item.product_name,
              delivery_type: "file_download",
              access_token: token,
              expires_at: expiresAt,
              download_count: 0,
              max_downloads: 10,
              instructions: "Acesse seus arquivos digitais pelo link de download seguro.",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);
          }
        }
      }

      log("info", "mp.webhook.payment_confirmed", { orderCode: externalReference, amountCents });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    log("error", "mp.webhook.error", { error: String(err) });
    return NextResponse.json({ error: "Erro interno no webhook." }, { status: 500 });
  }
}
