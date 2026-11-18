-- SMKON S8: ciclo de vida das comissões de afiliado e lançamentos no ledger.
-- Regra do projeto: não confundir receita prevista, aprovada, liquidada, cancelada ou paga.
--
-- Estados (smkon_commission_status):
--   pending   = prevista (conversão registrada, ainda não validada pelo programa)
--   approved  = aprovada (validada; ainda não disponível)
--   settled   = liquidada (disponível para saque/pagamento)  [novo]
--   paid      = paga (recebida)
--   cancelled = cancelada antes da aprovação               [novo]
--   reversed  = estornada depois de aprovada, liquidada ou paga
--
-- Transições válidas:
--   pending  → approved | cancelled
--   approved → settled  | reversed
--   settled  → paid     | reversed
--   paid     → reversed
--   cancelled, reversed: finais
--
-- Cada mudança de estado grava histórico append-only e um lançamento no ledger
-- (append-only). Valores ficam travados depois que a comissão sai de "prevista".
--
-- Compatível com execução em uma única transação (apply_migration): os novos valores
-- do enum só aparecem como texto ou dentro de corpos de função.

alter type public.smkon_commission_status add value if not exists 'settled' after 'approved';
alter type public.smkon_commission_status add value if not exists 'cancelled' after 'settled';

-- ---------------------------------------------------------------------------
-- 1. Tipos de lançamento do ledger para os novos estados
-- ---------------------------------------------------------------------------
alter table public.financial_ledger_entries drop constraint if exists financial_ledger_entries_entry_type_check;
alter table public.financial_ledger_entries add constraint financial_ledger_entries_entry_type_check
  check (entry_type in (
    'ad_spend',
    'sales_gross', 'sales_discount', 'sales_fee', 'sales_shipping', 'sales_refund',
    'affiliate_commission_pending', 'affiliate_commission_approved', 'affiliate_commission_settled',
    'affiliate_commission_paid', 'affiliate_commission_cancelled', 'affiliate_commission_reversed'
  ));

comment on column public.financial_ledger_entries.amount is
  'Lançamentos de comissão registram cada mudança de estado: positivo em prevista/aprovada/liquidada/paga, negativo em cancelada/estornada. Some sempre filtrando por entry_type; nunca some tipos diferentes.';

