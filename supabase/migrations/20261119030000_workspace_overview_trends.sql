-- SMKON S7.2 (fase C): séries diárias em public.workspace_overview para os gráficos.
-- - Acrescenta a chave 'trends' (conteúdos criados em 14 dias, publicações nos próximos 7 dias e
--   execuções de agentes em 14 dias), sempre com todos os dias preenchidos (zero quando não há registro).
-- - Dias no fuso de Brasília. As chaves existentes não mudam: o código anterior continua funcionando.
-- - Mesmas garantias: security invoker (RLS de quem consulta), stable, forbidden para não-membro.

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
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
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

    -- Séries diárias no fuso de Brasília, para os gráficos da visão geral (S7.2 fase C).
    'trends', jsonb_build_object(
      'timezone', 'America/Sao_Paulo',
      'content_created', (
        select coalesce(jsonb_agg(jsonb_build_object('day', d.day::date, 'count', coalesce(c.n, 0)) order by d.day), '[]'::jsonb)
        from generate_series(v_today - 13, v_today, interval '1 day') as d(day)
        left join (
          select (ci.created_at at time zone 'America/Sao_Paulo')::date as day, count(*) as n
          from public.content_items ci
          where ci.organization_id = p_organization_id
            and ci.created_at >= ((v_today - 13)::timestamp at time zone 'America/Sao_Paulo')
          group by 1
        ) c on c.day = d.day::date
      ),
      'publications_scheduled', (
        select coalesce(jsonb_agg(jsonb_build_object('day', d.day::date, 'count', coalesce(p.n, 0)) order by d.day), '[]'::jsonb)
        from generate_series(v_today, v_today + 6, interval '1 day') as d(day)
        left join (
          select (pj.scheduled_for at time zone 'America/Sao_Paulo')::date as day, count(*) as n
          from public.publication_jobs pj
          where pj.organization_id = p_organization_id
            and pj.status <> 'cancelled'
            and pj.scheduled_for >= (v_today::timestamp at time zone 'America/Sao_Paulo')
            and pj.scheduled_for < ((v_today + 7)::timestamp at time zone 'America/Sao_Paulo')
          group by 1
        ) p on p.day = d.day::date
      ),
      'agent_runs', (
        select coalesce(jsonb_agg(jsonb_build_object('day', d.day::date, 'count', coalesce(a.n, 0)) order by d.day), '[]'::jsonb)
        from generate_series(v_today - 13, v_today, interval '1 day') as d(day)
        left join (
          select (ar.created_at at time zone 'America/Sao_Paulo')::date as day, count(*) as n
          from public.agent_runs ar
          where ar.organization_id = p_organization_id
            and ar.created_at >= ((v_today - 13)::timestamp at time zone 'America/Sao_Paulo')
          group by 1
        ) a on a.day = d.day::date
      )
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
  'S12/S7.2: indicadores do workspace (conteúdo, produtos, fila, financeiro por domínio, conexões e séries diárias). Somente leitura, sob RLS do chamador.';

revoke all on function public.workspace_overview(uuid) from public, anon;
grant execute on function public.workspace_overview(uuid) to authenticated;
