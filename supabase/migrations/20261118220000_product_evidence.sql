-- SMKON S9: Product Intelligence persistente com evidências verificáveis.
-- - Evidência = afirmação + link https da fonte + data da observação. Append-only.
-- - Revisão humana (owner/admin) marca a evidência como verificada ou rejeitada, uma única vez.
-- - Score é calculado no banco só com evidências verificadas e recentes (180 dias).
--   Sem página de venda verificada, não há score (null), em vez de uma nota sem base.
-- - O cliente não escreve score, score_reasons nem evidence em products.
-- Nenhuma operação destrutiva: colunas antigas ficam; products está vazia no remoto.

-- ---------------------------------------------------------------------------
-- 1. products: autoria forçada, updated_at automático, score só pelo banco
-- ---------------------------------------------------------------------------
alter table public.products alter column created_by set default auth.uid();

create unique index if not exists products_id_org_uidx on public.products (id, organization_id);

create or replace function public.products_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    end if;
    new.score := null;
    new.score_reasons := '[]'::jsonb;
    new.evidence := '[]'::jsonb;
    new.created_at := now();
  else
    new.id := old.id;
    new.organization_id := old.organization_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.products_guard() from public, anon, authenticated;

create trigger products_guard
before insert or update on public.products
for each row execute function public.products_guard();

revoke insert, update on public.products from authenticated;
grant insert (organization_id, name, source, external_id, type, price_cents, currency,
              commission_percent, affiliate_url, status, revenue_domain)
  on public.products to authenticated;
grant update (name, source, external_id, type, price_cents, currency,
              commission_percent, affiliate_url, status, revenue_domain)
  on public.products to authenticated;

comment on column public.products.score is 'Calculado por public.product_recompute_score a partir de evidências verificadas. Null = evidência insuficiente.';
comment on column public.products.evidence is 'Obsoleta (S9): evidências vivem em public.product_evidence.';

-- ---------------------------------------------------------------------------
-- 2. product_evidence
-- ---------------------------------------------------------------------------
create table public.product_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  product_id uuid not null,
  kind text not null check (kind in ('sales_page', 'price', 'commission', 'rating', 'refund_policy', 'demand_signal', 'other')),
  claim text not null check (char_length(btrim(claim)) between 3 and 500),
  source_url text not null check (char_length(source_url) <= 2048 and source_url ~ '^https://[^[:space:]/?#]+\.[^[:space:]]*$'),
  value numeric(14, 2),
  observed_at timestamptz not null default now(),
  captured_by uuid not null default auth.uid() references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  review_status text not null default 'pending' check (review_status in ('pending', 'verified', 'rejected')),
  reviewed_by uuid references auth.users (id) on delete restrict,
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 500),
  foreign key (product_id, organization_id) references public.products (id, organization_id) on delete restrict,
  constraint product_evidence_review_coherent check (
    (review_status = 'pending') = (reviewed_by is null and reviewed_at is null)
  ),
  constraint product_evidence_value_by_kind check (
    case kind
      when 'price' then value is not null and value >= 0
      when 'commission' then value is not null and value between 0 and 100
      when 'rating' then value is not null and value between 0 and 5
      when 'refund_policy' then value is null or value between 0 and 365
      else value is null
    end
  )
);

create index product_evidence_product_idx on public.product_evidence (product_id, observed_at desc);
create index product_evidence_org_status_idx on public.product_evidence (organization_id, review_status);
create index product_evidence_captured_by_idx on public.product_evidence (captured_by);
create index product_evidence_reviewed_by_idx on public.product_evidence (reviewed_by);

alter table public.product_evidence enable row level security;
revoke all on public.product_evidence from anon, authenticated;
grant select on public.product_evidence to authenticated;
grant insert (organization_id, product_id, kind, claim, source_url, value, observed_at)
  on public.product_evidence to authenticated;

create policy "members read product evidence" on public.product_evidence
  for select to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = product_evidence.organization_id
      and m.user_id = (select auth.uid())
  ));

