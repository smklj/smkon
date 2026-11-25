-- SMKON Módulo Comercial & Loja Virtual Integrada
-- Revisado em Git. NÃO aplicar no Supabase hospedado sem autorização explícita.
-- Reutiliza: organizations, organization_members, products, source_connections,
-- sales_orders, financial_ledger_entries, rate_limit_hit, audit_log, reject_mutation.

begin;

-- ---------------------------------------------------------------------------
-- 1. Extensão do catálogo existente (public.products) — Única fonte de verdade
-- ---------------------------------------------------------------------------
alter table public.products drop constraint if exists products_source_check;
alter table public.products
  add constraint products_source_check check (source in (
    'kiwify', 'hotmart', 'shopify', 'amazon', 'shopee', 'shein', 'mercado_livre', 'smkon_store', 'manual', 'other'
  ));

alter table public.products
  add column if not exists slug text,
  add column if not exists short_description text check (short_description is null or char_length(short_description) <= 320),
  add column if not exists description text check (description is null or char_length(description) <= 12000),
  add column if not exists category text check (category is null or char_length(category) <= 80),
  add column if not exists subcategory text check (subcategory is null or char_length(subcategory) <= 80),
  add column if not exists sku text check (sku is null or char_length(sku) <= 80),
  add column if not exists compare_at_price_cents integer check (compare_at_price_cents is null or compare_at_price_cents >= 0),
  add column if not exists image_urls jsonb not null default '[]'::jsonb check (jsonb_typeof(image_urls) = 'array'),
  add column if not exists fulfillment_mode text not null default 'internal_physical'
    check (fulfillment_mode in ('internal_physical', 'internal_digital', 'external_affiliate')),
  add column if not exists is_published_in_store boolean not null default false,
  add column if not exists is_featured boolean not null default false,
  add column if not exists is_bestseller boolean not null default false,
  add column if not exists is_new_arrival boolean not null default false,
  add column if not exists stock_quantity integer not null default 0 check (stock_quantity >= 0),
  add column if not exists track_inventory boolean not null default true,
  add column if not exists weight_grams integer check (weight_grams is null or weight_grams > 0),
  add column if not exists height_cm numeric(8,2) check (height_cm is null or height_cm > 0),
  add column if not exists width_cm numeric(8,2) check (width_cm is null or width_cm > 0),
  add column if not exists length_cm numeric(8,2) check (length_cm is null or length_cm > 0),
  add column if not exists digital_delivery_type text
    check (digital_delivery_type is null or digital_delivery_type in ('file', 'link', 'license_key', 'course_access')),
  add column if not exists digital_asset_path text check (digital_asset_path is null or char_length(digital_asset_path) <= 500),
  add column if not exists digital_external_url text check (digital_external_url is null or char_length(digital_external_url) <= 2048),
  add column if not exists digital_benefits jsonb not null default '[]'::jsonb check (jsonb_typeof(digital_benefits) = 'array'),
  add column if not exists digital_instructions text check (digital_instructions is null or char_length(digital_instructions) <= 4000);

create unique index if not exists products_org_slug_uidx
  on public.products (organization_id, slug)
  where slug is not null;

create index if not exists products_store_catalog_idx
  on public.products (organization_id, is_published_in_store, status, category, updated_at desc)
  where is_published_in_store = true;

-- ---------------------------------------------------------------------------
-- 2. Extensão de source_connections para loja própria e gateways BR
-- ---------------------------------------------------------------------------
alter table public.source_connections drop constraint if exists source_connections_provider_check;
alter table public.source_connections drop constraint if exists source_connections_check;

alter table public.source_connections
  add constraint source_connections_provider_check check (provider in (
    'meta_ads', 'google_ads', 'mercado_livre', 'tiktok_shop_seller', 'tiktok_shop_affiliate',
    'amazon_associates', 'hotmart', 'shopify', 'stripe', 'mercado_pago', 'smkon_store'
  ));