-- ---------------------------------------------------------------------------
-- 2. Histórico append-only das mudanças de estado
-- ---------------------------------------------------------------------------
create table public.affiliate_commission_status_history (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversion_id uuid not null references public.affiliate_conversions(id) on delete cascade,
  from_status text check (from_status in ('pending', 'approved', 'settled', 'paid', 'cancelled', 'reversed')),
  to_status text not null check (to_status in ('pending', 'approved', 'settled', 'paid', 'cancelled', 'reversed')),
  commission_amount numeric(18, 4),
  currency char(3) not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index affiliate_commission_history_conversion_idx
  on public.affiliate_commission_status_history (conversion_id, changed_at);
create index affiliate_commission_history_org_idx
  on public.affiliate_commission_status_history (organization_id, changed_at desc);
create index affiliate_commission_history_changed_by_fk_idx
  on public.affiliate_commission_status_history (changed_by);

alter table public.affiliate_commission_status_history enable row level security;
revoke all on public.affiliate_commission_status_history from anon, authenticated;
grant select on public.affiliate_commission_status_history to authenticated;

create policy "members read commission history"
on public.affiliate_commission_status_history for select to authenticated
using (exists (
  select 1 from public.organization_members m
  where m.organization_id = affiliate_commission_status_history.organization_id
    and m.user_id = (select auth.uid())
));

create trigger affiliate_commission_history_append_only
before update or delete on public.affiliate_commission_status_history
for each row when (pg_trigger_depth() = 0)
execute function public.reject_mutation();

-- ---------------------------------------------------------------------------
-- 3. Guarda de transições e de valores
-- ---------------------------------------------------------------------------
create or replace function public.affiliate_conversion_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from text := old.status::text;
  v_to text := new.status::text;
begin
  -- Identidade e origem são imutáveis.
  new.id := old.id;
  new.organization_id := old.organization_id;
  new.connection_id := old.connection_id;
  new.domain := old.domain;
  new.provider := old.provider;
  new.external_conversion_id := old.external_conversion_id;
  new.created_at := old.created_at;

  -- Valores só mudam enquanto a comissão é prevista.
  if v_from <> 'pending' and (
    new.commission_amount is distinct from old.commission_amount
    or new.order_amount is distinct from old.order_amount
    or new.currency is distinct from old.currency
  ) then
    raise exception 'commission_amount_locked'
      using errcode = 'P0001', hint = 'Valores travam ao sair de "prevista". Registre um estorno.';
  end if;

  if v_from <> v_to and (v_from, v_to) not in (
    ('pending', 'approved'), ('pending', 'cancelled'),
    ('approved', 'settled'), ('approved', 'reversed'),
    ('settled', 'paid'), ('settled', 'reversed'),
    ('paid', 'reversed')
  ) then
    raise exception 'invalid_commission_transition'
      using errcode = 'P0001', detail = v_from || ' -> ' || v_to;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger affiliate_conversion_guard
before update on public.affiliate_conversions
for each row execute function public.affiliate_conversion_guard();

-- ---------------------------------------------------------------------------
-- 4. Histórico + lançamento no ledger a cada estado alcançado
-- ---------------------------------------------------------------------------
create or replace function public.affiliate_conversion_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from text;
  v_to text := new.status::text;
begin
  if tg_op = 'UPDATE' then
    v_from := old.status::text;
    if v_from = v_to then
      return null;
    end if;
  end if;

  insert into public.affiliate_commission_status_history
    (organization_id, conversion_id, from_status, to_status, commission_amount, currency, changed_by)
  values
    (new.organization_id, new.id, v_from, v_to, new.commission_amount, new.currency, auth.uid());

  -- Sem valor informado não há lançamento financeiro (apenas histórico).
  if new.commission_amount is not null then
    insert into public.financial_ledger_entries
      (organization_id, domain, entry_type, source_table, source_id, currency, amount, effective_at)
    values (
      new.organization_id,
      'affiliate',
      'affiliate_commission_' || v_to,
      'affiliate_conversions',
      new.id,
      new.currency,
      case when v_to in ('cancelled', 'reversed') then -new.commission_amount else new.commission_amount end,
      now()
    )
    on conflict (organization_id, source_table, source_id, entry_type) do nothing;
  end if;

  return null;
end;
$$;

create trigger affiliate_conversion_post
after insert or update of status on public.affiliate_conversions
for each row execute function public.affiliate_conversion_post();

revoke all on function public.affiliate_conversion_guard() from public, anon, authenticated;
revoke all on function public.affiliate_conversion_post() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Resumo por estado (respeita RLS de quem consulta)
-- ---------------------------------------------------------------------------
create view public.affiliate_commission_summary
with (security_invoker = true)
as
select
  c.organization_id,
  c.currency,
  count(*)::integer as conversions,
  coalesce(sum(c.commission_amount) filter (where c.status::text = 'pending'), 0) as forecast_amount,
  coalesce(sum(c.commission_amount) filter (where c.status::text = 'approved'), 0) as approved_amount,
  coalesce(sum(c.commission_amount) filter (where c.status::text = 'settled'), 0) as settled_amount,
  coalesce(sum(c.commission_amount) filter (where c.status::text = 'paid'), 0) as paid_amount,
  coalesce(sum(c.commission_amount) filter (where c.status::text = 'cancelled'), 0) as cancelled_amount,
  coalesce(sum(c.commission_amount) filter (where c.status::text = 'reversed'), 0) as reversed_amount
from public.affiliate_conversions c
group by c.organization_id, c.currency;

revoke all on public.affiliate_commission_summary from anon, authenticated;
grant select on public.affiliate_commission_summary to authenticated;
