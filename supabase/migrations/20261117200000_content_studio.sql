-- SMKON Content Studio: organization-scoped editorial workspace.
-- Reviewed in Git only. Do not apply to hosted Supabase until approved.

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 180),
  product text not null default '',
  source_url text not null default '',
  asset_url text not null default '',
  script text not null default '',
  caption text not null default '',
  cta text not null default '',
  hashtags text not null default '',
  channels text[] not null default array['YouTube','Instagram','TikTok']::text[],
  rights_confirmed boolean not null default false,
  status text not null default 'draft' check (status in ('draft','approved','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(channels) > 0),
  check (channels <@ array['YouTube','Instagram','TikTok']::text[]),
  check (source_url = '' or rights_confirmed = true)
);

create index content_items_org_updated_idx
  on public.content_items(organization_id, updated_at desc);

alter table public.content_items enable row level security;
revoke all on public.content_items from anon, authenticated;
grant select, insert, update, delete on public.content_items to authenticated;

create policy "organization members can read content"
on public.content_items for select to authenticated
using (exists (
  select 1 from public.organization_members m
  where m.organization_id = content_items.organization_id
    and m.user_id = (select auth.uid())
));

create policy "owners and admins create content"
on public.content_items for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.organization_members m
    where m.organization_id = content_items.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
);

create policy "owners and admins update content"
on public.content_items for update to authenticated
using (exists (
  select 1 from public.organization_members m
  where m.organization_id = content_items.organization_id
    and m.user_id = (select auth.uid())
    and m.role in ('owner','admin')
))
with check (exists (
  select 1 from public.organization_members m
  where m.organization_id = content_items.organization_id
    and m.user_id = (select auth.uid())
    and m.role in ('owner','admin')
));

create policy "owners and admins delete content"
on public.content_items for delete to authenticated
using (exists (
  select 1 from public.organization_members m
  where m.organization_id = content_items.organization_id
    and m.user_id = (select auth.uid())
    and m.role in ('owner','admin')
));
