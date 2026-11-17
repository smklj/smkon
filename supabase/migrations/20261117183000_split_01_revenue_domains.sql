-- SMKON Split 01: tenant foundation and isolated revenue domains.
-- This migration is reviewed in Git; it is not applied to the hosted database yet.

create extension if not exists pgcrypto;

create type public.smkon_revenue_domain as enum (
  'paid_media',
  'owned_sales',
  'affiliate'
);

create type public.smkon_connection_status as enum (
  'pending',
  'connected',
  'reauthorization_required',
  'disabled',
  'error'
);

create type public.smkon_commission_status as enum (
  'pending',
  'approved',
  'reversed',
  'paid'
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'analyst', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- Integration metadata only. OAuth secrets/tokens must live in a server-side
-- secret store, never in this table or a client-visible column.
create table public.source_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  domain public.smkon_revenue_domain not null,
  provider text not null check (provider in ('meta_ads', 'google_ads', 'mercado_livre', 'tiktok_shop_seller', 'tiktok_shop_affiliate', 'amazon_associates')),
  external_account_id text,
  display_name text,
  status public.smkon_connection_status not null default 'pending',
  granted_scopes text[] not null default '{}',
  last_synced_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, external_account_id),
  unique (id, organization_id, domain),
  check (
    (provider in ('meta_ads', 'google_ads') and domain = 'paid_media')
    or (provider = 'mercado_livre' and domain = 'owned_sales')
    or (provider = 'tiktok_shop_seller' and domain = 'owned_sales')
    or (provider in ('tiktok_shop_affiliate', 'amazon_associates') and domain = 'affiliate')
  )
);

create table public.external_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null,
  domain public.smkon_revenue_domain not null,
  provider text not null,
  external_id text not null,
  event_type text not null,
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  normalization_version integer not null default 1 check (normalization_version > 0),
  created_at timestamptz not null default now(),
  foreign key (connection_id, organization_id, domain)
    references public.source_connections(id, organization_id, domain) on delete restrict,
  unique (organization_id, provider, external_id, event_type)
);

create table public.ad_campaign_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null,
  domain public.smkon_revenue_domain not null default 'paid_media' check (domain = 'paid_media'),
  external_event_id uuid references public.external_events(id) on delete set null,
  campaign_external_id text not null,
  metric_date date not null,
  currency char(3) not null,
  spend numeric(18, 4) not null default 0 check (spend >= 0),
  impressions bigint not null default 0 check (impressions >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  conversions numeric(18, 4) not null default 0 check (conversions >= 0),
  created_at timestamptz not null default now(),
  foreign key (connection_id, organization_id, domain)
    references public.source_connections(id, organization_id, domain) on delete restrict,
  unique (organization_id, connection_id, campaign_external_id, metric_date, currency)
);

create table public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null,
  domain public.smkon_revenue_domain not null default 'owned_sales' check (domain = 'owned_sales'),
  external_event_id uuid references public.external_events(id) on delete set null,
  provider text not null,
  external_order_id text not null,
  order_status text not null check (order_status in ('pending', 'paid', 'fulfilled', 'cancelled', 'refunded', 'partially_refunded')),
  currency char(3) not null,
  gross_amount numeric(18, 4) not null check (gross_amount >= 0),
  discount_amount numeric(18, 4) not null default 0 check (discount_amount >= 0),
  fee_amount numeric(18, 4) not null default 0 check (fee_amount >= 0),
  shipping_amount numeric(18, 4) not null default 0 check (shipping_amount >= 0),
  refund_amount numeric(18, 4) not null default 0 check (refund_amount >= 0),
  occurred_at timestamptz not null,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (connection_id, organization_id, domain)
    references public.source_connections(id, organization_id, domain) on delete restrict,
  unique (organization_id, provider, external_order_id)
);

