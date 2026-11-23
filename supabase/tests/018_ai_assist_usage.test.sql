-- 22/11: IA assistiva — registro de consumo, gasto por workspace e limite de chamadas.
\set ON_ERROR_STOP 1
\set owner_a 'a8000000-0000-4000-8000-00000000000a'
\set analyst_a 'a8000000-0000-4000-8000-0000000000a2'
\set viewer_a 'a8000000-0000-4000-8000-0000000000a3'
\set owner_b 'b8000000-0000-4000-8000-00000000000b'
begin;

select tests.create_user(:'owner_a', 'owner-a8@smkon.test');
select tests.create_user(:'analyst_a', 'analyst-a8@smkon.test');
select tests.create_user(:'viewer_a', 'viewer-a8@smkon.test');
select tests.create_user(:'owner_b', 'owner-b8@smkon.test');

set local role authenticated;
select tests.login(:'owner_a');
select workspace_id as org_a from public.ensure_workspace() \gset
select tests.login(:'owner_b');
select workspace_id as org_b from public.ensure_workspace() \gset
reset role;
insert into public.organization_members (organization_id, user_id, role) values
  (:'org_a', :'analyst_a', 'analyst'),
  (:'org_a', :'viewer_a', 'viewer');

-- 1. Permissões
select tests.ok(not has_function_privilege('anon', 'public.ai_assist_record_usage(uuid, text, text, integer, integer, numeric)', 'execute'), '1a anon não registra consumo');
select tests.ok(not has_function_privilege('anon', 'public.ai_assist_spend_since(uuid, timestamptz)', 'execute'), '1b anon não lê gasto');
select tests.ok(has_function_privilege('authenticated', 'public.ai_assist_record_usage(uuid, text, text, integer, integer, numeric)', 'execute'), '1c authenticated registra (com checagem de papel)');

-- 2. Registro com a sessão do usuário
set local role authenticated;
select tests.login(:'owner_a');
select public.ai_assist_record_usage(:'org_a', 'studio_write', 'google/gemini-3.8-flash', 1200, 800, 0.0081);
select tests.login(:'analyst_a');
select public.ai_assist_record_usage(:'org_a', 'compliance_review', 'google/gemini-3.8-flash', 900, 300, 0.0040);
select tests.ok((select count(*) = 2 from public.ai_assist_usage where organization_id = :'org_a'), '2a owner e analyst registram');
select tests.ok((select user_id = :'analyst_a'::uuid from public.ai_assist_usage where feature = 'compliance_review'), '2b autoria vem da sessão');

select tests.login(:'viewer_a');
select tests.throws(format('select public.ai_assist_record_usage(%L, %L, %L, 1, 1, 0.1)', :'org_a', 'studio_write', 'google/gemini-3.8-flash'), 'forbidden', '2c viewer não usa a IA');
select tests.login(:'owner_b');
select tests.throws(format('select public.ai_assist_record_usage(%L, %L, %L, 1, 1, 0.1)', :'org_a', 'studio_write', 'google/gemini-3.8-flash'), 'forbidden', '2d outro workspace não registra em A');
select tests.login(:'owner_a');
select tests.throws(format('select public.ai_assist_record_usage(%L, %L, %L, 1, 1, 0.1)', :'org_a', 'qualquer', 'google/gemini-3.8-flash'), 'invalid_feature', '2e recurso fora da lista é recusado');
select tests.throws(format('select public.ai_assist_record_usage(%L, %L, %L, 1, 1, 0.1)', :'org_a', 'studio_write', 'Modelo Errado'), 'invalid_model', '2f modelo fora do formato é recusado');
select tests.throws(format('select public.ai_assist_record_usage(%L, %L, %L, 1, 1, 5000)', :'org_a', 'studio_write', 'google/gemini-3.8-flash'), 'invalid_usage', '2g custo fora da faixa é recusado');

-- 3. Gasto do workspace soma assistente; outro workspace não enxerga
select tests.ok(public.ai_assist_spend_since(:'org_a', now() - interval '1 day') = 0.0121, '3a gasto soma as chamadas do workspace');
select tests.throws(format('select public.ai_assist_spend_since(%L, now())', :'org_b'), 'forbidden', '3b não lê gasto de outro workspace');
select tests.login(:'owner_b');
select tests.ok(public.ai_assist_spend_since(:'org_b', now() - interval '1 day') = 0, '3c workspace B começa zerado');
select tests.ok((select count(*) = 0 from public.ai_assist_usage where organization_id = :'org_a'), '3d RLS: B não lê o consumo de A');

-- 4. Registro imutável
select tests.login(:'owner_a');
select tests.throws('update public.ai_assist_usage set cost_usd = 0', '42501', '4a cliente não altera consumo');
select tests.throws('delete from public.ai_assist_usage', '42501', '4b cliente não apaga consumo');
reset role;
select tests.throws('update public.ai_assist_usage set cost_usd = 0', 'usage_immutable', '4c nem o dono do banco altera consumo');

-- 5. Limite de chamadas do assistente: 60 por hora por usuário
set local role authenticated;
select tests.login(:'analyst_a');
select tests.ok(
  (select bool_and(allowed) from generate_series(1, 60) g, lateral public.rate_limit_consume('ai_assist', case when g > 0 then null end)),
  '5a 60 chamadas por hora passam'
);
select tests.ok(not (select allowed from public.rate_limit_consume('ai_assist', null)), '5b a 61ª é bloqueada');
select tests.login(:'owner_a');
select tests.ok((select allowed from public.rate_limit_consume('ai_assist', null)), '5c outro usuário tem a própria cota');
reset role;

rollback;