alter table public.source_connections
  add constraint source_connections_check check (
    (provider in ('meta_ads', 'google_ads') and domain = 'paid_media')
    or (provider in ('mercado_livre', 'tiktok_shop_seller', 'shopify', 'stripe', 'mercado_pago', 'smkon_store') and domain = 'owned_sales')
    or (provider in ('tiktok_shop_affiliate', 'amazon_associates') and domain = 'affiliate')
    or (provider = 'hotmart' and domain in ('owned_sales', 'affiliate'))
  );

-- ---------------------------------------------------------------------------
-- 3. Configurações e Aparência da Loja (por workspace)
-- ---------------------------------------------------------------------------
create table if not exists public.store_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  store_name text not null default 'SMKON Loja Oficial' check (char_length(trim(store_name)) between 1 and 120),
  tagline text not null default 'Achados inteligentes, produtos digitais e soluções comerciais.',
  hero_badge text not null default 'Curadoria Oficial SMKON',
  hero_title text not null default 'Produtos selecionados e soluções digitais para crescer mais rápido.',
  hero_subtitle text not null default 'Compre direto da SMKON com entrega rastreada ou acesse nossos infoprodutos, sistemas e planilhas com liberação automática.',
  hero_cta_label text not null default 'Explorar catálogo',
  hero_cta_href text not null default '/loja/produtos',
  hero_banner_url text,
  promo_strip_text text not null default 'PIX com confirmação automática · Entrega digital imediata após aprovação · Curadoria Shopee verificada',
  origin_postal_code text check (origin_postal_code is null or origin_postal_code ~ '^[0-9]{8}$'),
  free_shipping_threshold_cents integer check (free_shipping_threshold_cents is null or free_shipping_threshold_cents >= 0),
  payment_provider text not null default 'none' check (payment_provider in ('none', 'mercado_pago', 'stripe')),
  shipping_provider text not null default 'none' check (shipping_provider in ('none', 'melhor_envio')),
  contact_email text check (contact_email is null or char_length(contact_email) <= 200),
  contact_whatsapp text check (contact_whatsapp is null or char_length(contact_whatsapp) <= 40),
  instagram_url text,
  tiktok_url text,
  youtube_url text,
  featured_categories jsonb not null default '["Periféricos & Setup","Utilidades","Infoprodutos","Sistemas & PDV","Achadinhos Shopee"]'::jsonb
    check (jsonb_typeof(featured_categories) = 'array'),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.store_settings enable row level security;
revoke all on public.store_settings from public, anon, authenticated;
grant select, insert, update on public.store_settings to authenticated;
grant select, insert, update on public.store_settings to service_role;

create policy "members read store settings"
  on public.store_settings for select to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = store_settings.organization_id
      and m.user_id = (select auth.uid())
  ));

create policy "owners admins insert store settings"
  on public.store_settings for insert to authenticated
  with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = store_settings.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  ));

create policy "owners admins update store settings"
  on public.store_settings for update to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = store_settings.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  ))
  with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = store_settings.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  ));

-- ---------------------------------------------------------------------------
-- 4. Cupons de desconto da loja
-- ---------------------------------------------------------------------------
create table if not exists public.store_coupons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9_-]{3,40}$'),
  description text,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value integer not null check (discount_value > 0),
  min_order_cents integer not null default 0 check (min_order_cents >= 0),
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  expires_at timestamptz,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  check (discount_type <> 'percent' or discount_value <= 90)
);

create index if not exists store_coupons_org_active_idx
  on public.store_coupons (organization_id, active, code);

alter table public.store_coupons enable row level security;
revoke all on public.store_coupons from public, anon, authenticated;
grant select, insert, update, delete on public.store_coupons to authenticated;
grant select, update on public.store_coupons to service_role;

create policy "members read store coupons"
  on public.store_coupons for select to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = store_coupons.organization_id
      and m.user_id = (select auth.uid())
  ));

create policy "owners admins insert store coupons"
  on public.store_coupons for insert to authenticated
  with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = store_coupons.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  ));

