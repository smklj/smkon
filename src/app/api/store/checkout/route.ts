import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { log } from "@/lib/observability/log";
import { createPixPayment, createPreference } from "@/lib/integrations/mercado-pago/client";
import { validateCoupon } from "@/lib/store/repository";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, customer, shippingAddress, shippingOption, couponCode, paymentMethod } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "O carrinho está vazio.", code: "empty_cart" },
        { status: 400 },
      );
    }

    if (!customer?.name || !customer?.email || !customer?.document || !customer?.phone) {
      return NextResponse.json(
        { error: "Dados do comprador são obrigatórios (nome, e-mail, CPF e WhatsApp).", code: "invalid_customer" },
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

    // 1. Busca os dados reais dos produtos no banco (nunca confia no preço enviado pelo navegador)
    const productIds = (items as Array<{ productId: string; quantity: number }>).map((i) => i.productId);
    if (productIds.some((id) => String(id).startsWith("demo-"))) {
      return NextResponse.json(
        { error: "Item de demonstração visual: cadastre produtos reais no painel para realizar compras.", code: "demo_item_not_purchasable" },
        { status: 400 },
      );
    }
    const { data: dbProducts, error: prodError } = await supabase
      .from("products")
      .select("*")
      .in("id", productIds)
      .eq("is_published_in_store", true)
      .neq("status", "archived");

    if (prodError || !dbProducts || dbProducts.length === 0) {
      return NextResponse.json(
        { error: "Um ou mais produtos não estão mais disponíveis no catálogo.", code: "products_unavailable" },
        { status: 400 },
      );
    }

    type DbProduct = {
      id: string; name: string; slug: string; sku: string | null;
      price_cents: number; image_urls: unknown; fulfillment_mode: string;
      organization_id: string; track_inventory: boolean; stock_quantity: number;
    };
    const prodMap = new Map<string, DbProduct>(
      (dbProducts as unknown as DbProduct[]).map((p) => [p.id, p])
    );

    let itemsSubtotalCents = 0;
    let hasPhysical = false;
    const validatedOrderItems: Array<Record<string, unknown>> = [];
    const mpItems: Array<{ id: string; title: string; quantity: number; unit_price: number; description: string }> = [];

    const organizationId = dbProducts[0]?.organization_id;

    for (const rawItem of (items as Array<{ productId: string; quantity: number }>)) {
      const item = rawItem;
      const prod = prodMap.get(item.productId);
      if (!prod) {
        return NextResponse.json(
          { error: `Produto indisponível ou removido da loja.`, code: "item_not_found" },
          { status: 400 },
        );
      }

      const qty = Math.max(1, Number(item.quantity) || 1);

      // Verificação de estoque para produtos com controle ativo
      if (prod.track_inventory && prod.stock_quantity < qty) {
        return NextResponse.json(
          {
            error: `Estoque insuficiente para o produto "${prod.name}". Disponível: ${prod.stock_quantity}.`,
            code: "insufficient_stock",
          },
          { status: 400 },
        );
      }

      if (prod.fulfillment_mode === "internal_physical") {
        hasPhysical = true;
      }

      const unitPriceCents = Number(prod.price_cents);
      const subtotalCents = unitPriceCents * qty;
      itemsSubtotalCents += subtotalCents;

      let images: string[] = [];
      if (Array.isArray(prod.image_urls)) images = prod.image_urls;
      else if (typeof prod.image_urls === "string") {
        try { images = JSON.parse(prod.image_urls); } catch { images = [prod.image_urls]; }
      }

      validatedOrderItems.push({
        product_id: prod.id,
        product_name: prod.name,
        product_slug: prod.slug || prod.id,
        sku: prod.sku || null,
        image_url: images[0] || null,
        fulfillment_mode: prod.fulfillment_mode || "internal_physical",
        quantity: qty,
        unit_price_cents: unitPriceCents,
        subtotal_cents: subtotalCents,
      });

      mpItems.push({
        id: prod.id,
        title: prod.name,
        description: prod.name,
        quantity: qty,
        unit_price: Number((unitPriceCents / 100).toFixed(2)),
      });
    }

    // 2. Valida frete caso haja itens físicos
    let shippingAmountCents = 0;
    if (hasPhysical) {
      if (!shippingAddress?.postalCode || !shippingAddress?.street || !shippingAddress?.number) {
        return NextResponse.json(
          { error: "Endereço de entrega completo é obrigatório para produtos físicos.", code: "missing_shipping_address" },
          { status: 400 },
        );
      }
      shippingAmountCents = Math.max(0, Number(shippingOption?.priceCents) || 0);
    }

    // 3. Validação segura do cupom no banco
    let discountAmountCents = 0;
    let appliedCouponCode: string | null = null;
    if (couponCode) {
      const couponCheck = await validateCoupon(organizationId, couponCode, itemsSubtotalCents);
      if (couponCheck.valid && couponCheck.coupon) {
        discountAmountCents = couponCheck.coupon.discountAmountCents;
        appliedCouponCode = couponCheck.coupon.code;
      }
    }

    const totalAmountCents = Math.max(1, itemsSubtotalCents - discountAmountCents + shippingAmountCents);

    // 4. Criação do Pedido no banco (via RPC atômica ou fallback transacional)
    let orderRecord: Record<string, unknown> | null = null;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcData, error: rpcError } = await (supabase.rpc as any)("store_create_order", {
        p_organization_id: organizationId,
        p_customer_name: customer.name.trim(),
        p_customer_email: customer.email.trim().toLowerCase(),
        p_customer_document: customer.document.replace(/\D/g, ""),
        p_customer_phone: customer.phone.replace(/\D/g, ""),
        p_shipping_address: hasPhysical ? shippingAddress : null,
        p_shipping_service_name: hasPhysical ? shippingOption?.serviceName || null : "Entrega Digital",
        p_shipping_carrier_name: hasPhysical ? shippingOption?.carrierName || null : "SMKON Digital",
        p_shipping_estimated_days: hasPhysical ? Number(shippingOption?.deliveryDays || 5) : 0,
        p_shipping_amount_cents: shippingAmountCents,
        p_discount_amount_cents: discountAmountCents,
        p_coupon_code: appliedCouponCode,
        p_payment_method: paymentMethod || "pix",
        p_items: validatedOrderItems,
      });

      if (!rpcError && rpcData) {
        orderRecord = rpcData;
      }
    } catch {
      // RPC não disponível, usa inserção direta com controle de integridade
    }

    if (!orderRecord) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const generatedCode = `SMK-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${randomSuffix}`;

      const { data: insertedOrder, error: insertError } = await supabase
        .from("store_orders")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert({
          organization_id: organizationId,
          order_code: generatedCode,
          status: "awaiting_payment",
          customer_name: customer.name.trim(),
          customer_email: customer.email.trim().toLowerCase(),
          customer_document: customer.document.replace(/\D/g, ""),
          customer_phone: customer.phone.replace(/\D/g, ""),
          shipping_address: hasPhysical ? shippingAddress : null,
          shipping_carrier_name: hasPhysical ? shippingOption?.carrierName || null : "SMKON Digital",
          shipping_service_name: hasPhysical ? shippingOption?.serviceName || null : "Entrega Digital",
          shipping_estimated_days: hasPhysical ? Number(shippingOption?.deliveryDays || 5) : 0,
          shipping_amount_cents: shippingAmountCents,
          items_subtotal_cents: itemsSubtotalCents,
          discount_amount_cents: discountAmountCents,
          total_amount_cents: totalAmountCents,
          coupon_code: appliedCouponCode,
          payment_method: paymentMethod || "pix",
          payment_status: "pending",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .select()
        .single();

      if (insertError) {
        log("error", "store.checkout.insert_order_failed", { error: insertError.message });
        throw insertError;
      }

      orderRecord = insertedOrder as unknown as Record<string, unknown>;

      // Insere os itens
      const orderItemsToInsert = validatedOrderItems.map((item) => ({
        order_id: (orderRecord as Record<string, unknown>).id,
        ...item,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from("store_order_items").insert(orderItemsToInsert as any);
    }

    const payer = {
      email: customer.email.trim().toLowerCase(),
      first_name: customer.name.split(" ")[0],
      last_name: customer.name.split(" ").slice(1).join(" ") || "Cliente",
      identification: {
        type: "CPF",
        number: customer.document.replace(/\D/g, ""),
      },
    };

    const orderCode = String(orderRecord.order_code);

    // 5. Integração com Provedor de Pagamentos
    if (paymentMethod === "credit_card" || paymentMethod === "boleto") {
      const preference = await createPreference({
        orderCode,
        items: mpItems,
        payer,
        shippingAmountCents,
        returnBaseUrl: process.env.NEXT_PUBLIC_APP_URL || "https://smkon.com.br",
      });

      return NextResponse.json({
        orderCode,
        status: "awaiting_payment",
        paymentMethod: "credit_card",
        checkoutUrl: preference.init_point,
      });
    }

    // PIX padrão
    const pixData = await createPixPayment({
      orderCode,
      amountCents: totalAmountCents,
      payer,
    });

    return NextResponse.json({
      orderCode,
      status: "awaiting_payment",
      paymentMethod: "pix",
      pix: {
        qrCode: pixData.qr_code,
        qrCodeBase64: pixData.qr_code_base64,
        ticketUrl: pixData.ticket_url,
        expiresAt: pixData.date_of_expiration,
      },
    });
  } catch (err) {
    log("error", "store.checkout.exception", { error: String(err) });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao processar checkout.", code: "checkout_error" },
      { status: 500 },
    );
  }
}