create table public.sales_order_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  adjustment_type text not null check (adjustment_type in ('discount', 'platform_fee', 'payment_fee', 'shipping', 'refund', 'chargeback', 'other')),
  amount numeric(18, 4) not null check (amount >= 0),
  currency char(3) not null,
  external_adjustment_id text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (organization_id, sales_order_id, adjustment_type, external_adjustment_id)
);

create table public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null,
  domain public.smkon_revenue_domain not null default 'affiliate' check (domain = 'affiliate'),
  tracking_id text not null,
  click_reference text not null,
  destination_host text not null,
  clicked_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (connection_id, organization_id, domain)
    references public.source_connections(id, organization_id, domain) on delete restrict,
  unique (organization_id, tracking_id, click_reference)
);

create table public.affiliate_conversions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null,
  domain public.smkon_revenue_domain not null default 'affiliate' check (domain = 'affiliate'),
  external_event_id uuid references public.external_events(id) on delete set null,
  provider text not null,
  external_conversion_id text not null,
  tracking_id text,
  currency char(3) not null,
  order_amount numeric(18, 4) check (order_amount >= 0),
  commission_amount numeric(18, 4) check (commission_amount >= 0),
  status public.smkon_commission_status not null default 'pending',
  occurred_at timestamptz not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (connection_id, organization_id, domain)
    references public.source_connections(id, organization_id, domain) on delete restrict,
  unique (organization_id, provider, external_conversion_id)
);

create table public.financial_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  domain public.smkon_revenue_domain not null,
  entry_type text not null check (entry_type in ('ad_spend', 'sales_gross', 'sales_discount', 'sales_fee', 'sales_shipping', 'sales_refund', 'affiliate_commission_pending', 'affiliate_commission_approved', 'affiliate_commission_paid', 'affiliate_commission_reversed')),
  source_table text not null check (source_table in ('ad_campaign_daily_metrics', 'sales_orders', 'sales_order_adjustments', 'affiliate_conversions')),
  source_id uuid not null,
  currency char(3) not null,
  amount numeric(18, 4) not null,
  effective_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (organization_id, source_table, source_id, entry_type)
);

create index organization_members_user_idx on public.organization_members(user_id);
create index source_connections_org_domain_idx on public.source_connections(organization_id, domain);
create index external_events_org_occurred_idx on public.external_events(organization_id, occurred_at desc);
create index sales_orders_org_occurred_idx on public.sales_orders(organization_id, occurred_at desc);
create index affiliate_conversions_org_status_idx on public.affiliate_conversions(organization_id, status, occurred_at desc);
create index ledger_org_effective_idx on public.financial_ledger_entries(organization_id, effective_at desc);

-- Every exposed table is RLS-protected. The first iteration is intentionally
-- owner-bootstrap only: invitation and role-management flows come in Sprint 1.
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.source_connections enable row level security;
alter table public.external_events enable row level security;
alter table public.ad_campaign_daily_metrics enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_order_adjustments enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.affiliate_conversions enable row level security;
alter table public.financial_ledger_entries enable row level security;

-- Explicit least-privilege grants: no anonymous access.
revoke all on public.organizations, public.organization_members, public.source_connections,
  public.external_events, public.ad_campaign_daily_metrics, public.sales_orders,
  public.sales_order_adjustments, public.affiliate_clicks, public.affiliate_conversions,
  public.financial_ledger_entries from anon, authenticated;

grant select, insert, update on public.organizations to authenticated;
grant select, insert on public.organization_members to authenticated;
grant select, insert, update, delete on public.source_connections,
  public.external_events, public.ad_campaign_daily_metrics, public.sales_orders,
  public.sales_order_adjustments, public.affiliate_clicks, public.affiliate_conversions,
  public.financial_ledger_entries to authenticated;

create policy "organization members can read organizations"
on public.organizations for select to authenticated
using (exists (
  select 1 from public.organization_members m
  where m.organization_id = id and m.user_id = (select auth.uid())
));

create policy "signed in user can create own organization"
on public.organizations for insert to authenticated
with check (created_by = (select auth.uid()));

