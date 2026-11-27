import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { log } from "@/lib/observability/log";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const cleanToken = (token || "").trim();

    if (!cleanToken || cleanToken.length < 16) {
      return NextResponse.json(
        { error: "Token de entrega inválido.", code: "invalid_token" },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Serviço temporariamente indisponível.", code: "service_unavailable" },
        { status: 503 },
      );
    }

    const { data: delivery, error } = await supabase
      .from("store_digital_deliveries")
      .select("id, order_id, product_id, product_name, delivery_type, asset_path, external_url, license_key, instructions, download_count, max_downloads, expires_at")
      .eq("access_token", cleanToken)
      .maybeSingle();

    if (error || !delivery) {
      return NextResponse.json(
        { error: "Entrega digital não encontrada ou token expirado.", code: "not_found" },
        { status: 404 },
      );
    }

    // Garante no servidor que o pedido realmente foi pago antes de liberar qualquer arquivo
    const { data: order } = await supabase
      .from("store_orders")
      .select("id, order_code, payment_status, status")
      .eq("id", delivery.order_id)
      .maybeSingle();

    if (!order || (order.payment_status !== "approved" && order.status !== "payment_confirmed" && order.status !== "paid" && order.status !== "completed")) {
      return NextResponse.json(
        { error: "Pagamento ainda não confirmado para esta entrega digital.", code: "payment_required" },
        { status: 403 },
      );
    }

    if (delivery.expires_at && new Date(delivery.expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        { error: "O prazo de validade deste link expirou.", code: "expired" },
        { status: 410 },
      );
    }

    if (delivery.download_count >= delivery.max_downloads) {
      return NextResponse.json(
        { error: "Limite máximo de downloads atingido para este token.", code: "limit_reached" },
        { status: 429 },
      );
    }

    await supabase
      .from("store_digital_deliveries")
      .update({
        download_count: delivery.download_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);

    if (delivery.external_url) {
      return NextResponse.redirect(delivery.external_url);
    }

    if (delivery.asset_path) {
      const { data: signed } = await supabase.storage
        .from("digital-products")
        .createSignedUrl(delivery.asset_path, 300);

      if (signed?.signedUrl) {
        return NextResponse.redirect(signed.signedUrl);
      }
    }

    return NextResponse.json({
      orderCode: order.order_code,
      productName: delivery.product_name,
      deliveryType: delivery.delivery_type,
      licenseKey: delivery.license_key,
      instructions: delivery.instructions || "Entre em contato com o suporte SMKON caso precise de ajuda para acessar este material.",
      downloadsUsed: delivery.download_count + 1,
      maxDownloads: delivery.max_downloads,
    });
  } catch (err) {
    log("error", "store.digital.download_error", { error: String(err) });
    return NextResponse.json(
      { error: "Erro ao processar entrega digital.", code: "download_error" },
      { status: 500 },
    );
  }
}
