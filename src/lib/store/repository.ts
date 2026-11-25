import { createServiceClient } from "@/lib/supabase/service";
import { log } from "@/lib/observability/log";
import { getDefaultStoreSettings } from "./defaults";
import type {
  StoreCouponInfo,
  StoreOrderView,
  StoreProduct,
  StoreSettings,
  StoreFulfillmentMode,
  StoreBanner,
  StoreCategoryNav,
  StoreSocialLinks,
  StoreDigitalDeliveryType,
} from "./types";

export type ListStoreProductsOptions = {
  organizationId?: string;
  category?: string;
  search?: string;
  featured?: boolean;
  bestseller?: boolean;
  newArrival?: boolean;
  fulfillmentMode?: StoreFulfillmentMode;
  minPriceCents?: number;
  maxPriceCents?: number;
  sort?: "price_asc" | "price_desc" | "newest" | "score";
  limit?: number;
  offset?: number;
};

export async function getStoreSettings(orgId?: string): Promise<StoreSettings> {
  const supabase = createServiceClient();
  if (!supabase) return getDefaultStoreSettings(orgId);

  try {
    let query = supabase.from("store_settings").select("*");
    if (orgId) {
      query = query.eq("organization_id", orgId);
    }
    const { data, error } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();

    if (error || !data) {
      return getDefaultStoreSettings(orgId);
    }

    const row = data as Record<string, unknown>;
    return {
      id: String(row.id),
      organization_id: String(row.organization_id),
      store_name: String(row.store_name || "SMKON Loja"),
      store_tagline: String(row.store_tagline || ""),
      logo_url: row.logo_url ? String(row.logo_url) : null,
      hero_banners: Array.isArray(row.hero_banners)
        ? (row.hero_banners as unknown as StoreBanner[])
        : getDefaultStoreSettings().hero_banners,
      announcement_bar: typeof row.announcement_bar === "object" && row.announcement_bar !== null
        ? (row.announcement_bar as unknown as StoreSettings["announcement_bar"])
        : getDefaultStoreSettings().announcement_bar,
      categories_nav: Array.isArray(row.categories_nav)
        ? (row.categories_nav as unknown as StoreCategoryNav[])
        : getDefaultStoreSettings().categories_nav,
      primary_color: String(row.primary_color || "#2563FF"),
      accent_color: String(row.accent_color || "#00F0FF"),
      support_email: row.support_email ? String(row.support_email) : null,
      support_whatsapp: row.support_whatsapp ? String(row.support_whatsapp) : null,
      social_links: typeof row.social_links === "object" && row.social_links !== null
        ? (row.social_links as unknown as StoreSocialLinks)
        : {},
      shipping_origin_cep: String(row.shipping_origin_cep || "01001000"),
      free_shipping_min_cents: row.free_shipping_min_cents ? Number(row.free_shipping_min_cents) : null,
      is_store_active: Boolean(row.is_store_active ?? true),
      updated_at: String(row.updated_at || new Date().toISOString()),
    };
  } catch (err) {
    log("error", "store.getStoreSettings", { error: err instanceof Error ? err.message : String(err) });
    return getDefaultStoreSettings(orgId);
  }
}

