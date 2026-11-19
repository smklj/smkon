-- S14 etapa 5: reserva da fila (uma execução por chamada, uma ativa por workspace) e lease de execuções presas.
\set ON_ERROR_STOP 1
\set owner_a 'a1500000-0000-4000-8000-00000000000a'
\set admin_a 'a1500000-0000-4000-8000-0000000000a1'
\set owner_b 'b1500000-0000-4000-8000-00000000000b'
begin;

select tests.create_user(:'owner_a', 'owner-a15@smkon.test');
select tests.create_user(:'admin_a', 'admin-a15@smkon.test');
select tests.create_user(:'owner_b', 'owner-b15@smkon.test');
set local role authenticated;
select tests.login(:'owner_a');
select workspace_id as org_a from public.ensure_workspace() \gset
select tests.login(:'owner_b');
select workspace_id as org_b from public.ensure_workspace() \gset
reset role;
insert into public.organization_members (organization_id, user_id, role) values (:'org_a', :'admin_a', 'admin');

-- Fila isolada: este arquivo parte de nenhuma execução na fila.
select tests.ok((select count(*) = 0 from public.agent_runs where status = 'queued'), '0a fila vazia no início');

set local role authenticated;
select tests.login(:'admin_a');
select public.agent_set_tool(:'org_a', 'read_products', true);
select public.agent_set_tool(:'org_a', 'draft_content', true);
select public.agent_start_run(:'org_a', 'content_drafting', 'Primeira execução do workspace A', 10) as run1 \gset
select public.agent_start_run(:'org_a', 'product_research', 'Segunda execução do workspace A', 8) as run2 \gset
select tests.login(:'owner_b');
select public.agent_start_run(:'org_b', 'operations_review', 'Execução do workspace B', 6) as run_b \gset
reset role;
-- Ordem de chegada determinística (na mesma transação now() é igual para todas).
update public.agent_runs set created_at = now() - interval '30 minutes' where id = :'run1';
update public.agent_runs set created_at = now() - interval '20 minutes' where id = :'run_b';
update public.agent_runs set created_at = now() - interval '10 minutes' where id = :'run2';

-- O executor do servidor não carrega sessão de usuário.
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);

-- 1. Só o executor do servidor reserva ou expira execuções
set local role authenticated;
select tests.login(:'owner_a');
select tests.throws('select * from public.agent_claim_next_run()', '42501', '1a usuário não reserva execução');
select tests.throws('select public.agent_reap_stale_runs(600)', '42501', '1b usuário não expira execução');
reset role;
set local role anon;
select tests.throws('select * from public.agent_claim_next_run()', '42501', '1c anon não reserva execução');
select tests.throws('select public.agent_reap_stale_runs(600)', '42501', '1d anon não expira execução');
reset role;
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);
set local role service_role;
select tests.throws(format('update public.agent_runs set claimed_at = now() where id = %L', :'run1'), '42501', '1e service_role não escreve direto em agent_runs');
reset role;

-- 2. Reserva: a mais antiga, contexto vindo do banco, queued → planning com lease
set local role service_role;
select run_id as c1, organization_id as c1_org, agent as c1_agent, max_steps as c1_max, step_count as c1_steps,
       created_by as c1_by, granted_tools::text as c1_tools, claimed_at as c1_claimed
from public.agent_claim_next_run() \gset
reset role;
select tests.ok(:'c1' = :'run1', '2a reserva a execução mais antiga da fila');
select tests.ok(:'c1_org' = :'org_a' and :'c1_agent' = 'content_drafting' and :c1_max = 10 and :c1_steps = 0
  and :'c1_by' = :'admin_a', '2b contexto: workspace, agente, limite e autor vêm da execução');
select tests.ok(:'c1_tools' = '{draft_content,read_products}', '2c ferramentas liberadas do workspace, ordenadas');
select tests.ok(
  (select status = 'planning' and claimed_at is not null and started_at is not null and claimed_at = :'c1_claimed'::timestamptz
   from public.agent_runs where id = :'run1'),
  '2d execução reservada: planning, claimed_at e started_at gravados'
);
select tests.ok((select count(*) = 0 from public.agent_steps where run_id = :'run1'), '2e reservar não grava passo');

-- 3. Uma ativa por workspace: run2 (workspace A) espera; a próxima é a do workspace B
set local role service_role;
select run_id as c2, granted_tools::text as c2_tools from public.agent_claim_next_run() \gset
reset role;
select tests.ok(:'c2' = :'run_b', '3a pula workspace com execução ativa e reserva a do workspace B');
select tests.ok(:'c2_tools' = '{}', '3b workspace sem ferramentas liberadas recebe lista vazia');
set local role service_role;
select tests.ok((select count(*) = 0 from public.agent_claim_next_run()), '3c nada a reservar enquanto os workspaces estão ocupados');
reset role;
select tests.ok((select status = 'queued' and claimed_at is null from public.agent_runs where id = :'run2'), '3d run2 segue na fila, intacta');

-- 4. A execução reservada segue o fluxo do S13; ao terminar, o workspace libera a próxima
set local role service_role;
select tests.ok((select run_status = 'planning' from public.agent_record_step(:'run1', 'plan', null, '{}', '{}', 'ok')), '4a plano registrado na execução reservada');
select public.agent_fail_run(:'run1', 'tool_error');
select run_id as c3 from public.agent_claim_next_run() \gset
reset role;
select tests.ok(:'c3' = :'run2', '4b com run1 encerrada, run2 é reservada');
select tests.ok((select status = 'failed' and error_code = 'tool_error' from public.agent_runs where id = :'run1'), '4c execução encerrada não volta para a fila');

