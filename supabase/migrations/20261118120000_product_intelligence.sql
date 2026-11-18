-- SMKON Product Intelligence (draft).
-- NÃO APLICAR no Supabase hospedado sem autorização explícita do Owner.
-- Requer tabelas organizations e organization_members já existentes.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 200),
  source text not null check (source in ('kiwify','hotmart','shopify','amazon','manual','other')),
  external_id text,
  type text not null default 'unknown' check (type in ('digital','info','physical','service','unknown')),
  price_cents integer,
  currency text not null default 'BRL',
  commission_percent numeric(5,2),
  affiliate_url text,
  status text not null default 'discovered' check (status in ('discovered','selected','active','archived')),
  score numeric(5,2),
  score_reasons jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  revenue_domain text not null default 'affiliate' check (revenue_domain in ('own_sales','affiliate','media')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_org_status_idx
  on public.products(organization_id, status, updated_at desc);

create index if not exists products_source_external_idx
  on public.products(organization_id, source, external_id)
  where external_id is not null;

alter table public.products enable row level security;

revoke all on public.products from anon, authenticated;
grant select, insert, update, delete on public.products to authenticated;

-- Policies básicas (ajustar conforme roles reais)
create policy "members read products"
on public.products for select to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = products.organization_id
      and m.user_id = auth.uid()
  )
);

create policy "owners admins manage products"
on public.products for all to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = products.organization_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  )
)
with check (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = products.organization_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  )
);

comment on table public.products is 'Catálogo de produtos digitais/infoprodutos com scoring e evidências. Draft — não aplicado.';