export async function saveStoreSettings(
  orgId: string,
  settings: Partial<StoreSettings>,
): Promise<StoreSettings> {
  const supabase = createServiceClient();
  if (!supabase) throw new Error("Supabase service client not available.");

  const payload = {
    organization_id: orgId,
    store_name: settings.store_name,
    store_tagline: settings.store_tagline,
    logo_url: settings.logo_url,
    hero_banners: settings.hero_banners,
    announcement_bar: settings.announcement_bar,
    categories_nav: settings.categories_nav,
    primary_color: settings.primary_color,
    accent_color: settings.accent_color,
    support_email: settings.support_email,
    support_whatsapp: settings.support_whatsapp,
    social_links: settings.social_links,
    shipping_origin_cep: settings.shipping_origin_cep,
    free_shipping_min_cents: settings.free_shipping_min_cents,
    is_store_active: settings.is_store_active,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("store_settings")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert(payload as any, { onConflict: "organization_id" })
    .select()
    .single();

  if (error) {
    log("error", "store.saveStoreSettings", { error: error.message });
    throw error;
  }

  return data as unknown as StoreSettings;
}

function mapProductRow(row: Record<string, unknown>): StoreProduct {
  let images: string[] = [];
  if (Array.isArray(row.image_urls)) {
    images = row.image_urls.map(String);
  } else if (typeof row.image_urls === "string" && row.image_urls.trim()) {
    try {
      const parsed = JSON.parse(row.image_urls);
      images = Array.isArray(parsed) ? parsed.map(String) : [String(row.image_urls)];
    } catch {
      images = [row.image_urls];
    }
  }

  let benefits: string[] = [];
  if (Array.isArray(row.digital_benefits)) {
    benefits = row.digital_benefits.map(String);
  } else if (typeof row.digital_benefits === "string" && row.digital_benefits.trim()) {
    try {
      const parsed = JSON.parse(row.digital_benefits);
      benefits = Array.isArray(parsed) ? parsed.map(String) : [String(row.digital_benefits)];
    } catch {
      benefits = [row.digital_benefits];
    }
  }

  const rawMode = String(row.fulfillment_mode || "internal_physical");
  const fulfillmentMode: StoreFulfillmentMode =
    rawMode === "internal_digital" || rawMode === "external_affiliate" ? rawMode : "internal_physical";

  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    name: String(row.name || ""),
    slug: String(row.slug || row.id),
    sku: row.sku ? String(row.sku) : null,
    short_description: row.short_description ? String(row.short_description) : null,
    description: row.description ? String(row.description) : null,
    category: String(row.category || "Geral"),
    subcategory: row.subcategory ? String(row.subcategory) : null,
    price_cents: Number(row.price_cents || 0),
    compare_at_price_cents: row.compare_at_price_cents ? Number(row.compare_at_price_cents) : null,
    currency: String(row.currency || "BRL"),
    image_urls: images.length > 0 ? images : ["/brand/brand-identity-board.jpg"],
    fulfillment_mode: fulfillmentMode,
    is_published_in_store: Boolean(row.is_published_in_store),
    is_featured: Boolean(row.is_featured),
    is_bestseller: Boolean(row.is_bestseller),
    is_new_arrival: Boolean(row.is_new_arrival),
    stock_quantity: Number(row.stock_quantity ?? 0),
    track_inventory: Boolean(row.track_inventory ?? true),
    weight_grams: row.weight_grams ? Number(row.weight_grams) : null,
    height_cm: row.height_cm ? Number(row.height_cm) : null,
    width_cm: row.width_cm ? Number(row.width_cm) : null,
    length_cm: row.length_cm ? Number(row.length_cm) : null,
    affiliate_url: row.affiliate_url ? String(row.affiliate_url) : null,
    source: String(row.source || "smkon_store"),
    digital_delivery_type: (row.digital_delivery_type as unknown as StoreDigitalDeliveryType) || null,
    digital_benefits: benefits,
    digital_instructions: row.digital_instructions ? String(row.digital_instructions) : null,
    score: row.score !== null && row.score !== undefined ? Number(row.score) : null,
    updated_at: String(row.updated_at || new Date().toISOString()),
  };
}

export async function listStoreProducts(
  options: ListStoreProductsOptions = {},
): Promise<{ products: StoreProduct[]; total: number }> {
  const supabase = createServiceClient();
  if (!supabase) return { products: [], total: 0 };

  try {
    let query = supabase
      .from("products")
      .select("*", { count: "exact" })
      .eq("is_published_in_store", true)
      .neq("status", "archived");

    if (options.organizationId) {
      query = query.eq("organization_id", options.organizationId);
    }

    if (options.category) {
      query = query.ilike("category", `%${options.category}%`);
    }

    if (options.fulfillmentMode) {
      query = query.eq("fulfillment_mode", options.fulfillmentMode);
    }

    if (options.featured) {
      query = query.eq("is_featured", true);
    }

    if (options.bestseller) {
      query = query.eq("is_bestseller", true);
    }

    if (options.newArrival) {
      query = query.eq("is_new_arrival", true);
    }

    if (options.minPriceCents !== undefined) {
      query = query.gte("price_cents", options.minPriceCents);
    }

    if (options.maxPriceCents !== undefined) {
      query = query.lte("price_cents", options.maxPriceCents);
    }

    if (options.search) {
      query = query.or(`name.ilike.%${options.search}%,short_description.ilike.%${options.search}%,category.ilike.%${options.search}%`);
    }

    switch (options.sort) {
      case "price_asc":
        query = query.order("price_cents", { ascending: true });
        break;
      case "price_desc":
        query = query.order("price_cents", { ascending: false });
        break;
      case "score":
        query = query.order("score", { ascending: false, nullsFirst: false });
        break;
      case "newest":
      default:
        query = query.order("updated_at", { ascending: false });
        break;
    }

    const limit = options.limit || 24;
    const offset = options.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) {
      log("error", "store.listStoreProducts", { error: error.message });
      return { products: [], total: 0 };
    }

    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    return {
      products: rows.map(mapProductRow),
      total: count ?? rows.length,
    };
  } catch (err) {
    log("error", "store.listStoreProducts.unhandled", { error: String(err) });
    return { products: [], total: 0 };
  }
}