create policy "owners admins update store coupons"
  on public.store_coupons for update to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = store_coupons.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  ))
  with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = store_coupons.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  ));

create policy "owners admins delete store coupons"
  on public.store_coupons for delete to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = store_coupons.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  ));

-- ---------------------------------------------------------------------------
-- 5. Credenciais comerciais criptografadas (server-only / service_role)
-- ---------------------------------------------------------------------------
create table if not exists public.store_integration_secrets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('mercado_pago', 'stripe', 'melhor_envio')),
  sandbox boolean not null default true,
  encrypted_config jsonb not null check (jsonb_typeof(encrypted_config) = 'object'),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

alter table public.store_integration_secrets enable row level security;
revoke all on public.store_integration_secrets from public, anon, authenticated;
grant select, insert, update, delete on public.store_integration_secrets to service_role;

-- ---------------------------------------------------------------------------
-- 6. Pedidos da Loja Virtual (store_orders & store_order_items)
-- ---------------------------------------------------------------------------
create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_code text not null unique check (order_code ~ '^SMK-[A-Z0-9]{6,16}$'),
  access_token_hash text not null check (access_token_hash ~ '^[a-f0-9]{64}$'),
  customer_name text not null check (char_length(trim(customer_name)) between 2 and 160),
  customer_email text not null check (char_length(trim(customer_email)) between 5 and 200),
  customer_phone text not null check (char_length(trim(customer_phone)) between 8 and 32),
  shipping_address jsonb,
  has_physical_items boolean not null default false,
  has_digital_items boolean not null default false,
  status text not null default 'pending_payment' check (status in (
    'pending_payment', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded'
  )),
  payment_status text not null default 'pending' check (payment_status in (
    'pending', 'approved', 'rejected', 'refunded', 'cancelled'
  )),
  payment_provider text not null default 'none' check (payment_provider in ('none', 'mercado_pago', 'stripe')),
  payment_method text check (payment_method is null or payment_method in ('pix', 'credit_card', 'boleto', 'checkout_pro')),
  external_payment_id text,
  payment_checkout_url text,
  pix_qr_code text,
  pix_qr_code_base64 text,
  boleto_url text,
  coupon_code text,
  subtotal_cents integer not null check (subtotal_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  currency char(3) not null default 'BRL',
  shipping_provider text check (shipping_provider is null or shipping_provider in ('melhor_envio', 'digital', 'manual')),
  shipping_service_id text,
  shipping_service_name text,
  shipping_carrier text,
  shipping_delivery_days integer check (shipping_delivery_days is null or shipping_delivery_days >= 0),
  tracking_code text check (tracking_code is null or char_length(tracking_code) <= 120),
  tracking_url text check (tracking_url is null or char_length(tracking_url) <= 500),
  shipping_status text not null default 'awaiting_payment' check (shipping_status in (
    'awaiting_payment', 'not_required', 'pending_dispatch', 'label_generated', 'posted', 'in_transit', 'delivered', 'cancelled'
  )),
  sales_order_id uuid references public.sales_orders(id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_orders_org_created_idx
  on public.store_orders (organization_id, created_at desc);
create index if not exists store_orders_org_status_idx
  on public.store_orders (organization_id, status, payment_status);
create index if not exists store_orders_sales_order_fk_idx
  on public.store_orders (sales_order_id);

alter table public.store_orders enable row level security;
revoke all on public.store_orders from public, anon, authenticated;
grant select, update on public.store_orders to authenticated;
grant select, insert, update on public.store_orders to service_role;

create policy "owners admins read store orders"
  on public.store_orders for select to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = store_orders.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  ));

create policy "owners admins update store orders"
  on public.store_orders for update to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = store_orders.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  ))
  with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = store_orders.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  ));

create table if not exists public.store_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.store_orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  fulfillment_mode text not null check (fulfillment_mode in ('internal_physical', 'internal_digital')),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity > 0 and quantity <= 100),
  total_cents integer not null check (total_cents >= 0),
  created_at timestamptz not null default now()
);

