-- SMKON Product Intelligence (draft).
-- NÃO APLICAR no Supabase hospedado sem revisão de dependências e autorização explícita.
-- Requer public.organizations e public.organization_members criadas pela migration base.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 200),
  source text not null check (source in ('kiwify','hotmart','shopify','amazon','manual','other')),
  external_id text,
  type text not null default 'unknown' check (type in ('digital','info','physical','service','unknown')),
  price_cents integer check (price_cents is null or price_cents >= 0),
  currency text not null default 'BRL',
  commission_percent numeric(5,2) check (commission_percent is null or commission_percent between 0 and 100),
  affiliate_url text,
  status text not null default 'discovered' check (status in ('discovered','selected','active','archived')),
  score numeric(5,2) check (score is null or score between 0 and 100),
  score_reasons jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  revenue_domain public.smkon_revenue_domain not null default 'affiliate',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_org_status_idx
  on public.products(organization_id, status, updated_at desc);

create unique index if not exists products_source_external_uidx
  on public.products(organization_id, source, external_id)
  where external_id is not null;

alter table public.products enable row level security;
revoke all on public.products from anon, authenticated;
grant select, insert, update, delete on public.products to authenticated;

create policy "members read products"
on public.products for select to authenticated
using (exists (
  select 1 from public.organization_members m
  where m.organization_id = products.organization_id
    and m.user_id = (select auth.uid())
));

create policy "owners admins manage products"
on public.products for all to authenticated
using (exists (
  select 1 from public.organization_members m
  where m.organization_id = products.organization_id
    and m.user_id = (select auth.uid())
    and m.role in ('owner','admin')
))
with check (exists (
  select 1 from public.organization_members m
  where m.organization_id = products.organization_id
    and m.user_id = (select auth.uid())
    and m.role in ('owner','admin')
));

comment on table public.products is 'Catálogo SMKON com scoring explicável e evidências; migration pendente de validação.';