export async function getStoreProductBySlug(
  slug: string,
  organizationId?: string,
): Promise<{ product: StoreProduct | null; related: StoreProduct[] }> {
  const supabase = createServiceClient();
  if (!supabase) return { product: null, related: [] };

  try {
    let query = supabase
      .from("products")
      .select("*")
      .eq("is_published_in_store", true)
      .neq("status", "archived");

    if (organizationId) {
      query = query.eq("organization_id", organizationId);
    }

    // Try finding by slug or UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug);
    if (isUuid) {
      query = query.or(`slug.eq.${slug},id.eq.${slug}`);
    } else {
      query = query.eq("slug", slug);
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data) return { product: null, related: [] };

    const product = mapProductRow(data as Record<string, unknown>);

    // Fetch related items from the same category
    const { data: relatedData } = await supabase
      .from("products")
      .select("*")
      .eq("organization_id", product.organization_id)
      .eq("is_published_in_store", true)
      .neq("status", "archived")
      .neq("id", product.id)
      .ilike("category", `%${product.category}%`)
      .limit(4);

    const relatedRows = (relatedData ?? []) as unknown as Record<string, unknown>[];
    return {
      product,
      related: relatedRows.map(mapProductRow),
    };
  } catch (err) {
    log("error", "store.getStoreProductBySlug", { error: String(err) });
    return { product: null, related: [] };
  }
}

export async function validateCoupon(
  organizationId: string,
  code: string,
  subtotalCents: number,
): Promise<{ valid: boolean; coupon?: StoreCouponInfo; reason?: string }> {
  const supabase = createServiceClient();
  if (!supabase) return { valid: false, reason: "Serviço indisponível." };

  const cleanCode = code.trim().toUpperCase();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("store_coupons")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("code", cleanCode)
    .eq("is_active", true)
    .lte("valid_from", now)
    .maybeSingle();

  if (error || !data) {
    return { valid: false, reason: "Cupom não encontrado ou inativo." };
  }

  const row = data as unknown as Record<string, unknown>;

  if (row.valid_until && new Date(String(row.valid_until)).getTime() < Date.now()) {
    return { valid: false, reason: "Este cupom já expirou." };
  }

  if (row.max_uses && Number(row.used_count || 0) >= Number(row.max_uses)) {
    return { valid: false, reason: "Este cupom atingiu o limite de usos." };
  }

  const minOrderCents = Number(row.min_order_amount_cents || 0);
  if (subtotalCents < minOrderCents) {
    return {
      valid: false,
      reason: `Valor mínimo para este cupom é de ${(minOrderCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })}.`,
    };
  }

  const discountType = row.discount_type === "percentage" ? "percentage" : "fixed";
  const discountValue = Number(row.discount_value || 0);
  let discountAmountCents = 0;

  if (discountType === "percentage") {
    discountAmountCents = Math.round((subtotalCents * discountValue) / 100);
    if (row.max_discount_amount_cents) {
      discountAmountCents = Math.min(discountAmountCents, Number(row.max_discount_amount_cents));
    }
  } else {
    discountAmountCents = Math.min(discountValue, subtotalCents);
  }

  return {
    valid: true,
    coupon: {
      code: String(row.code),
      discountType,
      discountValue,
      discountAmountCents,
      description: row.description ? String(row.description) : undefined,
    },
  };
}