-- Analistas também coletam evidências; só owner/admin revisam.
create policy "editors add product evidence" on public.product_evidence
  for insert to authenticated with check (exists (
    select 1 from public.organization_members m
    where m.organization_id = product_evidence.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin', 'analyst')
  ));

-- Integridade: inserção sempre pendente e com autoria real; depois disso só a revisão muda, uma vez.
create or replace function public.product_evidence_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'evidence_immutable' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.captured_by := auth.uid();
    end if;
    new.claim := btrim(new.claim);
    new.review_status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.review_note := null;
    new.created_at := now();
    if new.observed_at > now() + interval '5 minutes' then
      raise exception 'evidence_in_future' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if old.review_status <> 'pending' then
    raise exception 'evidence_already_reviewed' using errcode = 'P0001';
  end if;
  if (new.id, new.organization_id, new.product_id, new.kind, new.claim, new.source_url, new.value,
      new.observed_at, new.captured_by, new.created_at)
     is distinct from
     (old.id, old.organization_id, old.product_id, old.kind, old.claim, old.source_url, old.value,
      old.observed_at, old.captured_by, old.created_at) then
    raise exception 'evidence_immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.product_evidence_guard() from public, anon, authenticated;

create trigger product_evidence_guard
before insert or update or delete on public.product_evidence
for each row execute function public.product_evidence_guard();

create trigger audit_product_evidence after insert or update on public.product_evidence
for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- 3. Score baseado em evidência (fonte única da regra)
-- ---------------------------------------------------------------------------
create or replace function public.product_evidence_score(p_product_id uuid)
returns table (score numeric, reasons jsonb)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_reasons jsonb := '[]'::jsonb;
  v_score numeric := 0;
  v_value numeric;
  v_count integer;
  v_stale integer;
begin
  select count(*) into v_stale
  from public.product_evidence e
  where e.product_id = p_product_id and e.review_status = 'verified'
    and e.observed_at < now() - interval '180 days';

  if not exists (
    select 1 from public.product_evidence e
    where e.product_id = p_product_id and e.kind = 'sales_page' and e.review_status = 'verified'
      and e.observed_at >= now() - interval '180 days'
  ) then
    v_reasons := jsonb_build_array('Sem página de venda verificada nos últimos 180 dias: score indisponível.');
    if v_stale > 0 then
      v_reasons := v_reasons || to_jsonb(format('%s evidência(s) verificada(s) com mais de 180 dias não contam.', v_stale));
    end if;
    return query select null::numeric, v_reasons;
    return;
  end if;

  v_score := 20;
  v_reasons := v_reasons || to_jsonb('Página de venda verificada: +20'::text);

  -- Valor mais recente verificado de cada tipo numérico.
  select e.value into v_value from public.product_evidence e
  where e.product_id = p_product_id and e.kind = 'commission' and e.review_status = 'verified'
    and e.observed_at >= now() - interval '180 days'
  order by e.observed_at desc limit 1;
  if v_value is not null then
    v_score := v_score + least(25, round(v_value / 2));
    v_reasons := v_reasons || to_jsonb(format('Comissão verificada de %s%%: +%s', v_value, least(25, round(v_value / 2))));
  else
    v_reasons := v_reasons || to_jsonb('Comissão não verificada: +0'::text);
  end if;

  v_value := null;
  select e.value into v_value from public.product_evidence e
  where e.product_id = p_product_id and e.kind = 'price' and e.review_status = 'verified'
    and e.observed_at >= now() - interval '180 days'
  order by e.observed_at desc limit 1;
  if v_value is null then
    v_reasons := v_reasons || to_jsonb('Preço não verificado: +0'::text);
  elsif v_value between 97 and 497 then
    v_score := v_score + 10;
    v_reasons := v_reasons || to_jsonb(format('Preço verificado de %s, na faixa 97–497: +10', v_value));
  else
    v_score := v_score + 5;
    v_reasons := v_reasons || to_jsonb(format('Preço verificado de %s, fora da faixa 97–497: +5', v_value));
  end if;

  v_value := null;
  select e.value into v_value from public.product_evidence e
  where e.product_id = p_product_id and e.kind = 'rating' and e.review_status = 'verified'
    and e.observed_at >= now() - interval '180 days'
  order by e.observed_at desc limit 1;
  if v_value is not null then
    v_score := v_score + round(v_value * 4);
    v_reasons := v_reasons || to_jsonb(format('Avaliação verificada de %s/5: +%s', v_value, round(v_value * 4)));
  else
    v_reasons := v_reasons || to_jsonb('Avaliação não verificada: +0'::text);
  end if;

  if exists (
    select 1 from public.product_evidence e
    where e.product_id = p_product_id and e.kind = 'refund_policy' and e.review_status = 'verified'
      and e.observed_at >= now() - interval '180 days'
  ) then
    v_score := v_score + 10;
    v_reasons := v_reasons || to_jsonb('Política de reembolso verificada: +10'::text);
  else
    v_reasons := v_reasons || to_jsonb('Política de reembolso não verificada: +0'::text);
  end if;

  select count(*) into v_count from public.product_evidence e
  where e.product_id = p_product_id and e.kind = 'demand_signal' and e.review_status = 'verified'
    and e.observed_at >= now() - interval '180 days';
  v_score := v_score + least(15, v_count * 5);
  v_reasons := v_reasons || to_jsonb(format('%s sinal(is) de demanda verificado(s): +%s', v_count, least(15, v_count * 5)));

  if v_stale > 0 then
    v_reasons := v_reasons || to_jsonb(format('%s evidência(s) verificada(s) com mais de 180 dias não contam.', v_stale));
  end if;

  return query select least(100, greatest(0, v_score)), v_reasons;
