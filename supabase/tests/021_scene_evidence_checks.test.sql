-- F3 (021): campos do design ligados ao produto passam pelo verificador da fila.
\set ON_ERROR_STOP 1
\set owner_a 'ae000000-0000-4000-8000-00000000000a'
\set owner_b 'be000000-0000-4000-8000-00000000000b'
begin;

select tests.create_user(:'owner_a', 'owner-a21@smkon.test');
select tests.create_user(:'owner_b', 'owner-b21@smkon.test');
set local role authenticated;
select tests.login(:'owner_a');
select workspace_id as org_a from public.ensure_workspace() \gset
insert into public.products (organization_id, name, source, type, revenue_domain)
values (:'org_a', 'Fone X1', 'amazon', 'physical', 'affiliate') returning id as prod \gset
insert into public.product_evidence (organization_id, product_id, kind, claim, source_url, value, observed_at)
values (:'org_a', :'prod', 'price', 'Preço na página', 'https://loja.com.br/x1', 199.9, now() - interval '1 day') returning id as price_ok \gset
insert into public.product_evidence (organization_id, product_id, kind, claim, source_url, value, observed_at)
values (:'org_a', :'prod', 'price', 'Preço antigo', 'https://loja.com.br/x1', 249.9, now() - interval '20 days') returning id as price_old \gset
insert into public.product_evidence (organization_id, product_id, kind, claim, source_url, value)
values (:'org_a', :'prod', 'price', 'Preço não revisado', 'https://loja.com.br/x1', 99) returning id as price_pending \gset
select product_score from public.review_product_evidence(:'price_ok', 'verified') \gset
select product_score from public.review_product_evidence(:'price_old', 'verified') \gset
select tests.login(:'owner_b');
select workspace_id as org_b from public.ensure_workspace() \gset
insert into public.products (organization_id, name, source, type, revenue_domain)
values (:'org_b', 'Produto alheio', 'manual', 'physical', 'affiliate') returning id as prod_b \gset
reset role;

insert into public.content_items (organization_id, created_by, title, caption, channels)
values (:'org_a', :'owner_a', 'Oferta', 'Legenda', array['Instagram'])
returning id as item \gset

create temp table job_f3 on commit drop as select * from public.publication_jobs where false;
insert into job_f3 (id, organization_id, content_item_id, content_version, content_hash, channel, scheduled_for, created_by)
values (gen_random_uuid(), :'org_a', :'item', 1, repeat('a', 64), 'Instagram', now() + interval '2 days', :'owner_a');

create temp view f3_checks as
select c from job_f3 j, jsonb_array_elements(public.publication_checks(jsonb_populate_record(null::public.publication_jobs, to_jsonb(j)))) c;

create temp table f3_scene (field text, product_id text, evidence_id text, label text, txt text) on commit drop;

-- Monta o design com as camadas da tabela f3_scene (+ um texto livre).
create or replace function pg_temp.apply_scene(p_item uuid) returns void language sql as $fn$
  update public.content_items set scene = jsonb_build_object(
    'schema', 1, 'kind', 'image', 'width', 1080, 'height', 1080,
    'pages', jsonb_build_array(jsonb_build_object('id', 'p', 'layers',
      coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', 'l' || row_number, 'name', label, 'type', 'text', 'text', txt, 'font', 'body', 'size', 20, 'color', '#FFFFFF', 'x', 0, 'y', 0,
        'bind', case when field is null then null else jsonb_strip_nulls(jsonb_build_object('field', field, 'productId', product_id, 'evidenceId', evidence_id)) end)))
        from (select *, row_number() over () from f3_scene) s), '[]'::jsonb))))
  where id = p_item;
$fn$;

-- 1. Sem dados de produto: ok, e as checagens anteriores seguem lá
select pg_temp.apply_scene(:'item');
select tests.ok((select (c ->> 'ok')::boolean and c ->> 'detail' like '%não usa dados de produto%' from f3_checks where c ->> 'check' = 'scene_evidence'), '1a sem vínculo, nada a conferir');
select tests.ok((select count(*) = 1 from f3_checks where c ->> 'check' = 'scene_media'), '1b scene_media preservada');
select tests.ok(
  (select jsonb_array_length(public.publication_checks(jsonb_populate_record(null::public.publication_jobs, to_jsonb(j))))
        = jsonb_array_length(public.publication_checks_base(jsonb_populate_record(null::public.publication_jobs, to_jsonb(j)))) + 3 from job_f3 j),
  '1c base + scene_media + scene_evidence + scene_price_text'
);

