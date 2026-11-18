-- SMKON S12: indicadores reais do workspace em uma única leitura.
-- - security invoker: tudo passa pela RLS de quem consulta (nenhum dado de outro workspace).
-- - Não-membro recebe 'forbidden' em vez de zeros, para a interface não mostrar um painel vazio enganoso.
-- - Domínios financeiros nunca são somados entre si: afiliados, vendas próprias e mídia paga
--   vêm em blocos separados, por moeda.
-- - Somente leitura: a função não escreve nada.

create or replace function public.workspace_overview(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_since timestamptz := now() - interval '30 days';
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = p_organization_id and m.user_id = v_uid
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'generated_at', v_now,

    'content', (
      select jsonb_build_object(
        'total', count(*),
        'draft', count(*) filter (where c.status = 'draft'),
        'approved', count(*) filter (where c.status = 'approved'),
        'archived', count(*) filter (where c.status = 'archived')
      )
      from public.content_items c
      where c.organization_id = p_organization_id
    ),

    'approval_queue', coalesce((
      select jsonb_agg(q order by q.updated_at desc)
      from (
        select c.id, c.title, c.product, c.version, c.updated_at
        from public.content_items c
        where c.organization_id = p_organization_id and c.status = 'draft'
        order by c.updated_at desc
        limit 5
      ) q
    ), '[]'::jsonb),

    'products', (
      select jsonb_build_object(
        'total', count(*),
        'discovered', count(*) filter (where p.status = 'discovered'),
        'selected', count(*) filter (where p.status = 'selected'),
        'active', count(*) filter (where p.status = 'active'),
        'archived', count(*) filter (where p.status = 'archived'),
        'scored', count(*) filter (where p.score is not null and p.status <> 'archived'),
        'evidence_pending', (
          select count(*) from public.product_evidence e
          where e.organization_id = p_organization_id and e.review_status = 'pending'
        )
      )
      from public.products p
      where p.organization_id = p_organization_id
    ),

    'publication', (
      select jsonb_build_object(
        'next_7_days', count(*) filter (where j.scheduled_for < v_now + interval '7 days'),
        'awaiting_dry_run', count(*) filter (where j.status = 'scheduled'),
        'dry_run_passed', count(*) filter (where j.status = 'dry_run_passed'),
        'dry_run_failed', count(*) filter (where j.status = 'dry_run_failed'),
        'upcoming', coalesce((
          select jsonb_agg(u order by u.scheduled_for)
          from (
            select j2.id, c.title, j2.channel, j2.scheduled_for, j2.status
            from public.publication_jobs j2
            join public.content_items c on c.id = j2.content_item_id
            where j2.organization_id = p_organization_id
              and j2.status <> 'cancelled'
              and j2.scheduled_for >= v_now
            order by j2.scheduled_for
            limit 5
          ) u
        ), '[]'::jsonb)
      )
      from public.publication_jobs j
      where j.organization_id = p_organization_id
        and j.status <> 'cancelled'
        and j.scheduled_for >= v_now
    ),

    'finance', jsonb_build_object(
      'period_days', 30,

      -- Afiliados: estado atual de todas as comissões (o ciclo de vida não é recortado por período).
      'affiliate', coalesce((
        select jsonb_agg(jsonb_build_object(
          'currency', s.currency,
          'conversions', s.conversions,
          'forecast', s.forecast_amount,
          'approved', s.approved_amount,
          'settled', s.settled_amount,
          'paid', s.paid_amount,
          'cancelled', s.cancelled_amount,
          'reversed', s.reversed_amount
        ) order by s.currency)
        from public.affiliate_commission_summary s
        where s.organization_id = p_organization_id
      ), '[]'::jsonb),

      -- Vendas próprias nos últimos 30 dias. Bruto exclui pedidos cancelados; reembolsos à parte.
      'owned_sales', coalesce((
        select jsonb_agg(o order by o.currency)
        from (
          select
            so.currency::text as currency,
            count(*) filter (where so.order_status <> 'cancelled') as orders,
            coalesce(sum(so.gross_amount) filter (where so.order_status <> 'cancelled'), 0) as gross,
            coalesce(sum(so.refund_amount), 0) as refunds,
            coalesce(sum(so.fee_amount) filter (where so.order_status <> 'cancelled'), 0) as fees
          from public.sales_orders so
          where so.organization_id = p_organization_id and so.occurred_at >= v_since
          group by so.currency
        ) o
      ), '[]'::jsonb),

      -- Mídia paga nos últimos 30 dias: gasto é custo, nunca receita.
      'paid_media', coalesce((
        select jsonb_agg(a order by a.currency)
        from (
          select
            m.currency::text as currency,
            coalesce(sum(m.spend), 0) as spend,
            coalesce(sum(m.impressions), 0) as impressions,
            coalesce(sum(m.clicks), 0) as clicks
          from public.ad_campaign_daily_metrics m
          where m.organization_id = p_organization_id and m.metric_date >= (v_since at time zone 'America/Sao_Paulo')::date
          group by m.currency
        ) a
      ), '[]'::jsonb)
    ),

    'connections', (
      select jsonb_build_object(
        'total', count(*),
        'connected', count(*) filter (where sc.status = 'connected'),
        'attention', count(*) filter (where sc.status in ('reauthorization_required', 'error')),
        'items', coalesce(jsonb_agg(jsonb_build_object(
          'id', sc.id,
          'provider', sc.provider,
          'domain', sc.domain,
          'display_name', sc.display_name,
          'status', sc.status,
          'last_synced_at', sc.last_synced_at
        ) order by sc.domain, sc.provider) filter (where sc.id is not null), '[]'::jsonb)
      )
      from public.source_connections sc
      where sc.organization_id = p_organization_id
    )
  ) into v_result;

  return v_result;
end;
$$;

comment on function public.workspace_overview(uuid) is
  'S12: indicadores do workspace (conteúdo, produtos, fila, financeiro por domínio, conexões). Somente leitura, sob RLS do chamador.';

revoke all on function public.workspace_overview(uuid) from public, anon;
grant execute on function public.workspace_overview(uuid) to authenticated;
