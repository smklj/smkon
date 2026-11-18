-- S13: execuções de agentes (Planner → Executor → Verifier), limites, kill switch e allowlist.
\set ON_ERROR_STOP 1
\set owner_a 'a1300000-0000-4000-8000-00000000000a'
\set admin_a 'a1300000-0000-4000-8000-0000000000a1'
\set viewer_a 'a1300000-0000-4000-8000-0000000000a2'
\set owner_b 'b1300000-0000-4000-8000-00000000000b'
begin;

select tests.create_user(:'owner_a', 'owner-a13@smkon.test');
select tests.create_user(:'admin_a', 'admin-a13@smkon.test');
select tests.create_user(:'viewer_a', 'viewer-a13@smkon.test');
select tests.create_user(:'owner_b', 'owner-b13@smkon.test');
set local role authenticated;
select tests.login(:'owner_a');
select workspace_id as org_a from public.ensure_workspace() \gset
select tests.login(:'owner_b');
select workspace_id as org_b from public.ensure_workspace() \gset
reset role;
insert into public.organization_members (organization_id, user_id, role) values
  (:'org_a', :'admin_a', 'admin'), (:'org_a', :'viewer_a', 'viewer');

-- 1. Catálogo: só leitura e rascunho; nenhuma ferramenta de publicação
set local role authenticated;
select tests.login(:'viewer_a');
select tests.ok((select count(*) from public.agent_tool_catalog()) = 6, '1a catálogo tem 6 ferramentas');
select tests.ok(
  (select bool_and(kind in ('read', 'draft')) and not bool_or(tool ilike '%publish%' or tool ilike '%approve%') from public.agent_tool_catalog()),
  '1b nenhuma ferramenta publica ou aprova'
);

-- 2. Iniciar execução: papéis e validação
select tests.throws(format('select public.agent_start_run(%L, ''operations_review'', ''Revisar pendências'')', :'org_a'), 'forbidden', '2a viewer não inicia');
select tests.login(:'owner_b');
select tests.throws(format('select public.agent_start_run(%L, ''operations_review'', ''Revisar pendências'')', :'org_a'), 'forbidden', '2b outro workspace não inicia');
select tests.login(:'admin_a');
select tests.throws(format('select public.agent_start_run(%L, ''publisher'', ''Publicar tudo'')', :'org_a'), 'invalid_agent', '2c agente fora da lista');
select tests.throws(format('select public.agent_start_run(%L, ''operations_review'', ''x'')', :'org_a'), 'invalid_goal', '2d objetivo curto');
select tests.throws(format('select public.agent_start_run(%L, ''operations_review'', ''Revisar'', 99)', :'org_a'), 'invalid_max_steps', '2e passos acima do limite do workspace');
select public.agent_start_run(:'org_a', 'operations_review', 'Revisar pendências da semana', 5) as run1 \gset
select tests.ok(
  (select status = 'queued' and max_steps = 5 and step_count = 0 and created_by = :'admin_a'::uuid from public.agent_runs where id = :'run1'),
  '2f execução nasce na fila com autor e limite'
);
select tests.ok((select count(*) = 1 from public.agent_settings where organization_id = :'org_a'), '2g configuração criada com padrões');

-- 3. Ninguém escreve direto nas tabelas
select tests.throws(format('update public.agent_runs set status = ''succeeded'' where id = %L', :'run1'), '42501', '3a update direto bloqueado');
select tests.throws(format('insert into public.agent_steps (organization_id, run_id, seq, phase, status) values (%L, %L, 1, ''plan'', ''ok'')', :'org_a', :'run1'), '42501', '3b insert de passo bloqueado');
select tests.throws(format('delete from public.agent_runs where id = %L', :'run1'), '42501', '3c delete bloqueado');
select tests.throws(format('select public.agent_record_step(%L, ''plan'', null, ''{}'', ''{}'', ''ok'')', :'run1'), '42501', '3d usuário não registra passos');
select tests.throws(format('select public.agent_finish_run(%L, ''{}'')', :'run1'), '42501', '3e usuário não encerra com sucesso');
reset role;
set local role service_role;
select tests.throws(format('update public.agent_runs set status = ''succeeded'' where id = %L', :'run1'), '42501', '3f nem service_role altera direto');
reset role;