export async function getStoreOrderByCode(
  orderCode: string,
  customerEmail?: string,
): Promise<StoreOrderView | null> {
  const supabase = createServiceClient();
  if (!supabase) return null;

  try {
    let query = supabase.from("store_orders").select("*").eq("order_code", orderCode);
    if (customerEmail) {
      query = query.ilike("customer_email", customerEmail.trim());
    }

    const { data: orderData, error: orderError } = await query.maybeSingle();
    if (orderError || !orderData) return null;

    const orderRow = orderData as unknown as Record<string, unknown>;

    // Fetch items
    const { data: itemsData } = await supabase
      .from("store_order_items")
      .select("*")
      .eq("order_id", String(orderRow.id));

    // Fetch shipment events
    const { data: eventsData } = await supabase
      .from("store_shipment_events")
      .select("*")
      .eq("order_id", String(orderRow.id))
      .order("occurred_at", { ascending: false });

    // Fetch digital deliveries (only if payment is confirmed/approved)
    let deliveries: Record<string, unknown>[] = [];
    if (orderRow.payment_status === "approved" || orderRow.status === "payment_confirmed" || orderRow.status === "completed") {
      const { data: delivData } = await supabase
        .from("store_digital_deliveries")
        .select("*")
        .eq("order_id", String(orderRow.id));
      deliveries = (delivData ?? []) as unknown as Record<string, unknown>[];
    }

    const itemsRows = (itemsData ?? []) as unknown as Record<string, unknown>[];
    const eventsRows = (eventsData ?? []) as unknown as Record<string, unknown>[];

    return {
      id: String(orderRow.id),
      order_code: String(orderRow.order_code),
      status: orderRow.status as StoreOrderView["status"],
      payment_method: orderRow.payment_method as StoreOrderView["payment_method"],
      payment_status: orderRow.payment_status as StoreOrderView["payment_status"],
      items_subtotal_cents: Number(orderRow.items_subtotal_cents),
      shipping_amount_cents: Number(orderRow.shipping_amount_cents),
      discount_amount_cents: Number(orderRow.discount_amount_cents),
      total_amount_cents: Number(orderRow.total_amount_cents),
      customer_name: String(orderRow.customer_name),
      customer_email: String(orderRow.customer_email),
      customer_phone: String(orderRow.customer_phone),
      shipping_address: orderRow.shipping_address as StoreOrderView["shipping_address"],
      shipping_carrier_name: orderRow.shipping_carrier_name ? String(orderRow.shipping_carrier_name) : null,
      shipping_service_name: orderRow.shipping_service_name ? String(orderRow.shipping_service_name) : null,
      shipping_estimated_days: orderRow.shipping_estimated_days ? Number(orderRow.shipping_estimated_days) : null,
      tracking_code: orderRow.tracking_code ? String(orderRow.tracking_code) : null,
      tracking_url: orderRow.tracking_url ? String(orderRow.tracking_url) : null,
      paid_at: orderRow.paid_at ? String(orderRow.paid_at) : null,
      created_at: String(orderRow.created_at),
      items: itemsRows.map((item) => ({
        id: String(item.id),
        product_id: String(item.product_id),
        product_name: String(item.product_name),
        product_slug: String(item.product_slug),
        sku: item.sku ? String(item.sku) : null,
        image_url: item.image_url ? String(item.image_url) : null,
        fulfillment_mode: item.fulfillment_mode as StoreOrderView["items"][0]["fulfillment_mode"],
        quantity: Number(item.quantity),
        unit_price_cents: Number(item.unit_price_cents),
        subtotal_cents: Number(item.subtotal_cents),
      })),
      digital_deliveries: deliveries.map((d) => ({
        id: String(d.id),
        product_id: String(d.product_id),
        product_name: String(d.product_name),
        delivery_type: d.delivery_type as NonNullable<StoreOrderView["digital_deliveries"]>[number]["delivery_type"],
        access_token: String(d.access_token),
        download_count: Number(d.download_count),
        max_downloads: Number(d.max_downloads),
        expires_at: String(d.expires_at),
        external_url: d.external_url ? String(d.external_url) : null,
        instructions: d.instructions ? String(d.instructions) : null,
      })),
      shipment_events: eventsRows.map((e) => ({
        id: String(e.id),
        status: String(e.status),
        description: String(e.description),
        location: e.location ? String(e.location) : null,
        occurred_at: String(e.occurred_at),
      })),
    };
  } catch (err) {
    log("error", "store.getStoreOrderByCode", { error: String(err) });
    return null;
  }
}