create index if not exists store_order_items_org_fk_idx
  on public.store_order_items (organization_id);
create index if not exists store_order_items_order_fk_idx
  on public.store_order_items (order_id);
create index if not exists store_order_items_product_fk_idx
  on public.store_order_items (product_id);

alter table public.store_order_items enable row level security;
revoke all on public.store_order_items from public, anon, authenticated;
grant select on public.store_order_items to authenticated;
grant select, insert on public.store_order_items to service_role;

create policy "owners admins read store order items"
  on public.store_order_items for select to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = store_order_items.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  ));

-- ---------------------------------------------------------------------------
-- 7. Histórico de transações de pagamento (idempotente por provider + ext_id)
-- ---------------------------------------------------------------------------
create table if not exists public.store_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.store_orders(id) on delete cascade,
  provider text not null check (provider in ('mercado_pago', 'stripe')),
  external_payment_id text not null,
  payment_method text,
  status text not null check (status in ('pending', 'approved', 'rejected', 'refunded', 'cancelled')),
  amount_cents integer not null check (amount_cents >= 0),
  fee_cents integer not null default 0 check (fee_cents >= 0),
  currency char(3) not null default 'BRL',
  idempotency_key text,
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (provider, external_payment_id)
);

create index if not exists store_payments_org_fk_idx
  on public.store_payments (organization_id);
create index if not exists store_payments_order_fk_idx
  on public.store_payments (order_id, created_at desc);

alter table public.store_payments enable row level security;
revoke all on public.store_payments from public, anon, authenticated;
grant select on public.store_payments to authenticated;
grant select, insert, update on public.store_payments to service_role;

create policy "owners admins read store payments"
  on public.store_payments for select to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = store_payments.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  ));

-- ---------------------------------------------------------------------------
-- 8. Histórico logístico & rastreamento
-- ---------------------------------------------------------------------------
create table if not exists public.store_shipment_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.store_orders(id) on delete cascade,
  status text not null,
  description text not null,
  location text,
  tracking_code text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists store_shipment_events_org_fk_idx
  on public.store_shipment_events (organization_id);
create index if not exists store_shipment_events_order_fk_idx
  on public.store_shipment_events (order_id, occurred_at desc);

alter table public.store_shipment_events enable row level security;
revoke all on public.store_shipment_events from public, anon, authenticated;
grant select, insert on public.store_shipment_events to authenticated;
grant select, insert on public.store_shipment_events to service_role;

create policy "owners admins read shipment events"
  on public.store_shipment_events for select to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = store_shipment_events.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  ));

create policy "owners admins insert shipment events"
  on public.store_shipment_events for insert to authenticated
  with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = store_shipment_events.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  ));

-- ---------------------------------------------------------------------------
-- 9. Entregas Digitais Seguras (liberadas apenas após pagamento confirmado)
-- ---------------------------------------------------------------------------
create table if not exists public.store_digital_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.store_orders(id) on delete cascade,
  order_item_id uuid not null references public.store_order_items(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  delivery_token_hash text not null unique check (delivery_token_hash ~ '^[a-f0-9]{64}$'),
  delivery_token_hint text,
  max_downloads integer not null default 10 check (max_downloads > 0),
  download_count integer not null default 0 check (download_count >= 0),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_item_id)
);

create index if not exists store_digital_deliveries_org_fk_idx
  on public.store_digital_deliveries (organization_id);
create index if not exists store_digital_deliveries_order_fk_idx
  on public.store_digital_deliveries (order_id);
create index if not exists store_digital_deliveries_product_fk_idx
  on public.store_digital_deliveries (product_id);

alter table public.store_digital_deliveries enable row level security;
revoke all on public.store_digital_deliveries from public, anon, authenticated;
grant select on public.store_digital_deliveries to authenticated;
grant select, insert, update on public.store_digital_deliveries to service_role;

create policy "owners admins read digital deliveries"
  on public.store_digital_deliveries for select to authenticated
  using (exists (
    select 1 from public.organization_members m
    where m.organization_id = store_digital_deliveries.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  ));