-- 2. Preço verificado e recente: ok
insert into f3_scene values
  ('product.name', :'prod', null, 'Nome', 'Fone X1'),
  ('price.value', :'prod', :'price_ok', 'Preço', 'R$ 199,90'),
  ('price.source', :'prod', :'price_ok', 'Fonte', 'Preço em loja.com.br');
select pg_temp.apply_scene(:'item');
select tests.ok((select (c ->> 'ok')::boolean from f3_checks where c ->> 'check' = 'scene_evidence'), '2a preço verificado de ontem passa');
select tests.ok((select (c ->> 'ok')::boolean from f3_checks where c ->> 'check' = 'scene_price_text'), '2b preço ligado não gera aviso');

-- 3. Preço velho (20 dias): erro bloqueante
update f3_scene set evidence_id = :'price_old' where field like 'price.%';
select pg_temp.apply_scene(:'item');
select tests.ok(
  (select not (c ->> 'ok')::boolean and c ->> 'severity' = 'error' and c ->> 'detail' like '%mais de 7 dias antes da publicação%' from f3_checks where c ->> 'check' = 'scene_evidence'),
  '3a preço com mais de 7 dias bloqueia'
);

-- 4. Evidência pendente, inexistente ou de outro produto: erro
update f3_scene set evidence_id = :'price_pending' where field like 'price.%';
select pg_temp.apply_scene(:'item');
select tests.ok((select c ->> 'detail' like '%não está verificada%' from f3_checks where c ->> 'check' = 'scene_evidence'), '4a pendente bloqueia');
update f3_scene set evidence_id = gen_random_uuid()::text where field like 'price.%';
select pg_temp.apply_scene(:'item');
select tests.ok((select c ->> 'detail' like '%não encontrada%' from f3_checks where c ->> 'check' = 'scene_evidence'), '4b inexistente bloqueia');
update f3_scene set evidence_id = :'price_ok', product_id = :'prod_b' where field like 'price.%';
select pg_temp.apply_scene(:'item');
select tests.ok((select not (c ->> 'ok')::boolean from f3_checks where c ->> 'check' = 'scene_evidence'), '4c evidência de outro produto bloqueia');

-- 5. Produto de outro workspace: erro
delete from f3_scene;
insert into f3_scene values ('product.name', :'prod_b', null, 'Nome', 'Produto alheio');
select pg_temp.apply_scene(:'item');
select tests.ok((select c ->> 'detail' like '%fora do catálogo%' from f3_checks where c ->> 'check' = 'scene_evidence'), '5a produto alheio bloqueia');

-- 6. Preço digitado sem vínculo: só aviso
delete from f3_scene;
insert into f3_scene values (null, null, null, 'Etiqueta', 'ATÉ R$300'), (null, null, null, 'Título', 'Sem preço aqui');
select pg_temp.apply_scene(:'item');
select tests.ok(
  (select not (c ->> 'ok')::boolean and c ->> 'severity' = 'warning' and c ->> 'detail' like '%(Etiqueta)%' from f3_checks where c ->> 'check' = 'scene_price_text'),
  '6a preço digitado vira aviso com o nome da camada'
);
select tests.ok((select (c ->> 'ok')::boolean from f3_checks where c ->> 'check' = 'scene_evidence'), '6b sem vínculo, scene_evidence ok');

-- 7. Funções internas fora da API
select tests.ok(not has_function_privilege('authenticated', 'public.publication_scene_evidence_check(public.publication_jobs)', 'execute'), '7a evidência não é RPC');
select tests.ok(not has_function_privilege('authenticated', 'public.publication_scene_price_text_check(public.publication_jobs)', 'execute'), '7b preço digitado não é RPC');
select tests.ok(not has_function_privilege('authenticated', 'public.publication_checks(public.publication_jobs)', 'execute'), '7c publication_checks interna');

rollback;
