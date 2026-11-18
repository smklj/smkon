-- S12: indicadores reais do workspace (public.workspace_overview).
\set ON_ERROR_STOP 1
\set owner_a 'a1200000-0000-4000-8000-00000000000a'
\set viewer_a 'a1200000-0000-4000-8000-0000000000a2'
\set owner_b 'b1200000-0000-4000-8000-00000000000b'
\set stranger 'c1200000-0000-4000-8000-00000000000c'
begin;

select tests.create_user(:'owner_a', 'owner-a12@smkon.test');
select tests.create_user(:'viewer_a', 'viewer-a12@smkon.test');
select tests.create_user(:'owner_b', 'owner-b12@smkon.test');
select tests.create_user(:'stranger', 'stranger12@smkon.test');
set local role authenticated;
select tests.login(:'owner_a');
select workspace_id as org_a from public.ensure_workspace() \gset
select tests.login(:'owner_b');
select workspace_id as org_b from public.ensure_workspace() \gset
reset role;
insert into public.organization_members (organization_id, user_id, role) values (:'org_a', :'viewer_a', 'viewer');

-- 1. Workspace vazio: zeros e listas vazias, nunca null
set local role authenticated;
select tests.login(:'owner_a');
select public.workspace_overview(:'org_a') as empty_ov \gset
select tests.ok((:'empty_ov'::jsonb #>> '{content,total}')::int = 0, '1a conteúdo zerado');
select tests.ok(:'empty_ov'::jsonb -> 'approval_queue' = '[]'::jsonb, '1b fila de aprovação vazia é []');
select tests.ok((:'empty_ov'::jsonb #>> '{products,total}')::int = 0, '1c produtos zerados');
select tests.ok((:'empty_ov'::jsonb #>> '{publication,next_7_days}')::int = 0, '1d fila de publicação zerada');
select tests.ok(:'empty_ov'::jsonb #> '{publication,upcoming}' = '[]'::jsonb, '1e próximas publicações []');
select tests.ok(
  :'empty_ov'::jsonb #> '{finance,affiliate}' = '[]'::jsonb
  and :'empty_ov'::jsonb #> '{finance,owned_sales}' = '[]'::jsonb
  and :'empty_ov'::jsonb #> '{finance,paid_media}' = '[]'::jsonb,
  '1f domínios financeiros vazios são []'
);
select tests.ok(
  (:'empty_ov'::jsonb #>> '{connections,total}')::int = 0 and :'empty_ov'::jsonb #> '{connections,items}' = '[]'::jsonb,
  '1g nenhuma conexão'
);

-- Fixtures em A: 3 conteúdos (2 rascunhos, 1 aprovado e agendado), produto com evidência pendente
insert into public.content_items (organization_id, created_by, title, product, caption, channels)
values (:'org_a', :'owner_a', 'Rascunho 1', 'Produto 1', 'L1', array['Instagram']),
       (:'org_a', :'owner_a', 'Rascunho 2', 'Produto 2', 'L2', array['Instagram']);
insert into public.content_items (organization_id, created_by, title, caption, channels)
values (:'org_a', :'owner_a', 'Aprovado', 'L3', array['Instagram'])
returning id as approved_item, content_hash as approved_hash \gset
select public.approve_content(:'approved_item', :'approved_hash');
select public.schedule_publication(:'approved_item', 'Instagram', date_trunc('minute', now()) + interval '2 days') as job_soon \gset
select public.schedule_publication(:'approved_item', 'Instagram', date_trunc('minute', now()) + interval '20 days') as job_late \gset
select job_status from public.run_publication_dry_run(:'job_soon') \gset
select public.schedule_publication(:'approved_item', 'Instagram', date_trunc('minute', now()) + interval '3 days') as job_cancel \gset
select public.cancel_publication(:'job_cancel', 'teste S12');

insert into public.products (organization_id, name, source, type, revenue_domain)
values (:'org_a', 'Curso S12', 'hotmart', 'info', 'affiliate')
returning id as prod_a \gset
insert into public.product_evidence (organization_id, product_id, kind, claim, source_url)
values (:'org_a', :'prod_a', 'sales_page', 'Página ativa', 'https://hotmart.com/s12');

-- Fixtures financeiras e de conexão (escrita server-side, fora do papel authenticated)
reset role;
insert into public.source_connections (organization_id, domain, provider, external_account_id, status)
values (:'org_a', 'affiliate', 'amazon_associates', 'assoc-12', 'connected')
returning id as conn_aff \gset
insert into public.source_connections (organization_id, domain, provider, external_account_id, status)
values (:'org_a', 'owned_sales', 'mercado_livre', 'ml-12', 'reauthorization_required')
returning id as conn_ml \gset
insert into public.source_connections (organization_id, domain, provider, external_account_id, status)
values (:'org_a', 'paid_media', 'meta_ads', 'meta-12', 'connected')
returning id as conn_meta \gset
insert into public.source_connections (organization_id, domain, provider, external_account_id, status)
values (:'org_b', 'affiliate', 'amazon_associates', 'assoc-b12', 'connected')
returning id as conn_b \gset

insert into public.affiliate_conversions (organization_id, connection_id, provider, external_conversion_id, currency, commission_amount, occurred_at)
values (:'org_a', :'conn_aff', 'amazon_associates', 's12-1', 'BRL', 10, now()),
       (:'org_a', :'conn_aff', 'amazon_associates', 's12-2', 'BRL', 5, now()),
       (:'org_b', :'conn_b', 'amazon_associates', 's12-b', 'BRL', 999, now());
update public.affiliate_conversions set status = 'approved' where external_conversion_id = 's12-2';

insert into public.sales_orders (organization_id, connection_id, provider, external_order_id, order_status, currency, gross_amount, fee_amount, refund_amount, occurred_at)
values (:'org_a', :'conn_ml', 'mercado_livre', 'o-1', 'paid', 'BRL', 100, 12, 0, now() - interval '2 days'),
       (:'org_a', :'conn_ml', 'mercado_livre', 'o-2', 'refunded', 'BRL', 50, 6, 50, now() - interval '5 days'),
       (:'org_a', :'conn_ml', 'mercado_livre', 'o-3', 'cancelled', 'BRL', 70, 0, 0, now() - interval '1 day'),
       (:'org_a', :'conn_ml', 'mercado_livre', 'o-old', 'paid', 'BRL', 1000, 0, 0, now() - interval '45 days');

insert into public.ad_campaign_daily_metrics (organization_id, connection_id, campaign_external_id, metric_date, currency, spend, impressions, clicks)
values (:'org_a', :'conn_meta', 'camp-1', current_date - 1, 'BRL', 30, 1000, 40),
       (:'org_a', :'conn_meta', 'camp-1', current_date - 2, 'BRL', 20, 500, 10),
       (:'org_a', :'conn_meta', 'camp-1', current_date - 60, 'BRL', 500, 9000, 900);

-- 2. Conteúdo e fila de aprovação
set local role authenticated;
select tests.login(:'owner_a');
select public.workspace_overview(:'org_a') as ov \gset
select tests.ok(
  (:'ov'::jsonb #>> '{content,total}')::int = 3
  and (:'ov'::jsonb #>> '{content,draft}')::int = 2
  and (:'ov'::jsonb #>> '{content,approved}')::int = 1
  and (:'ov'::jsonb #>> '{content,archived}')::int = 0,
  '2a contagem por estado'
);
select tests.ok(jsonb_array_length(:'ov'::jsonb -> 'approval_queue') = 2, '2b fila de aprovação só com rascunhos');
select tests.ok(
  (select bool_and(q ? 'id' and q ? 'title' and q ? 'version' and q ? 'updated_at') from jsonb_array_elements(:'ov'::jsonb -> 'approval_queue') q),
  '2c itens da fila trazem id, título, versão e data'
);

-- 3. Produtos
select tests.ok(
  (:'ov'::jsonb #>> '{products,total}')::int = 1
  and (:'ov'::jsonb #>> '{products,discovered}')::int = 1
  and (:'ov'::jsonb #>> '{products,scored}')::int = 0
  and (:'ov'::jsonb #>> '{products,evidence_pending}')::int = 1,
  '3a produtos por estado, sem score sem evidência verificada, evidência pendente contada'
);

-- 4. Publicação: cancelado fica fora; janela de 7 dias
select tests.ok((:'ov'::jsonb #>> '{publication,next_7_days}')::int = 1, '4a só o job dentro de 7 dias');
-- Desde o S10b o dry-run exige mídia licenciada: sem mídia, o job reprova.
select tests.ok(:'job_status' = 'dry_run_failed', '4b dry-run sem mídia reprova (regra S10b)');
select tests.ok(
  (:'ov'::jsonb #>> '{publication,dry_run_failed}')::int = 1
  and (:'ov'::jsonb #>> '{publication,awaiting_dry_run}')::int = 1
  and (:'ov'::jsonb #>> '{publication,dry_run_passed}')::int = 0,
  '4c estados do dry-run contados'
);
select tests.ok(
  jsonb_array_length(:'ov'::jsonb #> '{publication,upcoming}') = 2
  and (:'ov'::jsonb #>> '{publication,upcoming,0,id}') = :'job_soon'
  and (:'ov'::jsonb #>> '{publication,upcoming,0,title}') = 'Aprovado',
  '4d próximas publicações em ordem, com título, sem a cancelada'
);

-- 5. Financeiro: domínios separados, sem vazamento entre workspaces
select tests.ok(
  jsonb_array_length(:'ov'::jsonb #> '{finance,affiliate}') = 1
  and (:'ov'::jsonb #>> '{finance,affiliate,0,forecast}')::numeric = 10
  and (:'ov'::jsonb #>> '{finance,affiliate,0,approved}')::numeric = 5
  and (:'ov'::jsonb #>> '{finance,affiliate,0,conversions}')::int = 2,
  '5a comissões por estado, só do workspace A'
);
select tests.ok(
  (:'ov'::jsonb #>> '{finance,owned_sales,0,orders}')::int = 2
  and (:'ov'::jsonb #>> '{finance,owned_sales,0,gross}')::numeric = 150
  and (:'ov'::jsonb #>> '{finance,owned_sales,0,refunds}')::numeric = 50
  and (:'ov'::jsonb #>> '{finance,owned_sales,0,fees}')::numeric = 18,
  '5b vendas próprias de 30 dias: cancelado e antigo fora, reembolso à parte'
);
select tests.ok(
  (:'ov'::jsonb #>> '{finance,paid_media,0,spend}')::numeric = 50
  and (:'ov'::jsonb #>> '{finance,paid_media,0,clicks}')::int = 50
  and (:'ov'::jsonb #>> '{finance,paid_media,0,impressions}')::int = 1500,
  '5c mídia paga de 30 dias'
);
select tests.ok((:'ov'::jsonb #>> '{finance,period_days}')::int = 30, '5d período declarado');

-- 6. Conexões reais
select tests.ok(
  (:'ov'::jsonb #>> '{connections,total}')::int = 3
  and (:'ov'::jsonb #>> '{connections,connected}')::int = 2
  and (:'ov'::jsonb #>> '{connections,attention}')::int = 1,
  '6a conexões por estado, só do workspace A'
);
select tests.ok(
  (select bool_and(not (i ? 'external_account_id') and not (i ? 'granted_scopes')) from jsonb_array_elements(:'ov'::jsonb #> '{connections,items}') i),
  '6b itens não expõem conta externa nem escopos'
);

-- 7. Viewer lê; quem não é membro é recusado
select tests.login(:'viewer_a');
select tests.ok((public.workspace_overview(:'org_a') #>> '{content,total}')::int = 3, '7a viewer vê os indicadores');
select tests.throws(format('select public.workspace_overview(%L)', :'org_b'), 'forbidden', '7b membro de A não lê B');
select tests.login(:'stranger');
select tests.throws(format('select public.workspace_overview(%L)', :'org_a'), 'forbidden', '7c usuário sem workspace é recusado');
select tests.login(:'owner_b');
select tests.ok(
  (public.workspace_overview(:'org_b') #>> '{content,total}')::int = 0
  and (public.workspace_overview(:'org_b') #>> '{finance,affiliate,0,forecast}')::numeric = 999,
  '7d B vê só os próprios dados'
);
reset role;

-- 8. Anônimo não executa; função é somente leitura e sob RLS
set local role anon;
select tests.throws(format('select public.workspace_overview(%L)', :'org_a'), '42501', '8a anon sem execução');
reset role;
select tests.ok(
  (select not prosecdef and provolatile = 's' from pg_proc where oid = 'public.workspace_overview(uuid)'::regprocedure),
  '8b security invoker e stable'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select tests.throws(format('select public.workspace_overview(%L)', :'org_a'), 'not_authenticated', '8c sem sessão é recusado');
reset role;

rollback;