-- ---------------------------------------------------------------------------
-- 10. Auditoria segura sem exposição de PII para store_orders e cupons
-- ---------------------------------------------------------------------------
create or replace function public.store_order_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (organization_id, actor_id, action, table_name, record_id, old_data, new_data)
  values (
    new.organization_id,
    auth.uid(),
    tg_op,
    'store_orders',
    new.id::text,
    case when tg_op = 'UPDATE' then jsonb_build_object(
      'status', old.status,
      'payment_status', old.payment_status,
      'shipping_status', old.shipping_status,
      'tracking_code', old.tracking_code
    ) end,
    jsonb_build_object(
      'order_code', new.order_code,
      'status', new.status,
      'payment_status', new.payment_status,
      'shipping_status', new.shipping_status,
      'total_cents', new.total_cents,
      'tracking_code', new.tracking_code
    )
  );
  return null;
end;
$$;
revoke all on function public.store_order_audit() from public, anon, authenticated;

drop trigger if exists audit_store_orders on public.store_orders;
create trigger audit_store_orders
  after insert or update on public.store_orders
  for each row execute function public.store_order_audit();

-- ---------------------------------------------------------------------------
-- 11. RPC Atômica: Criação de Pedido (calcula preços & reserva estoque)
-- ---------------------------------------------------------------------------
create or replace function public.store_create_order(
  p_organization_id uuid,
  p_order_code text,
  p_access_token_hash text,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_shipping_address jsonb,
  p_items jsonb,
  p_coupon_code text default null,
  p_shipping_cents integer default 0,
  p_shipping_provider text default null,
  p_shipping_service_id text default null,
  p_shipping_service_name text default null,
  p_shipping_carrier text default null,
  p_shipping_delivery_days integer default null,
  p_payment_provider text default 'none',
  p_payment_method text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_prod record;
  v_qty integer;
  v_line_total integer;
  v_subtotal integer := 0;
  v_discount integer := 0;
  v_shipping integer := greatest(coalesce(p_shipping_cents, 0), 0);
  v_total integer;
  v_has_physical boolean := false;
  v_has_digital boolean := false;
  v_coupon record;
  v_order_id uuid;
  v_clean_coupon text := nullif(upper(trim(coalesce(p_coupon_code, ''))), '');
begin
  if p_organization_id is null or p_order_code is null or p_access_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_order_parameters' using errcode = '22023';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  -- Trava produtos envolvidos em ordem determinística de ID (evita deadlocks) e calcula subtotal real
  for v_item in
    select value from jsonb_array_elements(p_items) order by (value->>'product_id')
  loop
    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    if v_qty <= 0 or v_qty > 100 then
      raise exception 'invalid_item_quantity' using errcode = '22023';
    end if;

    select p.id, p.name, p.price_cents, p.status, p.is_published_in_store, p.fulfillment_mode,
           p.stock_quantity, p.track_inventory
      into v_prod
    from public.products p
    where p.id = (v_item->>'product_id')::uuid
      and p.organization_id = p_organization_id
    for update;

    if v_prod.id is null or not v_prod.is_published_in_store or v_prod.status <> 'active' then
      raise exception 'product_unavailable' using errcode = 'P0002';
    end if;

    if v_prod.fulfillment_mode = 'external_affiliate' then
      raise exception 'external_product_cannot_checkout' using errcode = '22023';
    end if;

    if v_prod.price_cents is null or v_prod.price_cents <= 0 then
      raise exception 'product_price_unavailable' using errcode = '22023';
    end if;

    if v_prod.fulfillment_mode = 'internal_physical' then
      v_has_physical := true;
      if v_prod.track_inventory then
        if v_prod.stock_quantity < v_qty then
          raise exception 'insufficient_stock' using errcode = 'P0001';
        end if;
        update public.products
        set stock_quantity = stock_quantity - v_qty,
            updated_at = now()
        where id = v_prod.id;
      end if;
    else
      v_has_digital := true;
    end if;

    v_line_total := v_prod.price_cents * v_qty;
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  if not v_has_physical then
    v_shipping := 0;
  elsif p_shipping_address is null or jsonb_typeof(p_shipping_address) <> 'object' then
    raise exception 'shipping_address_required' using errcode = '22023';
  end if;

  -- Valida e aplica cupom se informado
  if v_clean_coupon is not null then
    select * into v_coupon
    from public.store_coupons c
    where c.organization_id = p_organization_id
      and c.code = v_clean_coupon
      and c.active = true
      and (c.expires_at is null or c.expires_at > now())
    for update;

    if v_coupon.id is null then
      raise exception 'coupon_invalid' using errcode = 'P0001';
    end if;
    if v_coupon.max_uses is not null and v_coupon.used_count >= v_coupon.max_uses then
      raise exception 'coupon_limit_reached' using errcode = 'P0001';
    end if;
    if v_subtotal < v_coupon.min_order_cents then
      raise exception 'coupon_min_order_not_met' using errcode = 'P0001';
    end if;

    if v_coupon.discount_type = 'percent' then
      v_discount := round((v_subtotal::numeric * v_coupon.discount_value) / 100.0)::integer;
    else
      v_discount := least(v_coupon.discount_value, v_subtotal);
    end if;

    update public.store_coupons
    set used_count = used_count + 1, updated_at = now()
    where id = v_coupon.id;
  end if;

  v_total := greatest(v_subtotal - v_discount + v_shipping, 0);

  insert into public.store_orders (
    organization_id, order_code, access_token_hash,
    customer_name, customer_email, customer_phone, shipping_address,
    has_physical_items, has_digital_items,
    status, payment_status, payment_provider, payment_method,
    coupon_code, subtotal_cents, discount_cents, shipping_cents, total_cents,
    shipping_provider, shipping_service_id, shipping_service_name, shipping_carrier, shipping_delivery_days,
    shipping_status
  ) values (
    p_organization_id, p_order_code, p_access_token_hash,
    trim(p_customer_name), lower(trim(p_customer_email)), trim(p_customer_phone), p_shipping_address,
    v_has_physical, v_has_digital,
    'pending_payment', 'pending', coalesce(p_payment_provider, 'none'), p_payment_method,
    v_clean_coupon, v_subtotal, v_discount, v_shipping, v_total,
    case when v_has_physical then p_shipping_provider else 'digital' end,
    p_shipping_service_id, p_shipping_service_name, p_shipping_carrier, p_shipping_delivery_days,
    case when v_has_physical then 'awaiting_payment' else 'not_required' end
  ) returning id into v_order_id;

  -- Grava snapshot imutável dos itens do pedido
  insert into public.store_order_items (
    organization_id, order_id, product_id, product_name, fulfillment_mode,
    unit_price_cents, quantity, total_cents
  )
  select
    p_organization_id,
    v_order_id,
    p.id,
    p.name,
    p.fulfillment_mode,
    p.price_cents,
    (x.value->>'quantity')::integer,
    p.price_cents * (x.value->>'quantity')::integer
  from jsonb_array_elements(p_items) x
  join public.products p
    on p.id = (x.value->>'product_id')::uuid
   and p.organization_id = p_organization_id;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_code', p_order_code,
    'subtotal_cents', v_subtotal,
    'discount_cents', v_discount,
    'shipping_cents', v_shipping,
    'total_cents', v_total,
    'has_physical_items', v_has_physical,
    'has_digital_items', v_has_digital
  );