-- 4. Ordem Planner → Executor → Verifier (executor do servidor)
set local role service_role;
select tests.throws(format('select public.agent_record_step(%L, ''execute'', ''read_content'', ''{}'', ''{}'', ''ok'')', :'run1'), 'invalid_phase_order', '4a não executa antes de planejar');
select tests.throws(format('select public.agent_record_step(%L, ''verify'', null, ''{}'', ''{}'', ''ok'')', :'run1'), 'invalid_phase_order', '4b não verifica antes de executar');
select tests.throws(format('select public.agent_record_step(%L, ''plan'', ''read_content'', ''{}'', ''{}'', ''ok'')', :'run1'), 'invalid_phase', '4c plano não usa ferramenta');
select tests.throws(format('select public.agent_record_step(%L, ''plan'', null, ''{}'', ''{}'', ''rejected'')', :'run1'), 'invalid_step_status', '4d executor não marca rejected por conta própria');
select step_seq as s1, run_status as rs1 from public.agent_record_step(:'run1', 'plan', null, '{"steps":["ler conteúdo"]}', '{}', 'ok') \gset
select tests.ok(:s1 = 1 and :'rs1' = 'planning', '4e plano registrado');
select tests.ok((select started_at is not null from public.agent_runs where id = :'run1'), '4f início marcado no primeiro passo');

-- 5. Allowlist: ferramenta não liberada vira passo rejeitado, sem saída
select step_seq as s2 from public.agent_record_step(:'run1', 'execute', 'read_content', '{}', '{"items":3}', 'ok') \gset
select tests.ok(
  (select status = 'rejected' and detail = 'tool_not_allowed' and output = '{}'::jsonb from public.agent_steps where run_id = :'run1' and seq = :s2),
  '5a ferramenta não liberada é rejeitada e não guarda saída'
);
select step_seq as s3 from public.agent_record_step(:'run1', 'execute', 'publish_content', '{}', '{}', 'ok') \gset
select tests.ok(
  (select status = 'rejected' from public.agent_steps where run_id = :'run1' and seq = :s3),
  '5b ferramenta inexistente (publish_content) é rejeitada'
);
reset role;
set local role authenticated;
select tests.login(:'viewer_a');
select tests.throws(format('select public.agent_set_tool(%L, ''read_content'', true)', :'org_a'), 'forbidden', '5c viewer não libera ferramenta');
select tests.login(:'admin_a');
select tests.throws(format('select public.agent_set_tool(%L, ''publish_content'', true)', :'org_a'), 'unknown_tool', '5d não existe liberar publicação');
select public.agent_set_tool(:'org_a', 'read_content', true);
select public.agent_set_tool(:'org_a', 'read_content', true);
select tests.ok((select count(*) = 1 from public.agent_tool_grants where organization_id = :'org_a'), '5e liberar é idempotente');
reset role;
set local role service_role;
select step_seq as s4 from public.agent_record_step(:'run1', 'execute', 'read_content', '{}', '{"items":3}', 'ok') \gset
select tests.ok(
  (select status = 'ok' and output = '{"items":3}'::jsonb from public.agent_steps where run_id = :'run1' and seq = :s4),
  '5f ferramenta liberada executa'
);

