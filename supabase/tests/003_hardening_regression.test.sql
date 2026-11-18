-- SMKON hardening regression checks.
-- Run after migrations using the repository's local test database harness.
-- Read-only catalog assertions; no production data is changed.
\set ON_ERROR_STOP 1
begin;

select tests.ok(
  not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename in (
        'ad_campaign_daily_metrics','affiliate_clicks','affiliate_conversions',
        'external_events','products','sales_order_adjustments','sales_orders',
        'source_connections'
      )
      and cmd='ALL'
      and roles @> array['authenticated']::name[]
  ),
  '1 no broad FOR ALL owner/admin policies remain on the eight tables'
);

select tests.ok(
  (select count(*) from pg_policies
   where schemaname='public'
     and tablename in (
       'ad_campaign_daily_metrics','affiliate_clicks','affiliate_conversions',
       'external_events','products','sales_order_adjustments','sales_orders',
       'source_connections'
     )
     and cmd='SELECT'
     and roles @> array['authenticated']::name[]) = 8,
  '2 each table retains exactly one authenticated member SELECT policy'
);

select tests.ok(
  (select count(*) from pg_indexes
   where schemaname='public' and indexname in (
     'ad_metrics_connection_fk_idx','ad_metrics_external_event_fk_idx',
     'affiliate_clicks_connection_fk_idx','affiliate_conversions_connection_fk_idx',
     'affiliate_conversions_external_event_fk_idx','content_approvals_decided_by_fk_idx',
     'content_approvals_org_fk_idx','content_items_approved_by_fk_idx',
     'content_items_created_by_fk_idx','content_versions_created_by_fk_idx',
     'content_versions_org_fk_idx','external_events_connection_fk_idx',
     'organizations_created_by_fk_idx','products_created_by_fk_idx',
     'sales_order_adjustments_order_fk_idx','sales_orders_connection_fk_idx',
     'sales_orders_external_event_fk_idx'
   )) = 17,
  '3 all 17 non-covered FK index definitions exist (the other two are covered by existing leading indexes)'
);

select tests.ok(
  (select count(*) from pg_trigger
   where not tgisinternal and tgname in (
     'audit_ad_campaign_daily_metrics','audit_affiliate_clicks',
     'audit_external_events','audit_sales_order_adjustments'
   )) = 4,
  '4 audit triggers cover all four previously uncovered business tables'
);

select tests.ok(
  has_function_privilege('authenticated','public.ensure_workspace()','EXECUTE')
  and has_function_privilege('authenticated','public.approve_content(uuid,text,text)','EXECUTE')
  and not has_function_privilege('anon','public.ensure_workspace()','EXECUTE')
  and not has_function_privilege('anon','public.approve_content(uuid,text,text)','EXECUTE'),
  '5 SECURITY DEFINER RPC grants remain intentional: authenticated only'
);

rollback;