end;
$$;

revoke all on function public.store_create_order(uuid, text, text, text, text, text, jsonb, jsonb, text, integer, text, text, text, text, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.store_create_order(uuid, text, text, text, text, text, jsonb, jsonb, text, integer, text, text, text, text, integer, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 12. RPC Atômica e Idempotente: Confirmação de Pagamento, Entrega Digital & Ledger
-- ---------------------------------------------------------------------------
create or replace function public.store_confirm_payment(
  p_order_id uuid,
  p_provider text,
  p_external_payment_id text,
  p_payment_status text,
  p_payment_method text default null,
  p_amount_cents integer default null,
  p_fee_cents integer default 0,
  p_payload_hash text default null,
  p_delivery_tokens jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_prev_payment_status text;
  v_conn_id uuid;
  v_sales_order_id uuid;
  v_item record;
  v_tok jsonb;
  v_hash text := coalesce(p_payload_hash, encode(sha256(convert_to(p_provider || ':' || p_external_payment_id || ':' || p_payment_status, 'UTF8')), 'hex'));
  v_order_status_mapped text;
begin
  if p_payment_status not in ('pending', 'approved', 'rejected', 'refunded', 'cancelled') then
    raise exception 'invalid_payment_status' using errcode = '22023';
  end if;

  select * into v_order from public.store_orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  v_prev_payment_status := v_order.payment_status;

  -- Registro idempotente da transação de pagamento
  insert into public.store_payments (
    organization_id, order_id, provider, external_payment_id, payment_method,
    status, amount_cents, fee_cents, currency, payload_hash, occurred_at
  ) values (
    v_order.organization_id, v_order.id, p_provider, p_external_payment_id, p_payment_method,
    p_payment_status, coalesce(p_amount_cents, v_order.total_cents), greatest(coalesce(p_fee_cents, 0), 0),
    v_order.currency, v_hash, now()
  )
  on conflict (provider, external_payment_id)
  do update set
    status = excluded.status,
    payment_method = coalesce(excluded.payment_method, public.store_payments.payment_method),
    fee_cents = greatest(excluded.fee_cents, public.store_payments.fee_cents),
    payload_hash = excluded.payload_hash,
    occurred_at = now();

  -- Se já estava aprovado e chega confirmação duplicada, não regride nem gera estoque/ledger duplo
  if v_prev_payment_status = 'approved' and p_payment_status in ('pending', 'approved') then
    return jsonb_build_object('ok', true, 'idempotent', true, 'payment_status', v_prev_payment_status);
  end if;

  if p_payment_status = 'approved' then
    update public.store_orders
    set payment_status = 'approved',
        status = case when status = 'pending_payment' then 'paid' else status end,
        shipping_status = case when has_physical_items and shipping_status = 'awaiting_payment' then 'pending_dispatch' else shipping_status end,
        payment_provider = p_provider,
        payment_method = coalesce(p_payment_method, payment_method),
        external_payment_id = p_external_payment_id,
        updated_at = now()
    where id = v_order.id;

    -- Gera tokens de entrega digital apenas após aprovação confirmada
    if v_order.has_digital_items and jsonb_typeof(p_delivery_tokens) = 'array' then
      for v_tok in select value from jsonb_array_elements(p_delivery_tokens)
      loop
        insert into public.store_digital_deliveries (
          organization_id, order_id, order_item_id, product_id,
          delivery_token_hash, delivery_token_hint, max_downloads
        )
        select
          v_order.organization_id,
          v_order.id,
          oi.id,
          oi.product_id,
          v_tok->>'token_hash',
          v_tok->>'token_hint',
          10
        from public.store_order_items oi
        where oi.id = (v_tok->>'order_item_id')::uuid
          and oi.order_id = v_order.id
          and oi.fulfillment_mode = 'internal_digital'
        on conflict (order_item_id) do nothing;
      end loop;
    end if;

    -- Garante conexão canônica smkon_store para sincronizar financeiro/ledger sem PII
    insert into public.source_connections (
      organization_id, domain, provider, external_account_id, display_name, status
    ) values (
      v_order.organization_id, 'owned_sales', 'smkon_store', 'smkon-loja-virtual', 'SMKON Loja Virtual', 'connected'
    )
    on conflict (organization_id, provider, external_account_id)
    do update set status = 'connected', last_synced_at = now(), updated_at = now()
    returning id into v_conn_id;

    v_order_status_mapped := case when v_order.has_physical_items then 'paid' else 'fulfilled' end;

    insert into public.sales_orders (
      organization_id, connection_id, domain, provider, external_order_id,
      order_status, currency, gross_amount, discount_amount, fee_amount, shipping_amount, refund_amount,
      occurred_at, settled_at
    ) values (
      v_order.organization_id, v_conn_id, 'owned_sales', 'smkon_store', v_order.order_code,
      v_order_status_mapped, v_order.currency,
      (v_order.subtotal_cents::numeric / 100.0),
      (v_order.discount_cents::numeric / 100.0),
      (coalesce(p_fee_cents, 0)::numeric / 100.0),
      (v_order.shipping_cents::numeric / 100.0),
      0,
      v_order.created_at,
      now()
    )
    on conflict (organization_id, provider, external_order_id)
    do update set
      order_status = excluded.order_status,
      fee_amount = excluded.fee_amount,
      settled_at = coalesce(public.sales_orders.settled_at, now())
    returning id into v_sales_order_id;

    update public.store_orders set sales_order_id = v_sales_order_id where id = v_order.id;

    insert into public.financial_ledger_entries (
      organization_id, domain, entry_type, source_table, source_id, currency, amount, effective_at
    ) values (
      v_order.organization_id, 'owned_sales', 'sales_gross', 'sales_orders', v_sales_order_id,
      v_order.currency, (v_order.total_cents::numeric / 100.0), now()
    ) on conflict (organization_id, source_table, source_id, entry_type) do nothing;

    if coalesce(p_fee_cents, 0) > 0 then
      insert into public.financial_ledger_entries (
        organization_id, domain, entry_type, source_table, source_id, currency, amount, effective_at
      ) values (
        v_order.organization_id, 'owned_sales', 'sales_fee', 'sales_orders', v_sales_order_id,
        v_order.currency, -(p_fee_cents::numeric / 100.0), now()
      ) on conflict (organization_id, source_table, source_id, entry_type) do nothing;
    end if;

  elsif p_payment_status in ('cancelled', 'rejected', 'refunded') then
    -- Restaura estoque se ainda não tinha sido cancelado/reembolsado
    if v_prev_payment_status not in ('cancelled', 'rejected', 'refunded') then
      for v_item in
        select oi.product_id, oi.quantity
        from public.store_order_items oi
        join public.products p on p.id = oi.product_id
        where oi.order_id = v_order.id
          and oi.fulfillment_mode = 'internal_physical'
          and p.track_inventory = true
      loop
        update public.products
        set stock_quantity = stock_quantity + v_item.quantity, updated_at = now()
        where id = v_item.product_id;
      end loop;
    end if;

    update public.store_orders
    set payment_status = p_payment_status,
        status = case when p_payment_status = 'refunded' then 'refunded' else 'cancelled' end,
        shipping_status = case when has_physical_items then 'cancelled' else shipping_status end,
        external_payment_id = coalesce(external_payment_id, p_external_payment_id),
        updated_at = now()
    where id = v_order.id;

    if v_order.sales_order_id is not null and p_payment_status = 'refunded' then
      update public.sales_orders
      set order_status = 'refunded', refund_amount = (v_order.total_cents::numeric / 100.0)
      where id = v_order.sales_order_id;

      insert into public.financial_ledger_entries (
        organization_id, domain, entry_type, source_table, source_id, currency, amount, effective_at
      ) values (
        v_order.organization_id, 'owned_sales', 'sales_refund', 'sales_orders', v_order.sales_order_id,
        v_order.currency, -(v_order.total_cents::numeric / 100.0), now()
      ) on conflict (organization_id, source_table, source_id, entry_type) do nothing;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'order_id', v_order.id,
    'payment_status', p_payment_status
  );
end;
$$;

revoke all on function public.store_confirm_payment(uuid, text, text, text, text, integer, integer, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.store_confirm_payment(uuid, text, text, text, text, integer, integer, text, jsonb)
  to service_role;

commit;