-- 6. Sucesso exige verificação aprovada como último passo
select tests.throws(format('select public.agent_finish_run(%L, ''{}'')', :'run1'), 'verification_required', '6a sem verificação não conclui');
select step_seq as s5, run_status as rs5 from public.agent_record_step(:'run1', 'verify', null, '{}', '{"ok":true}', 'ok') \gset
select tests.ok(:'rs5' = 'verifying', '6b verificação registrada');
select public.agent_finish_run(:'run1', '{"summary":"3 itens revisados"}');
select tests.ok(
  (select status = 'succeeded' and finished_at is not null and step_count = 5 and outcome ->> 'summary' = '3 itens revisados' from public.agent_runs where id = :'run1'),
  '6c execução concluída com resultado'
);
select tests.throws(format('select public.agent_record_step(%L, ''plan'', null, ''{}'', ''{}'', ''ok'')', :'run1'), 'run_not_active', '6d concluída não aceita passos');
select tests.ok(
  (select array_agg(phase order by seq) = array['plan','execute','execute','execute','verify'] from public.agent_steps where run_id = :'run1'),
  '6e trilha completa e ordenada'
);
select tests.throws(format('update public.agent_steps set status = ''ok'' where run_id = %L', :'run1'), '42501', '6f passos imutáveis');
reset role;

-- 7. Verificação reprovada volta a executar; limite de passos encerra
set local role authenticated;
select tests.login(:'owner_a');
select public.agent_start_run(:'org_a', 'content_drafting', 'Rascunho sobre o produto X', 3) as run2 \gset
reset role;
set local role service_role;
select public.agent_record_step(:'run2', 'plan', null, '{}', '{}', 'ok');
select public.agent_record_step(:'run2', 'execute', 'read_content', '{}', '{}', 'ok');
select public.agent_record_step(:'run2', 'verify', null, '{}', '{"ok":false}', 'error');
select tests.throws(format('select public.agent_finish_run(%L, ''{}'')', :'run2'), 'verification_required', '7a verificação reprovada não conclui');
select coalesce(step_seq::text, 'none') as s_over, run_status as rs_over from public.agent_record_step(:'run2', 'execute', 'read_content', '{}', '{}', 'ok') \gset
select tests.ok(:'rs_over' = 'failed' and :'s_over' = 'none', '7b passo além do limite encerra como failed sem registrar');
select tests.ok(
  (select status = 'failed' and error_code = 'step_limit' and step_count = 3 from public.agent_runs where id = :'run2'),
  '7c motivo step_limit'
);
select tests.throws(format('select public.agent_record_step(%L, ''payload'', null, ''{}'', ''{}'', ''ok'')', :'run2'), 'run_not_active', '7d encerrada não aceita passos');
reset role;

-- 8. Falha explícita, cancelamento e payload grande
set local role authenticated;
select tests.login(:'owner_a');
select public.agent_start_run(:'org_a', 'product_research', 'Pesquisar concorrentes', 5) as run3 \gset
select public.agent_start_run(:'org_a', 'product_research', 'Pesquisar preços', 5) as run4 \gset
reset role;
set local role service_role;
select tests.throws(
  format('select public.agent_record_step(%L, ''plan'', null, %L, ''{}'', ''ok'')', :'run3', jsonb_build_object('blob', repeat('x', 70000))),
  'payload_too_large', '8a entrada acima de 64 KB recusada'
);
select tests.throws(format('select public.agent_fail_run(%L, ''Erro Livre'')', :'run3'), 'invalid_error_code', '8b código de erro controlado');
select public.agent_fail_run(:'run3', 'provider_timeout');
select tests.ok((select status = 'failed' and error_code = 'provider_timeout' from public.agent_runs where id = :'run3'), '8c falha registrada');
reset role;
set local role authenticated;
select tests.login(:'viewer_a');
select tests.throws(format('select public.agent_cancel_run(%L, ''não quero'')', :'run4'), 'forbidden', '8d viewer não cancela');
select tests.login(:'admin_a');
select tests.throws(format('select public.agent_cancel_run(%L, ''x'')', :'run4'), 'cancel_reason_required', '8e motivo obrigatório');
select public.agent_cancel_run(:'run4', 'Objetivo mal definido');
select tests.ok(
  (select status = 'cancelled' and cancelled_by = :'admin_a'::uuid and finished_at is not null from public.agent_runs where id = :'run4'),
  '8f cancelada com autor'
);
select tests.throws(format('select public.agent_cancel_run(%L, ''de novo'')', :'run4'), 'run_not_active', '8g não cancela duas vezes');

