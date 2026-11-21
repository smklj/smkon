-- S16: índices da paginação por cursor e coluna products.score_rank.
\set ON_ERROR_STOP 1
\set owner_a 'a4000000-0000-4000-8000-00000000004a'
\set owner_b 'b4000000-0000-4000-8000-00000000004b'
begin;

select tests.create_user(:'owner_a', 'owner-a40@smkon.test');
select tests.create_user(:'owner_b', 'owner-b40@smkon.test');
set local role authenticated;
select tests.login(:'owner_a');
select workspace_id as org_a from public.ensure_workspace() \gset
select tests.login(:'owner_b');
select workspace_id as org_b from public.ensure_workspace() \gset
reset role;

-- 1. Índices existem com as colunas e a ordem que as consultas usam; os redundantes saíram.
select tests.ok(
  (select indexdef like '%(organization_id, score_rank DESC, updated_at DESC, id DESC)'
     from pg_indexes where schemaname = 'public' and indexname = 'products_org_rank_keyset_idx'),
  '1a índice de produtos: organization_id, score_rank desc, updated_at desc, id desc'
);
select tests.ok(
  (select indexdef like '%(organization_id, updated_at DESC, id DESC)'
     from pg_indexes where schemaname = 'public' and indexname = 'content_items_org_updated_id_idx'),
  '1b índice de conteúdos: organization_id, updated_at desc, id desc'
);
select tests.ok(
  (select indexdef like '%(organization_id, created_at DESC, id DESC)'
     from pg_indexes where schemaname = 'public' and indexname = 'media_assets_org_created_id_idx'),
  '1c índice de mídia: organization_id, created_at desc, id desc'
);
select tests.ok(
  (select indexdef like '%(organization_id, status)'
     from pg_indexes where schemaname = 'public' and indexname = 'content_items_org_status_idx'),
  '1d índice de contagem de conteúdo por status'
);
select tests.ok(
  not exists (select 1 from pg_indexes where schemaname = 'public'
              and indexname in ('content_items_org_updated_idx', 'media_assets_org_idx')),
  '1e índices substituídos (mesmo prefixo) foram removidos'
);

-- 2. score_rank é gerada: segue o score (centésimos, -1 sem score) e não aceita escrita.
select tests.ok(
  (select is_generated = 'ALWAYS' and data_type = 'integer'
     from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'score_rank'),
  '2a score_rank é coluna gerada do tipo integer'
);

set local role authenticated;
select tests.login(:'owner_a');
insert into public.products (organization_id, name, source) values
  (:'org_a', 'Sem score', 'manual'),
  (:'org_a', 'Score 55,5', 'manual'),
  (:'org_a', 'Score 0', 'manual'),
  (:'org_a', 'Score 100', 'manual');
select tests.throws(
  format('insert into public.products (organization_id, name, source, score_rank) values (%L, ''X'', ''manual'', 999)', :'org_a'),
  '428C9',
  '2b cliente não escreve score_rank'
);
reset role;

-- O score só muda pelo banco (review_product_evidence); aqui os gatilhos ficam
-- desligados só para fixar valores de teste.
set local session_replication_role = replica;
update public.products set score = 55.5 where organization_id = :'org_a' and name = 'Score 55,5';
update public.products set score = 0 where organization_id = :'org_a' and name = 'Score 0';
update public.products set score = 100 where organization_id = :'org_a' and name = 'Score 100';
set local session_replication_role = origin;

select tests.ok(
  (select array_agg(score_rank order by name) = array[0, 10000, 5550, -1]
     from public.products where organization_id = :'org_a'),
  '2c score_rank = score em centésimos e -1 sem score'
);
select tests.ok(
  (select array_agg(name order by score_rank desc, updated_at desc, id desc)
       = array_agg(name order by score desc nulls last, updated_at desc, id desc)
     from public.products where organization_id = :'org_a'),
  '2d ordenar por score_rank desc equivale a score desc nulls last'
);

-- 3. EXPLAIN de verificação: sob RLS, o limite do cursor vira condição de índice.
--    (seqscan desligado porque a tabela de teste é pequena; o que se confere é que o
--    planejador consegue usar o filtro no índice, o que exige operadores LEAKPROOF.)
create function pg_temp.plan_of(p_sql text) returns text language plpgsql as $$
declare
  v_line text;
  v_plan text := '';
begin
  for v_line in execute 'explain (costs off) ' || p_sql loop
    v_plan := v_plan || v_line || E'\n';
  end loop;
  return v_plan;
end;
$$;
grant execute on function pg_temp.plan_of(text) to authenticated;

set local enable_seqscan = off;
set local enable_bitmapscan = off;
set local role authenticated;
select tests.login(:'owner_a');
select pg_temp.plan_of(format(
  'select id from public.products where organization_id = %L and status <> ''archived'' and score_rank <= 5550 '
  'and (score_rank < 5550 or (score_rank = 5550 and updated_at < now()) or (score_rank = 5550 and updated_at = now() and id < %L)) '
  'order by score_rank desc, updated_at desc, id desc limit 51', :'org_a', gen_random_uuid())) as plan_products \gset
select tests.ok(
  :'plan_products' like '%products_org_rank_keyset_idx%' and :'plan_products' like '%Index Cond:%score_rank <= 5550%',
  '3a página de produtos usa o índice com score_rank <= cursor como condição de índice'
);
select pg_temp.plan_of(format(
  'select id from public.content_items where organization_id = %L and updated_at <= now() '
  'and (updated_at < now() or (updated_at = now() and id < %L)) order by updated_at desc, id desc limit 51',
  :'org_a', gen_random_uuid())) as plan_content \gset
select tests.ok(
  :'plan_content' like '%content_items_org_updated_id_idx%' and :'plan_content' like '%Index Cond:%updated_at <=%',
  '3b página de conteúdos usa o índice com updated_at <= cursor como condição de índice'
);
select pg_temp.plan_of(format(
  'select id from public.media_assets where organization_id = %L and archived_at is null and created_at <= now() '
  'and (created_at < now() or (created_at = now() and id < %L)) order by created_at desc, id desc limit 51',
  :'org_a', gen_random_uuid())) as plan_media \gset
select tests.ok(
  :'plan_media' like '%media_assets_org_created_id_idx%' and :'plan_media' like '%Index Cond:%created_at <=%',
  '3c página de mídia usa o índice com created_at <= cursor como condição de índice'
);

-- 4. RLS intacta: o outro workspace continua invisível pela nova coluna/índice.
select tests.login(:'owner_b');
select tests.ok(
  (select count(*) = 0 from public.products where organization_id = :'org_a' and score_rank >= -1),
  '4a owner de B não lê produtos de A filtrando por score_rank'
);

rollback;
