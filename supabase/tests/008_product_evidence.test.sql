-- S9: produtos persistentes, evidências verificáveis e score baseado em evidência.
\set ON_ERROR_STOP 1
\set owner_a 'a9000000-0000-4000-8000-00000000000a'
\set analyst_a 'a9000000-0000-4000-8000-0000000000a2'
\set viewer_a 'a9000000-0000-4000-8000-0000000000a3'
\set owner_b 'b9000000-0000-4000-8000-00000000000b'
begin;

select tests.create_user(:'owner_a', 'owner-a9@smkon.test');
select tests.create_user(:'analyst_a', 'analyst-a9@smkon.test');
select tests.create_user(:'viewer_a', 'viewer-a9@smkon.test');
select tests.create_user(:'owner_b', 'owner-b9@smkon.test');
set local role authenticated;
select tests.login(:'owner_a');
select workspace_id as org_a from public.ensure_workspace() \gset
select tests.login(:'owner_b');
select workspace_id as org_b from public.ensure_workspace() \gset
reset role;
insert into public.organization_members (organization_id, user_id, role) values
  (:'org_a', :'analyst_a', 'analyst'), (:'org_a', :'viewer_a', 'viewer');

-- 1. Produto: autoria e score não são do cliente
set local role authenticated;
select tests.login(:'owner_a');
insert into public.products (organization_id, name, source, type, revenue_domain)
values (:'org_a', 'Curso X', 'hotmart', 'info', 'affiliate')
returning id as prod_a \gset
select tests.ok(
  (select created_by = :'owner_a'::uuid and score is null and score_reasons = '[]'::jsonb from public.products where id = :'prod_a'),
  '1a produto nasce sem score e com autoria do usuário'
);
select tests.throws(
  format('update public.products set score = 99 where id = %L', :'prod_a'),
  '42501', '1b cliente não escreve score'
);
select tests.throws(
  format('insert into public.products (organization_id, name, source, score) values (%L, ''Y'', ''manual'', 90)', :'org_a'),
  '42501', '1c cliente não define score na criação'
);
select tests.throws(
  format('update public.products set organization_id = %L where id = %L', :'org_b', :'prod_a'),
  '42501', '1d produto não muda de workspace'
);
select tests.login(:'analyst_a');
select tests.throws(
  format('insert into public.products (organization_id, name, source) values (%L, ''Z'', ''manual'')', :'org_a'),
  'row-level security', '1e analista não cria produto'
);

-- 2. Evidências: validação
select tests.login(:'owner_a');
select tests.throws(
  format('insert into public.product_evidence (organization_id, product_id, kind, claim, source_url) values (%L, %L, ''sales_page'', ''Página ativa'', ''http://exemplo.com'')', :'org_a', :'prod_a'),
  'product_evidence_source_url_check', '2a fonte precisa ser https'
);
select tests.throws(
  format('insert into public.product_evidence (organization_id, product_id, kind, claim, source_url) values (%L, %L, ''commission'', ''Comissão alta'', ''https://hotmart.com/p'')', :'org_a', :'prod_a'),
  'product_evidence_value_by_kind', '2b comissão exige valor'
);
select tests.throws(
  format('insert into public.product_evidence (organization_id, product_id, kind, claim, source_url, value) values (%L, %L, ''rating'', ''Nota'', ''https://hotmart.com/p'', 7)', :'org_a', :'prod_a'),
  'product_evidence_value_by_kind', '2c avaliação vai de 0 a 5'
);
select tests.throws(
  format('insert into public.product_evidence (organization_id, product_id, kind, claim, source_url, observed_at) values (%L, %L, ''sales_page'', ''Página'', ''https://hotmart.com/p'', now() + interval ''1 day'')', :'org_a', :'prod_a'),
  'evidence_in_future', '2d observação não pode estar no futuro'
);
select tests.throws(
  format('insert into public.product_evidence (organization_id, product_id, kind, claim, source_url) values (%L, %L, ''sales_page'', ''Página'', ''https://hotmart.com/p'')', :'org_b', :'prod_a'),
  'row-level security', '2e evidência não aponta produto de outro workspace'
);

-- 3. Analista coleta; entra pendente e com autoria forçada
select tests.login(:'analyst_a');
insert into public.product_evidence (organization_id, product_id, kind, claim, source_url)
values (:'org_a', :'prod_a', 'sales_page', 'Página de vendas ativa', 'https://hotmart.com/produto/x')
returning id as ev_page \gset
insert into public.product_evidence (organization_id, product_id, kind, claim, source_url, value)
values (:'org_a', :'prod_a', 'commission', 'Comissão de 40% na página do afiliado', 'https://hotmart.com/afiliado/x', 40)
returning id as ev_comm \gset
insert into public.product_evidence (organization_id, product_id, kind, claim, source_url, value)
values (:'org_a', :'prod_a', 'price', 'Preço de R$ 197', 'https://hotmart.com/produto/x', 197)
returning id as ev_price \gset
insert into public.product_evidence (organization_id, product_id, kind, claim, source_url, value)
values (:'org_a', :'prod_a', 'rating', 'Nota 4,5 no marketplace', 'https://hotmart.com/produto/x#avaliacoes', 4.5)
returning id as ev_rating \gset
insert into public.product_evidence (organization_id, product_id, kind, claim, source_url, observed_at)
values (:'org_a', :'prod_a', 'demand_signal', 'Busca antiga', 'https://trends.google.com/x', now() - interval '200 days')
returning id as ev_old \gset
select tests.ok(
  (select bool_and(review_status = 'pending' and captured_by = :'analyst_a'::uuid) from public.product_evidence where product_id = :'prod_a'),
  '3a evidências entram pendentes com autoria real'
);
select tests.throws(
  format('select * from public.review_product_evidence(%L, ''verified'')', :'ev_page'),
  'forbidden', '3b analista não revisa'
);
select tests.login(:'viewer_a');
select tests.throws(
  format('insert into public.product_evidence (organization_id, product_id, kind, claim, source_url) values (%L, %L, ''other'', ''Nota'', ''https://a.com/x'')', :'org_a', :'prod_a'),
  'row-level security', '3c viewer não adiciona evidência'
);
select tests.ok((select count(*) from public.product_evidence where product_id = :'prod_a') = 5, '3d viewer lê as evidências do workspace');

