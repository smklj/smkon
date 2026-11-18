-- Split 01: schema, grants, FKs compostas de tenant e isolamento por RLS.
-- SQL puro (sem pgTAP). Executar com scripts/test-db.sh após aplicar as migrations.
\set ON_ERROR_STOP 1
begin;

select tests.ok(to_regclass('public.' || t) is not null, 'tabela public.' || t || ' existe')
from unnest(array[
  'organizations', 'organization_members', 'source_connections', 'external_events',
  'ad_campaign_daily_metrics', 'sales_orders', 'sales_order_adjustments',
  'affiliate_clicks', 'affiliate_conversions', 'financial_ledger_entries'
]) as t;

select tests.ok(c.relrowsecurity, 'RLS habilitado em public.' || c.relname)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'organizations', 'organization_members', 'source_connections', 'external_events',
    'ad_campaign_daily_metrics', 'sales_orders', 'sales_order_adjustments',
    'affiliate_clicks', 'affiliate_conversions', 'financial_ledger_entries'
  );

select tests.ok(not has_table_privilege('anon', 'public.sales_orders', 'select'), 'anon não lê sales_orders');

select tests.ok(exists (
  select 1 from pg_constraint
  where conrelid = 'public.sales_order_adjustments'::regclass
    and contype = 'f'
    and pg_get_constraintdef(oid) like 'FOREIGN KEY (sales_order_id, organization_id)%'
), 'ajustes exigem pedido do mesmo tenant');

select tests.ok((
  select count(*) from pg_constraint
  where contype = 'f'
    and conrelid in (
      'public.ad_campaign_daily_metrics'::regclass,
      'public.sales_orders'::regclass,
      'public.affiliate_conversions'::regclass
    )
    and pg_get_constraintdef(oid) like 'FOREIGN KEY (external_event_id, organization_id, domain)%'
) = 3, 'referências a eventos exigem organização e domínio');

-- Fixture determinística: dois usuários, duas organizações e um pedido por tenant.
select tests.create_user('10000000-0000-4000-8000-000000000001', 'rls-a@smkon.test');
select tests.create_user('20000000-0000-4000-8000-000000000002', 'rls-b@smkon.test');

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

-- Domínio errado para o provedor é recusado (Mercado Livre é venda própria).
select tests.throws(
  $sql$insert into public.source_connections (organization_id, domain, provider, external_account_id)
       values ('10000000-0000-4000-8000-000000000011', 'affiliate', 'mercado_livre', 'x')$sql$,
  '23514',
  'provedor e domínio de receita precisam ser coerentes'
);

set local role authenticated;

select tests.login('10000000-0000-4000-8000-000000000001');
select tests.ok((select count(*) from public.sales_orders) = 1, 'tenant A vê apenas o próprio pedido');
select tests.ok((select external_order_id from public.sales_orders) = 'A-ORDER', 'tenant A vê o pedido A');

select tests.login('20000000-0000-4000-8000-000000000002');
select tests.ok((select count(*) from public.sales_orders) = 1, 'tenant B vê apenas o próprio pedido');
select tests.ok((select external_order_id from public.sales_orders) = 'B-ORDER', 'tenant B vê o pedido B');

reset role;
rollback;
