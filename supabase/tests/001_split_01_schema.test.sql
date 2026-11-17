-- Split 01: schema, grants, composite tenant FKs and RLS isolation.
-- Run with Supabase CLI against a disposable local database after applying migrations.
begin;

select plan(26);

select has_table('public', 'organizations', 'organizations table exists');
select has_table('public', 'organization_members', 'organization_members table exists');
select has_table('public', 'source_connections', 'source_connections table exists');
select has_table('public', 'external_events', 'external_events table exists');
select has_table('public', 'ad_campaign_daily_metrics', 'paid media metrics table exists');
select has_table('public', 'sales_orders', 'owned sales table exists');
select has_table('public', 'sales_order_adjustments', 'sales adjustments table exists');
select has_table('public', 'affiliate_clicks', 'affiliate clicks table exists');
select has_table('public', 'affiliate_conversions', 'affiliate conversions table exists');
select has_table('public', 'financial_ledger_entries', 'financial ledger table exists');

select ok((select relrowsecurity from pg_class where oid = 'public.organizations'::regclass), 'organizations has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.organization_members'::regclass), 'memberships has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.source_connections'::regclass), 'connections has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.external_events'::regclass), 'external events has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.ad_campaign_daily_metrics'::regclass), 'ad metrics has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.sales_orders'::regclass), 'sales orders has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.sales_order_adjustments'::regclass), 'sales adjustments has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.affiliate_clicks'::regclass), 'affiliate clicks has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.affiliate_conversions'::regclass), 'affiliate conversions has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.financial_ledger_entries'::regclass), 'financial ledger has RLS enabled');

select ok(not has_table_privilege('anon', 'public.sales_orders', 'select'), 'anon cannot read sales orders');
select ok(exists (
  select 1 from pg_constraint
  where conrelid = 'public.sales_order_adjustments'::regclass
    and contype = 'f'
    and pg_get_constraintdef(oid) like 'FOREIGN KEY (sales_order_id, organization_id)%'
), 'sales adjustments enforce matching order tenant');
select is((
  select count(*)::integer from pg_constraint
  where contype = 'f'
    and conrelid in (
      'public.ad_campaign_daily_metrics'::regclass,
      'public.sales_orders'::regclass,
      'public.affiliate_conversions'::regclass
    )
    and pg_get_constraintdef(oid) like 'FOREIGN KEY (external_event_id, organization_id, domain)%'
), 3, 'all event references enforce organization and domain');

-- Deterministic fixture: two users, two organizations and one order per tenant.
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'rls-a@smkon.test', '', now(), now(), now()),
  ('20000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'rls-b@smkon.test', '', now(), now(), now());

insert into public.organizations (id, name, slug, created_by)
values
  ('10000000-0000-4000-8000-000000000011', 'Tenant A', 'tenant-a-test', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000022', 'Tenant B', 'tenant-b-test', '20000000-0000-4000-8000-000000000002');

insert into public.organization_members (organization_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001', 'owner'),
  ('20000000-0000-4000-8000-000000000022', '20000000-0000-4000-8000-000000000002', 'owner');

insert into public.source_connections (id, organization_id, domain, provider, external_account_id, display_name, status)
values
  ('10000000-0000-4000-8000-000000000111', '10000000-0000-4000-8000-000000000011', 'owned_sales', 'mercado_livre', 'tenant-a-account', 'Tenant A', 'connected'),
  ('20000000-0000-4000-8000-000000000222', '20000000-0000-4000-8000-000000000022', 'owned_sales', 'mercado_livre', 'tenant-b-account', 'Tenant B', 'connected');

insert into public.sales_orders (
  id, organization_id, connection_id, domain, provider, external_order_id,
  order_status, currency, gross_amount, occurred_at
)
values
  ('10000000-0000-4000-8000-000000000333', '10000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000111', 'owned_sales', 'mercado_livre', 'A-ORDER', 'paid', 'BRL', 100, now()),
  ('20000000-0000-4000-8000-000000000444', '20000000-0000-4000-8000-000000000022', '20000000-0000-4000-8000-000000000222', 'owned_sales', 'mercado_livre', 'B-ORDER', 'paid', 'BRL', 200, now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*)::integer from public.sales_orders), 1, 'Tenant A only sees its own sales order');

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*)::integer from public.sales_orders), 1, 'Tenant B only sees its own sales order');

select * from finish();
rollback;
