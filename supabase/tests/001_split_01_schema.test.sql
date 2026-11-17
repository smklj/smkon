-- Structural checks for the Split 01 migration.
-- Run against a disposable Supabase local database after applying migrations.
begin;

select plan(18);

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
select ok((select relrowsecurity from pg_class where oid = 'public.affiliate_conversions'::regclass), 'affiliate conversions has RLS enabled');
select ok(not has_table_privilege('anon', 'public.sales_orders', 'select'), 'anon cannot read sales orders');

select * from finish();
rollback;
