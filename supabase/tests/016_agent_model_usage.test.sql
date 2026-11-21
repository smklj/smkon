-- S14 etapa 7: consumo do modelo de IA (registro só do executor, leitura por membros, teto do ambiente).
\set ON_ERROR_STOP 1
\set owner_a 'a1600000-0000-4000-8000-00000000000a'
\set viewer_a 'a1600000-0000-4000-8000-0000000000a2'
\set owner_b 'b1600000-0000-4000-8000-00000000000b'
begin;

select tests.create_user(:'owner_a', 'owner-a16@smkon.test');
select tests.create_user(:'viewer_a', 'viewer-a16@smkon.test');
select tests.create_user(:'owner_b', 'owner-b16@smkon.test');
set local role authenticated;
select tests.login(:'owner_a');
select workspace_id as org_a from public.ensure_workspace() \gset
select public.agent_start_run(:'org_a', 'product_research', 'Execução com consumo do modelo', 6) as run_a \gset
select tests.login(:'owner_b');
select workspace_id as org_b from public.ensure_workspace() \gset
select public.agent_start_run(:'org_b', 'operations_review', 'Execução do workspace B', 6) as run_b \gset
reset role;
insert into public.organization_members (organization_id, user_id, role) values (:'org_a', :'viewer_a', 'viewer');

select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);
set local role service_role;
select tests.ok(public.agent_model_spend_since(now() - interval '1 day') = 0, '0a sem consumo: gasto zero');
reset role;

-- 1. Só o executor do servidor registra ou consulta o gasto total
set local role authenticated;
select tests.login(:'owner_a');
select tests.throws(format('select public.agent_record_model_usage(%L, ''plan'', ''anthropic/claude-haiku-5.5'', 10, 10, 0.01)', :'run_a'), '42501', '1a usuário não registra consumo');
select tests.throws('select public.agent_model_spend_since(now())', '42501', '1b usuário não lê o gasto do ambiente');
select tests.throws(format('insert into public.agent_model_usage (run_id, organization_id, phase, model, input_tokens, output_tokens, cost_usd) values (%L, %L, ''plan'', ''a/b'', 1, 1, 0)', :'run_a', :'org_a'), '42501', '1c usuário não insere direto');
reset role;
set local role anon;
select tests.throws(format('select public.agent_record_model_usage(%L, ''plan'', ''anthropic/claude-haiku-5.5'', 10, 10, 0.01)', :'run_a'), '42501', '1d anon não registra consumo');
reset role;

-- 2. Registro válido: workspace vem da execução; custo arredondado a 6 casas
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);
set local role service_role;
select public.agent_record_model_usage(:'run_a', 'plan', 'anthropic/claude-haiku-5.5', 4200, 350, 0.0006059);
select public.agent_record_model_usage(:'run_a', 'verify', 'anthropic/claude-haiku-5.5', 9000, 800, 0.0013);
select public.agent_record_model_usage(:'run_b', 'plan', 'anthropic/claude-haiku-5.5', 1000, 100, 0.25);
reset role;
select tests.ok((select count(*) = 2 and bool_and(organization_id = :'org_a') from public.agent_model_usage where run_id = :'run_a'), '2a consumo vinculado ao workspace da execução');
select tests.ok((select cost_usd = 0.000606 from public.agent_model_usage where run_id = :'run_a' and phase = 'plan'), '2b custo arredondado a 6 casas');
set local role service_role;
select tests.ok(public.agent_model_spend_since(now() - interval '1 day') = 0.251906, '2c gasto do ambiente soma todos os workspaces');
select tests.ok(public.agent_model_spend_since(now() + interval '1 second') = 0, '2d gasto desde depois do registro: zero');
reset role;

-- 3. Entrada inválida
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);
set local role service_role;
select tests.throws('select public.agent_record_model_usage(''00000000-0000-4000-8000-000000000000'', ''plan'', ''a/b'', 1, 1, 0)', 'agent_run_not_found', '3a execução inexistente');
select tests.throws(format('select public.agent_record_model_usage(%L, ''execute'', ''a/b'', 1, 1, 0)', :'run_a'), 'invalid_phase', '3b fase fora de plan/verify');
select tests.throws(format('select public.agent_record_model_usage(%L, ''plan'', ''sem-provedor'', 1, 1, 0)', :'run_a'), 'invalid_model', '3c modelo sem provedor/modelo');
select tests.throws(format('select public.agent_record_model_usage(%L, ''plan'', ''a/b'', -1, 1, 0)', :'run_a'), 'invalid_usage', '3d tokens negativos');
select tests.throws(format('select public.agent_record_model_usage(%L, ''plan'', ''a/b'', 1, 1, -0.01)', :'run_a'), 'invalid_usage', '3e custo negativo');
select tests.throws(format('select public.agent_record_model_usage(%L, ''plan'', ''a/b'', 1, 1, null)', :'run_a'), 'invalid_usage', '3f custo nulo');
reset role;

-- 4. Execução encerrada ainda registra (o gasto aconteceu)
set local role authenticated;
select tests.login(:'owner_a');
select public.agent_cancel_run(:'run_a', 'Cancelada durante a chamada');
reset role;
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);
set local role service_role;
select public.agent_record_model_usage(:'run_a', 'verify', 'anthropic/claude-haiku-5.5', 10, 10, 0.000002);
reset role;
select tests.ok((select count(*) = 3 from public.agent_model_usage where run_id = :'run_a'), '4a consumo de execução cancelada é registrado');

-- 5. Leitura por membros, isolada por workspace
set local role authenticated;
select tests.login(:'viewer_a');
select tests.ok((select count(*) = 3 from public.agent_model_usage), '5a viewer do workspace A vê só o consumo de A');
select tests.login(:'owner_b');
select tests.ok((select count(*) = 1 and bool_and(organization_id = :'org_b') from public.agent_model_usage), '5b workspace B não vê o consumo de A');
reset role;

-- 6. Registro imutável: nem o service_role altera ou apaga
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);
set local role service_role;
select tests.throws(format('update public.agent_model_usage set cost_usd = 0 where run_id = %L', :'run_a'), '42501', '6a service_role não altera consumo');
select tests.throws(format('delete from public.agent_model_usage where run_id = %L', :'run_a'), '42501', '6b service_role não apaga consumo');
reset role;
select tests.throws(format('update public.agent_model_usage set cost_usd = 0 where run_id = %L', :'run_a'), 'usage_immutable', '6c nem o dono do banco altera');
select tests.throws(format('delete from public.agent_model_usage where run_id = %L', :'run_a'), 'usage_immutable', '6d nem o dono do banco apaga direto');


rollback;
