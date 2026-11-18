-- SMKON hardening: remove permissive SELECT overlap, cover FK lookups, complete audit triggers.
-- Prepared for review only. Do NOT apply to hosted production without explicit approval.

begin;

-- 1) Replace FOR ALL owner/admin policies with command-specific policies.
-- SELECT remains governed by the existing member-read policy.
drop policy if exists "owners and admins manage ad metrics" on public.ad_campaign_daily_metrics;
create policy "owners and admins insert ad metrics" on public.ad_campaign_daily_metrics
  for insert to authenticated with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = ad_campaign_daily_metrics.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  ));
create policy "owners and admins update ad metrics" on public.ad_campaign_daily_metrics
  for update to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = ad_campaign_daily_metrics.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  )) with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = ad_campaign_daily_metrics.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  ));
create policy "owners and admins delete ad metrics" on public.ad_campaign_daily_metrics
  for delete to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = ad_campaign_daily_metrics.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  ));

drop policy if exists "owners and admins manage affiliate clicks" on public.affiliate_clicks;
create policy "owners and admins insert affiliate clicks" on public.affiliate_clicks
  for insert to authenticated with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = affiliate_clicks.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  ));
create policy "owners and admins update affiliate clicks" on public.affiliate_clicks
  for update to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = affiliate_clicks.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  )) with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = affiliate_clicks.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  ));
create policy "owners and admins delete affiliate clicks" on public.affiliate_clicks
  for delete to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = affiliate_clicks.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  ));

drop policy if exists "owners and admins manage affiliate conversions" on public.affiliate_conversions;
create policy "owners and admins insert affiliate conversions" on public.affiliate_conversions
  for insert to authenticated with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = affiliate_conversions.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  ));
create policy "owners and admins update affiliate conversions" on public.affiliate_conversions
  for update to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = affiliate_conversions.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  )) with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = affiliate_conversions.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  ));
create policy "owners and admins delete affiliate conversions" on public.affiliate_conversions
  for delete to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = affiliate_conversions.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  ));

drop policy if exists "owners and admins manage external events" on public.external_events;
create policy "owners and admins insert external events" on public.external_events
  for insert to authenticated with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = external_events.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  ));
create policy "owners and admins update external events" on public.external_events
  for update to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = external_events.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  )) with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = external_events.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  ));
create policy "owners and admins delete external events" on public.external_events
  for delete to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = external_events.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  ));

drop policy if exists "owners admins manage products" on public.products;
create policy "owners admins insert products" on public.products
  for insert to authenticated with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = products.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  ));
create policy "owners admins update products" on public.products
  for update to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = products.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  )) with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = products.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  ));
create policy "owners admins delete products" on public.products
  for delete to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = products.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  ));

drop policy if exists "owners and admins manage sales adjustments" on public.sales_order_adjustments;
create policy "owners and admins insert sales adjustments" on public.sales_order_adjustments
  for insert to authenticated with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = sales_order_adjustments.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  ));
create policy "owners and admins update sales adjustments" on public.sales_order_adjustments
  for update to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = sales_order_adjustments.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  )) with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = sales_order_adjustments.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  ));
create policy "owners and admins delete sales adjustments" on public.sales_order_adjustments
  for delete to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = sales_order_adjustments.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  ));

drop policy if exists "owners and admins manage sales orders" on public.sales_orders;
create policy "owners and admins insert sales orders" on public.sales_orders
  for insert to authenticated with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = sales_orders.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  ));
create policy "owners and admins update sales orders" on public.sales_orders
  for update to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = sales_orders.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  )) with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = sales_orders.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  ));
create policy "owners and admins delete sales orders" on public.sales_orders
  for delete to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = sales_orders.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  ));

drop policy if exists "owners and admins manage source connections" on public.source_connections;
create policy "owners and admins insert source connections" on public.source_connections
  for insert to authenticated with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = source_connections.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  ));
create policy "owners and admins update source connections" on public.source_connections
  for update to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = source_connections.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  )) with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = source_connections.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  ));
create policy "owners and admins delete source connections" on public.source_connections
  for delete to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = source_connections.organization_id
      and m.user_id = (select auth.uid()) and m.role in ('owner','admin')
  ));

-- 2) Cover every FK flagged by the advisor. Composite indexes also cover the
-- leading single-column external_event_id FK where applicable.
create index if not exists ad_metrics_connection_fk_idx
  on public.ad_campaign_daily_metrics (connection_id, organization_id, domain);
create index if not exists ad_metrics_external_event_fk_idx
  on public.ad_campaign_daily_metrics (external_event_id, organization_id, domain);
create index if not exists affiliate_clicks_connection_fk_idx
  on public.affiliate_clicks (connection_id, organization_id, domain);
create index if not exists affiliate_conversions_connection_fk_idx
  on public.affiliate_conversions (connection_id, organization_id, domain);
create index if not exists affiliate_conversions_external_event_fk_idx
  on public.affiliate_conversions (external_event_id, organization_id, domain);
create index if not exists content_approvals_decided_by_fk_idx
  on public.content_approvals (decided_by);
create index if not exists content_approvals_org_fk_idx
  on public.content_approvals (organization_id);
create index if not exists content_items_approved_by_fk_idx
  on public.content_items (approved_by);
create index if not exists content_items_created_by_fk_idx
  on public.content_items (created_by);
create index if not exists content_versions_created_by_fk_idx
  on public.content_versions (created_by);
create index if not exists content_versions_org_fk_idx
  on public.content_versions (organization_id);
create index if not exists external_events_connection_fk_idx
  on public.external_events (connection_id, organization_id, domain);
create index if not exists organizations_created_by_fk_idx
  on public.organizations (created_by);
create index if not exists products_created_by_fk_idx
  on public.products (created_by);
create index if not exists sales_order_adjustments_order_fk_idx
  on public.sales_order_adjustments (sales_order_id, organization_id);
create index if not exists sales_orders_connection_fk_idx
  on public.sales_orders (connection_id, organization_id, domain);
create index if not exists sales_orders_external_event_fk_idx
  on public.sales_orders (external_event_id, organization_id, domain);

-- 3) Add audit coverage to remaining mutable business tables.
-- source_connections has no credential/token columns in the current schema;
-- external_events stores normalized metadata and payload_hash, not raw payload.
create trigger audit_ad_campaign_daily_metrics
after insert or update or delete on public.ad_campaign_daily_metrics
for each row execute function public.audit_row_change();

create trigger audit_affiliate_clicks
after insert or update or delete on public.affiliate_clicks
for each row execute function public.audit_row_change();

create trigger audit_external_events
after insert or update or delete on public.external_events
for each row execute function public.audit_row_change();

create trigger audit_sales_order_adjustments
after insert or update or delete on public.sales_order_adjustments
for each row execute function public.audit_row_change();

commit;