create policy "owners can update organizations"
on public.organizations for update to authenticated
using (exists (
  select 1 from public.organization_members m
  where m.organization_id = id and m.user_id = (select auth.uid()) and m.role = 'owner'
))
with check (exists (
  select 1 from public.organization_members m
  where m.organization_id = id and m.user_id = (select auth.uid()) and m.role = 'owner'
));

create policy "users can read their own membership"
on public.organization_members for select to authenticated
using (user_id = (select auth.uid()));

create policy "creator can bootstrap own owner membership"
on public.organization_members for insert to authenticated
with check (
  user_id = (select auth.uid())
  and role = 'owner'
  and exists (
    select 1 from public.organizations o
    where o.id = organization_id and o.created_by = (select auth.uid())
  )
);

-- Shared tenant-membership predicate is expressed as EXISTS in each policy;
-- no SECURITY DEFINER helper is needed in this first cut.
create policy "members can read source connections"
on public.source_connections for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = source_connections.organization_id and m.user_id = (select auth.uid())));
create policy "owners and admins manage source connections"
on public.source_connections for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = source_connections.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin')))
with check (exists (select 1 from public.organization_members m where m.organization_id = source_connections.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin')));

create policy "members can read external events"
on public.external_events for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = external_events.organization_id and m.user_id = (select auth.uid())));
create policy "owners and admins manage external events"
on public.external_events for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = external_events.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin')))
with check (exists (select 1 from public.organization_members m where m.organization_id = external_events.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin')));

create policy "members can read ad metrics"
on public.ad_campaign_daily_metrics for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = ad_campaign_daily_metrics.organization_id and m.user_id = (select auth.uid())));
create policy "owners and admins manage ad metrics"
on public.ad_campaign_daily_metrics for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = ad_campaign_daily_metrics.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin')))
with check (exists (select 1 from public.organization_members m where m.organization_id = ad_campaign_daily_metrics.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin')));

create policy "members can read sales orders"
on public.sales_orders for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = sales_orders.organization_id and m.user_id = (select auth.uid())));
create policy "owners and admins manage sales orders"
on public.sales_orders for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = sales_orders.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin')))
with check (exists (select 1 from public.organization_members m where m.organization_id = sales_orders.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin')));

create policy "members can read sales adjustments"
on public.sales_order_adjustments for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = sales_order_adjustments.organization_id and m.user_id = (select auth.uid())));
create policy "owners and admins manage sales adjustments"
on public.sales_order_adjustments for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = sales_order_adjustments.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin')))
with check (exists (select 1 from public.organization_members m where m.organization_id = sales_order_adjustments.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin')));

create policy "members can read affiliate clicks"
on public.affiliate_clicks for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = affiliate_clicks.organization_id and m.user_id = (select auth.uid())));
create policy "owners and admins manage affiliate clicks"
on public.affiliate_clicks for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = affiliate_clicks.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin')))
with check (exists (select 1 from public.organization_members m where m.organization_id = affiliate_clicks.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin')));

create policy "members can read affiliate conversions"
on public.affiliate_conversions for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = affiliate_conversions.organization_id and m.user_id = (select auth.uid())));
create policy "owners and admins manage affiliate conversions"
on public.affiliate_conversions for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = affiliate_conversions.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin')))
with check (exists (select 1 from public.organization_members m where m.organization_id = affiliate_conversions.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin')));

create policy "members can read financial ledger"
on public.financial_ledger_entries for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = financial_ledger_entries.organization_id and m.user_id = (select auth.uid())));
create policy "owners and admins manage financial ledger"
on public.financial_ledger_entries for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = financial_ledger_entries.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin')))
with check (exists (select 1 from public.organization_members m where m.organization_id = financial_ledger_entries.organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin')));

-- Tables remain unexposed by default on newly created projects; grants above
-- are the explicit table-level permissions if Data API exposure is enabled.