-- 9. Kill switch: só owner; encerra ativas e bloqueia novas
select public.agent_start_run(:'org_a', 'operations_review', 'Execução que será interrompida', 5) as run5 \gset
select tests.throws(format('select public.agent_set_kill_switch(%L, true, ''incidente'')', :'org_a'), 'forbidden', '9a admin não aciona o kill switch');
select tests.login(:'owner_a');
select tests.throws(format('select public.agent_set_kill_switch(%L, true)', :'org_a'), 'kill_reason_required', '9b motivo obrigatório');
select public.agent_set_kill_switch(:'org_a', true, 'Incidente de custo') as killed \gset
select tests.ok(:killed = 1, '9c uma execução ativa encerrada');
select tests.ok((select status = 'killed' and error_code = 'kill_switch' from public.agent_runs where id = :'run5'), '9d execução marcada como killed');
select tests.throws(format('select public.agent_start_run(%L, ''operations_review'', ''Nova execução'')', :'org_a'), 'agents_killed', '9e nenhuma nova execução');
reset role;
set local role service_role;
select tests.throws(format('select public.agent_record_step(%L, ''plan'', null, ''{}'', ''{}'', ''ok'')', :'run5'), 'run_not_active', '9f executor não continua a execução interrompida');
reset role;
set local role authenticated;
select tests.login(:'owner_a');
select public.agent_set_kill_switch(:'org_a', false);
select tests.ok(
  (select not kill_switch and kill_reason is null and kill_changed_by = :'owner_a'::uuid from public.agent_settings where organization_id = :'org_a'),
  '9g desligado por owner, registrado'
);

-- 10. Limites: owner ajusta; limite diário bloqueia
select tests.login(:'admin_a');
select tests.throws(format('select public.agent_update_limits(%L, 10, 10)', :'org_a'), 'forbidden', '10a admin não altera limites');
select tests.login(:'owner_a');
select tests.throws(format('select public.agent_update_limits(%L, 0, 10)', :'org_a'), 'invalid_limits', '10b limites fora da faixa');
select public.agent_update_limits(:'org_a', 6, 10);
select public.agent_start_run(:'org_a', 'operations_review', 'Sexta execução do dia');
select tests.throws(format('select public.agent_start_run(%L, ''operations_review'', ''Sétima execução'')', :'org_a'), 'run_limit_reached', '10c limite diário respeitado');

-- 11. Isolamento e auditoria
select tests.login(:'owner_b');
select tests.ok((select count(*) = 0 from public.agent_runs where organization_id = :'org_a'), '11a B não lê execuções de A');
select tests.ok((select count(*) = 0 from public.agent_steps where organization_id = :'org_a'), '11b B não lê passos de A');
select tests.login(:'viewer_a');
select tests.ok((select count(*) = 6 from public.agent_runs where organization_id = :'org_a'), '11c viewer lê as execuções do workspace');
reset role;
select tests.ok(
  (select count(*) > 0 from public.audit_log where table_name = 'agent_runs' and record_id = :'run5')
  and (select count(*) > 0 from public.audit_log where table_name = 'agent_settings')
  and (select count(*) > 0 from public.audit_log where table_name = 'agent_tool_grants'),
  '11d mudanças vão para o audit_log'
);
set local role anon;
select tests.throws(format('select public.agent_start_run(%L, ''operations_review'', ''Anônimo'')', :'org_a'), '42501', '11e anon sem execução');
reset role;
select tests.ok(
  not has_function_privilege('authenticated', 'public.agent_settings_for(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.agent_member_role(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.agent_require_role(uuid, text[])', 'execute'),
  '11f funções internas fechadas'
);

rollback;
