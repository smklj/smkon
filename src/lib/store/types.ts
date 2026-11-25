export type StoreFulfillmentMode = "internal_physical" | "internal_digital" | "external_affiliate";

export type StoreDigitalDeliveryType = "file_download" | "external_access" | "license_key" | "instructions_only";

export type StoreProduct = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  sku: string | null;
  short_description: string | null;
  description: string | null;
  category: string;
  subcategory: string | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  currency: string;
  image_urls: string[];
  fulfillment_mode: StoreFulfillmentMode;
  is_published_in_store: boolean;
  is_featured: boolean;
  is_bestseller: boolean;
  is_new_arrival: boolean;
  stock_quantity: number;
  track_inventory: boolean;
  weight_grams: number | null;
  height_cm: number | null;
  width_cm: number | null;
  length_cm: number | null;
  affiliate_url: string | null;
  source: string;
  digital_delivery_type: StoreDigitalDeliveryType | null;
  digital_benefits: string[];
  digital_instructions: string | null;
  score: number | null;
  updated_at: string;
};

export type StoreBanner = {
  id: string;
  title: string;
  subtitle?: string;
  badge_text?: string;
  cta_text: string;
  cta_href: string;
  image_url: string;
  active: boolean;
};

export type StoreCategoryNav = {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  badge?: string;
  description?: string;
};

export type StoreSocialLinks = {
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  whatsapp?: string;
  shopee?: string;
};

export type StoreSettings = {
  id: string;
  organization_id: string;
  store_name: string;
  store_tagline: string;
  logo_url: string | null;
  hero_banners: StoreBanner[];
  announcement_bar: {
    enabled: boolean;
    text: string;
    link?: string;
  };
  categories_nav: StoreCategoryNav[];
  primary_color: string;
  accent_color: string;
  support_email: string | null;
  support_whatsapp: string | null;
  social_links: StoreSocialLinks;
  shipping_origin_cep: string;
  free_shipping_min_cents: number | null;
  is_store_active: boolean;
  updated_at: string;
};

export type CartItem = {
  productId: string;
  name: string;
  slug: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  imageUrl: string;
  quantity: number;
  fulfillmentMode: StoreFulfillmentMode;
  digitalDeliveryType?: StoreDigitalDeliveryType | null;
  maxStock: number;
  trackInventory: boolean;
  weightGrams?: number | null;
  dimensions?: {
    height: number;
    width: number;
    length: number;
  };
};

export type ShippingQuote = {
  serviceId: string;
  serviceName: string;
  carrierName: string;
  priceCents: number;
  deliveryDays: number;
  description?: string;
};

export type ShippingOption = ShippingQuote;

export type StoreCouponInfo = {
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  discountAmountCents: number;
  description?: string;
};

export type StoreOrderAddress = {
  recipientName: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
};

export type StoreOrderCustomer = {
  name: string;
  email: string;
  document: string;
  phone: string;
};

export type StoreOrderSummary = {
  itemsSubtotalCents: number;
  shippingAmountCents: number;
  discountAmountCents: number;
  totalAmountCents: number;
};

export type StorePaymentMethod = "pix" | "credit_card" | "boleto";

export type StorePaymentStatus = "pending" | "processing" | "approved" | "rejected" | "refunded";

export type StoreOrderStatus =
  | "awaiting_payment"
  | "payment_confirmed"
  | "preparing"
  | "shipped"
  | "delivered"
  | "completed"
  | "cancelled";

export type CreateStoreOrderDraft = {
  items: Array<{ productId: string; quantity: number }>;
  customer: StoreOrderCustomer;
  shippingAddress?: StoreOrderAddress;
  shippingOption?: {
    serviceId: string;
    serviceName: string;
    carrierName: string;
    priceCents: number;
    deliveryDays: number;
  };
  couponCode?: string;
  paymentMethod: StorePaymentMethod;
  notes?: string;
};

export type StoreOrderItemView = {
  id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  sku: string | null;
  image_url: string | null;
  fulfillment_mode: StoreFulfillmentMode;
  quantity: number;
  unit_price_cents: number;
  subtotal_cents: number;
};

export type StoreDigitalDeliveryView = {
  id: string;
  product_id: string;
  product_name: string;
  delivery_type: StoreDigitalDeliveryType;
  access_token: string;
  download_count: number;
  max_downloads: number;
  expires_at: string;
  external_url: string | null;
  instructions: string | null;
};

export type StoreShipmentEventView = {
  id: string;
  status: string;
  description: string;
  location: string | null;
  occurred_at: string;
};

export type StoreOrderView = {
  id: string;
  order_code: string;
  status: StoreOrderStatus;
  payment_method: StorePaymentMethod;
  payment_status: StorePaymentStatus;
  items_subtotal_cents: number;
  shipping_amount_cents: number;
  discount_amount_cents: number;
  total_amount_cents: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: StoreOrderAddress | null;
  shipping_carrier_name: string | null;
  shipping_service_name: string | null;
  shipping_estimated_days: number | null;
  tracking_code: string | null;
  tracking_url: string | null;
  paid_at: string | null;
  created_at: string;
  items: StoreOrderItemView[];
  digital_deliveries?: StoreDigitalDeliveryView[];
  shipment_events?: StoreShipmentEventView[];
  pix_payment?: {
    qr_code: string;
    qr_code_base64?: string;
    ticket_url?: string;
    expires_at?: string;
  };
};