-- 4. Imutabilidade
select tests.login(:'owner_a');
select tests.throws(format('update public.product_evidence set claim = ''outra'' where id = %L', :'ev_page'), '42501', '4a cliente não edita evidência');
select tests.throws(format('update public.product_evidence set review_status = ''verified'' where id = %L', :'ev_page'), '42501', '4b cliente não se autoverifica');
select tests.throws(format('delete from public.product_evidence where id = %L', :'ev_page'), '42501', '4c cliente não apaga evidência');
reset role;
select tests.throws(format('update public.product_evidence set claim = ''outra'' where id = %L', :'ev_page'), 'evidence_immutable', '4d nem o dono do banco altera o conteúdo');
select tests.throws(format('delete from public.product_evidence where id = %L', :'ev_page'), 'evidence_immutable', '4e nem o dono do banco apaga');
set local role authenticated;

-- 5. Score depende só de evidência verificada
select tests.login(:'owner_a');
select tests.throws(format('select * from public.review_product_evidence(%L, ''aprovado'')', :'ev_comm'), 'invalid_decision', '5a decisão inválida');
select tests.throws(format('select * from public.review_product_evidence(%L, ''rejected'')', :'ev_comm'), 'review_note_required', '5b rejeição exige motivo');
select tests.ok(
  (select product_score is null from public.review_product_evidence(:'ev_comm', 'verified')),
  '5c sem página de venda verificada não há score'
);
select tests.ok(
  (select score_reasons->>0 like 'Sem página de venda verificada%' from public.products where id = :'prod_a'),
  '5d motivo explica a ausência de score'
);
select product_score as s2 from public.review_product_evidence(:'ev_page', 'verified', 'Conferido no navegador') \gset
select tests.ok(:s2 = 40, '5e página (+20) e comissão de 40% (+20) = 40');
select product_score as s3 from public.review_product_evidence(:'ev_price', 'verified') \gset
select tests.ok(:s3 = 50, '5f preço 197 na faixa (+10) = 50');
select product_score as s4 from public.review_product_evidence(:'ev_rating', 'rejected', 'Nota não aparece na página') \gset
select tests.ok(:s4 = 50, '5g evidência rejeitada não conta');
select product_score as s5 from public.review_product_evidence(:'ev_old', 'verified') \gset
select tests.ok(:s5 = 50, '5h evidência com mais de 180 dias não conta');
select tests.ok(
  (select score_reasons @> '["1 evidência(s) verificada(s) com mais de 180 dias não contam."]'::jsonb from public.products where id = :'prod_a'),
  '5i motivo registra a evidência antiga descartada'
);
select tests.throws(format('select * from public.review_product_evidence(%L, ''rejected'', ''x'')', :'ev_page'), 'evidence_already_reviewed', '5j revisão acontece uma vez');
select tests.ok(
  (select reviewed_by = :'owner_a'::uuid and reviewed_at is not null and review_note = 'Conferido no navegador' from public.product_evidence where id = :'ev_page'),
  '5k revisão registra quem, quando e o motivo'
);

-- 6. Isolamento entre workspaces
select tests.login(:'owner_b');
select tests.ok((select count(*) from public.product_evidence where product_id = :'prod_a') = 0, '6a outro workspace não vê evidências');
select tests.ok((select count(*) from public.products where id = :'prod_a') = 0, '6b outro workspace não vê o produto');
select tests.throws(format('select * from public.review_product_evidence(%L, ''verified'')', :'ev_old'), 'evidence_not_found', '6c outro workspace não revisa');

-- 7. Produto com evidência não é apagado (arquivar em vez disso)
select tests.login(:'owner_a');
select tests.throws(format('delete from public.products where id = %L', :'prod_a'), '23503', '7a produto com evidência não é apagado');
update public.products set status = 'archived' where id = :'prod_a';
select tests.ok((select status = 'archived' from public.products where id = :'prod_a'), '7b produto pode ser arquivado');

-- 8. Auditoria e funções internas
reset role;
select tests.ok(
  (select count(*) from public.audit_log where table_name = 'product_evidence' and record_id = :'ev_page') = 2,
  '8a inserção e revisão da evidência ficam no audit_log'
);
select tests.ok(
  not has_function_privilege('authenticated', 'public.product_recompute_score(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.product_evidence_score(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.review_product_evidence(uuid, text, text)', 'execute'),
  '8b funções internas fechadas; revisão só para autenticados'
);

rollback;