end;
$$;

revoke all on function public.product_evidence_score(uuid) from public, anon, authenticated;

create or replace function public.product_recompute_score(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_score numeric;
  v_reasons jsonb;
begin
  select s.score, s.reasons into v_score, v_reasons from public.product_evidence_score(p_product_id) s;
  update public.products p set score = v_score, score_reasons = v_reasons where p.id = p_product_id;
end;
$$;

revoke all on function public.product_recompute_score(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Revisão humana
-- ---------------------------------------------------------------------------
create or replace function public.review_product_evidence(p_evidence_id uuid, p_decision text, p_note text default null)
returns table (evidence_id uuid, product_score numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_evidence public.product_evidence%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_score numeric;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('verified', 'rejected') then
    raise exception 'invalid_decision' using errcode = 'P0001';
  end if;
  if p_decision = 'rejected' and v_note is null then
    raise exception 'review_note_required' using errcode = 'P0001';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'review_note_too_long' using errcode = 'P0001';
  end if;

  select * into v_evidence from public.product_evidence e where e.id = p_evidence_id for update;
  if v_evidence.id is null or not exists (
    select 1 from public.organization_members m
    where m.organization_id = v_evidence.organization_id and m.user_id = v_uid
  ) then
    raise exception 'evidence_not_found' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = v_evidence.organization_id and m.user_id = v_uid and m.role in ('owner', 'admin')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_evidence.review_status <> 'pending' then
    raise exception 'evidence_already_reviewed' using errcode = 'P0001';
  end if;

  update public.product_evidence e
  set review_status = p_decision, reviewed_by = v_uid, reviewed_at = now(), review_note = v_note
  where e.id = p_evidence_id;

  perform public.product_recompute_score(v_evidence.product_id);
  select p.score into v_score from public.products p where p.id = v_evidence.product_id;

  return query select p_evidence_id, v_score;
end;
$$;

revoke all on function public.review_product_evidence(uuid, text, text) from public, anon;
grant execute on function public.review_product_evidence(uuid, text, text) to authenticated;