-- 5. Kill switch ligado entre a criação e a reserva: a execução morre, não roda
set local role service_role;
select public.agent_fail_run(:'run2', 'tool_error');
reset role;
set local role authenticated;
select tests.login(:'admin_a');
select public.agent_start_run(:'org_a', 'content_drafting', 'Execução antes do kill switch', 10) as run3 \gset
reset role;
-- Simula a corrida (kill switch gravado sem passar pelas execuções da fila).
update public.agent_settings set kill_switch = true, kill_reason = 'Teste de corrida' where organization_id = :'org_a';
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);
set local role service_role;
select tests.ok((select count(*) = 0 from public.agent_claim_next_run()), '5a kill switch ligado: nada é reservado');
reset role;
select tests.ok((select status = 'killed' and error_code = 'kill_switch' and finished_at is not null and claimed_at is null
  from public.agent_runs where id = :'run3'), '5b execução da fila vira killed (kill_switch)');
update public.agent_settings set kill_switch = false, kill_reason = null where organization_id = :'org_a';

-- 6. Autor perdeu o papel de owner/admin: a execução não roda em nome dele
set local role authenticated;
select tests.login(:'admin_a');
select public.agent_start_run(:'org_a', 'content_drafting', 'Execução de quem vai perder acesso', 10) as run4 \gset
reset role;
update public.organization_members set role = 'viewer' where organization_id = :'org_a' and user_id = :'admin_a';
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);
set local role service_role;
select tests.ok((select count(*) = 0 from public.agent_claim_next_run()), '6a autor sem papel: nada é reservado');
reset role;
select tests.ok((select status = 'failed' and error_code = 'run_owner_not_allowed' and claimed_at is null
  from public.agent_runs where id = :'run4'), '6b execução vira failed (run_owner_not_allowed)');
update public.organization_members set role = 'admin' where organization_id = :'org_a' and user_id = :'admin_a';

-- 7. Coerência: execução na fila nunca tem reserva
set local role authenticated;
select tests.login(:'admin_a');
select public.agent_start_run(:'org_a', 'content_drafting', 'Execução para o lease', 10) as run5 \gset
reset role;
select tests.throws(format('update public.agent_runs set claimed_at = now() where id = %L', :'run5'), '23514', '7a queued com claimed_at é recusado');

-- 8. Lease: execução ativa sem atividade além do lease vira worker_timeout; com passo recente, não
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);
set local role service_role;
select tests.throws('select public.agent_reap_stale_runs(30)', 'invalid_lease', '8a lease curto demais');
select tests.throws('select public.agent_reap_stale_runs(4000)', 'invalid_lease', '8b lease longo demais');
select tests.throws('select public.agent_reap_stale_runs(null)', 'invalid_lease', '8c lease nulo');
select run_id as c5 from public.agent_claim_next_run() \gset
reset role;
select tests.ok(:'c5' = :'run5', '8d run5 reservada');
-- run5 parada há 1 h sem passos; run_b reservada há 1 h, mas com passo agora.
update public.agent_runs
set created_at = now() - interval '2 hours', started_at = now() - interval '1 hour', claimed_at = now() - interval '1 hour'
where id in (:'run5', :'run_b');
set local role service_role;
select public.agent_record_step(:'run_b', 'plan', null, '{}', '{}', 'ok');
select tests.ok(public.agent_reap_stale_runs(600) = 1, '8e só a execução parada expira');
reset role;
select tests.ok((select status = 'failed' and error_code = 'worker_timeout' and finished_at is not null
  from public.agent_runs where id = :'run5'), '8f execução parada vira failed (worker_timeout)');
select tests.ok((select status = 'planning' from public.agent_runs where id = :'run_b'), '8g execução com passo recente segue ativa');
set local role service_role;
select tests.ok(public.agent_reap_stale_runs(600) = 0, '8h expirar de novo não muda nada');
select tests.ok(public.agent_reap_stale_runs(3600) = 0, '8i lease maior que a inatividade não expira');
select tests.throws(format('select * from public.agent_record_step(%L, ''plan'', null, ''{}'', ''{}'', ''ok'')', :'run5'),
  'run_not_active', '8j execução expirada não aceita passos');
reset role;

-- 9. Encerradas e canceladas nunca são reservadas
set local role authenticated;
select tests.login(:'admin_a');
select public.agent_start_run(:'org_a', 'content_drafting', 'Execução cancelada antes da reserva', 10) as run6 \gset
select public.agent_cancel_run(:'run6', 'Mudança de planos');
reset role;
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);
set local role service_role;
select tests.ok((select count(*) = 0 from public.agent_claim_next_run()), '9a fila sem execuções queued: nada reservado');
reset role;
select tests.ok((select status = 'cancelled' and claimed_at is null from public.agent_runs where id = :'run6'), '9b cancelada continua cancelada');
select tests.ok(
  (select count(*) = 0 from public.agent_runs where status in ('succeeded', 'failed', 'cancelled', 'killed') and finished_at is null),
  '9c estados finais coerentes'
);

-- 10. Auditoria: a reserva aparece no histórico da execução
select tests.ok(
  (select count(*) >= 1 from public.audit_log
   where table_name = 'agent_runs' and record_id = :'run1'::text and new_data ->> 'status' = 'planning'),
  '10a reserva registrada no audit_log'
);

rollback;
