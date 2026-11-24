-- S24: missões de agentes (agenda), enfileiramento pelo worker e barreiras.
\set ON_ERROR_STOP 1
\set owner_a 'a2400000-0000-4000-8000-00000000000a'
\set admin_a 'a2400000-0000-4000-8000-0000000000a1'
\set viewer_a 'a2400000-0000-4000-8000-0000000000a2'
\set owner_b 'b2400000-0000-4000-8000-00000000000b'
begin;

select tests.create_user(:'owner_a', 'owner-a24@smkon.test');
select tests.create_user(:'admin_a', 'admin-a24@smkon.test');
select tests.create_user(:'viewer_a', 'viewer-a24@smkon.test');
select tests.create_user(:'owner_b', 'owner-b24@smkon.test');
set local role authenticated;
select tests.login(:'owner_a');
select workspace_id as org_a from public.ensure_workspace() \gset
select tests.login(:'owner_b');
select workspace_id as org_b from public.ensure_workspace() \gset
reset role;
insert into public.organization_members (organization_id, user_id, role) values
  (:'org_a', :'admin_a', 'admin'), (:'org_a', :'viewer_a', 'viewer');

-- 1. Agenda: próxima ocorrência no fuso da missão
select tests.ok(
  public.agent_mission_next_run('daily', 8, 0, null, null, 'America/Sao_Paulo', '2026-11-24 10:00:00-03')
    = '2026-11-25 08:00:00-03'::timestamptz,
  '1a diária às 08h depois das 10h → amanhã 08h'
);
select tests.ok(
  public.agent_mission_next_run('daily', 8, 0, null, null, 'America/Sao_Paulo', '2026-11-24 07:59:00-03')
    = '2026-11-24 08:00:00-03'::timestamptz,
  '1b diária às 08h antes das 08h → hoje 08h'
);
select tests.ok(
  public.agent_mission_next_run('daily', 8, 0, null, null, 'America/Sao_Paulo', '2026-11-24 08:00:00-03')
    = '2026-11-25 08:00:00-03'::timestamptz,
  '1c exatamente na hora → próxima, nunca a mesma'
);
-- 24/11/2026 é terça (dow 2); segunda = 1.
select tests.ok(
  public.agent_mission_next_run('weekly', 8, 30, 1, null, 'America/Sao_Paulo', '2026-11-24 10:00:00-03')
    = '2026-11-30 08:30:00-03'::timestamptz,
  '1d semanal segunda 08h30 a partir de terça → próxima segunda'
);
select tests.ok(
  public.agent_mission_next_run('weekly', 18, 0, 2, null, 'America/Sao_Paulo', '2026-11-24 10:00:00-03')
    = '2026-11-24 18:00:00-03'::timestamptz,
  '1e semanal terça 18h numa terça de manhã → hoje'
);
select tests.ok(
  public.agent_mission_next_run('interval', null, null, null, 6, 'America/Sao_Paulo', '2026-11-24 10:00:00-03')
    = '2026-11-24 16:00:00-03'::timestamptz,
  '1f a cada 6 h'
);
select tests.throws($$select public.agent_mission_next_run('daily', 25, 0, null, null, 'UTC', now())$$, 'invalid_mission_schedule', '1g hora inválida');
select tests.throws($$select public.agent_mission_next_run('hourly', 1, 0, null, null, 'UTC', now())$$, 'invalid_mission_schedule', '1h tipo de agenda inválido');

-- 2. Criar missão: papéis e validação
set local role anon;
select tests.throws(format($$select public.agent_create_mission(%L, 'Radar', 'product_research', 'Ranking semanal', 6, 'daily', 8, 0)$$, :'org_a'), '42501', '2a anon não cria');
reset role;
set local role authenticated;
select tests.login(:'viewer_a');
select tests.throws(format($$select public.agent_create_mission(%L, 'Radar', 'product_research', 'Ranking semanal', 6, 'daily', 8, 0)$$, :'org_a'), 'forbidden', '2b viewer não cria');
select tests.login(:'owner_b');
select tests.throws(format($$select public.agent_create_mission(%L, 'Radar', 'product_research', 'Ranking semanal', 6, 'daily', 8, 0)$$, :'org_a'), 'forbidden', '2c outro workspace não cria');
select tests.login(:'admin_a');
select tests.throws(format($$select public.agent_create_mission(%L, 'R', 'product_research', 'Ranking semanal', 6, 'daily', 8, 0)$$, :'org_a'), 'invalid_mission_name', '2d nome curto');
select tests.throws(format($$select public.agent_create_mission(%L, 'Publicador', 'publisher', 'Publicar tudo', 6, 'daily', 8, 0)$$, :'org_a'), 'invalid_agent', '2e agente fora da lista');
select tests.throws(format($$select public.agent_create_mission(%L, 'Radar', 'product_research', 'x', 6, 'daily', 8, 0)$$, :'org_a'), 'invalid_goal', '2f objetivo curto');
select tests.throws(format($$select public.agent_create_mission(%L, 'Radar', 'product_research', 'Ranking semanal', 6, 'monthly', 8, 0)$$, :'org_a'), 'invalid_mission_schedule', '2g agenda fora da lista');
select tests.throws(format($$select public.agent_create_mission(%L, 'Radar', 'product_research', 'Ranking semanal', 6, 'daily')$$, :'org_a'), 'invalid_mission_schedule', '2h diária sem horário');
select tests.throws(format($$select public.agent_create_mission(%L, 'Radar', 'product_research', 'Ranking semanal', 6, 'weekly', 8, 0)$$, :'org_a'), 'invalid_mission_schedule', '2i semanal sem dia');
select tests.throws(format($$select public.agent_create_mission(%L, 'Radar', 'product_research', 'Ranking semanal', 99, 'daily', 8, 0)$$, :'org_a'), 'invalid_max_steps', '2j passos acima do limite');
select tests.throws(format($$select public.agent_create_mission(%L, 'Radar', 'product_research', 'Ranking semanal', 6, 'daily', 8, 0, null, null, 'Mars/Olympus')$$, :'org_a'), 'invalid_timezone', '2k fuso inválido');

select public.agent_create_mission(:'org_a', 'Radar semanal', 'product_research', 'Ranking dos produtos com evidência', 6, 'weekly', 8, 0, 1) as m1 \gset
select public.agent_create_mission(:'org_a', 'Revisão a cada 6 h', 'operations_review', 'Resumo da fila e do financeiro', 5, 'interval', null, null, null, 6) as m2 \gset
-- Campos de outra agenda são descartados (daily não guarda dia nem intervalo).
select public.agent_create_mission(:'org_a', 'Rascunhos do dia', 'content_drafting', 'Três rascunhos dos produtos selecionados', 8, 'daily', 18, 0, 3, 12) as m3 \gset

select tests.ok(
  (select owner_id = :'admin_a'::uuid and created_by = :'admin_a'::uuid and enabled and next_run_at > now()
          and timezone = 'America/Sao_Paulo' and archived_at is null
   from public.agent_missions where id = :'m1'),
  '2l missão criada ativa, com responsável e próxima execução no futuro'
);
select tests.ok(
  (select run_weekday is null and interval_hours is null and run_hour = 18 from public.agent_missions where id = :'m3'),
  '2m diária descarta dia e intervalo enviados'
);
select tests.ok(
  (select next_run_at = public.agent_mission_next_run('weekly', 8, 0, 1, null, 'America/Sao_Paulo', now())
   from public.agent_missions where id = :'m1'),
  '2n próxima execução calculada pela agenda'
);

-- 3. Leitura e escrita direta
select tests.login(:'viewer_a');
select tests.ok((select count(*) = 3 from public.agent_missions where organization_id = :'org_a'), '3a viewer lê as missões do workspace');
select tests.login(:'owner_b');
select tests.ok((select count(*) = 0 from public.agent_missions where organization_id = :'org_a'), '3b outro workspace não lê');
select tests.login(:'admin_a');
select tests.throws(format($$update public.agent_missions set enabled = false where id = %L$$, :'m1'), '42501', '3c usuário não altera direto');
select tests.throws(format($$insert into public.agent_missions (organization_id, name, agent, goal, max_steps, schedule_kind, interval_hours, next_run_at, owner_id, created_by) values (%L, 'Direta', 'operations_review', 'Sem função', 5, 'interval', 1, now(), %L, %L)$$, :'org_a', :'admin_a', :'admin_a'), '42501', '3d usuário não insere direto');
reset role;
set local role service_role;
select tests.throws(format($$update public.agent_missions set next_run_at = now() where id = %L$$, :'m1'), '42501', '3e service_role não altera direto');
reset role;
select tests.throws(format($$delete from public.agent_missions where id = %L$$, :'m1'), '42501', '3f missão não é apagada');

-- 4. Enfileirar: só o worker do servidor
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);
set local role authenticated;
select tests.login(:'owner_a');
select tests.throws('select * from public.agent_enqueue_due_missions()', '42501', '4a usuário não enfileira');
reset role;
set local role anon;
select tests.throws('select * from public.agent_enqueue_due_missions()', '42501', '4b anon não enfileira');
reset role;
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);

set local role service_role;
select tests.ok((select count(*) = 0 from public.agent_enqueue_due_missions()), '4c nada vencido, nada enfileirado');
reset role;

update public.agent_missions set next_run_at = now() - interval '1 minute' where id = :'m1';
set local role service_role;
select mission_id as e1_mission, run_id as e1_run, coalesce(skip_reason, 'none') as e1_skip from public.agent_enqueue_due_missions() \gset
reset role;
select tests.ok(:'e1_mission' = :'m1' and :'e1_skip' = 'none', '4d missão vencida gera execução');
select tests.ok(
  (select status = 'queued' and mission_id = :'m1'::uuid and created_by = :'admin_a'::uuid and agent = 'product_research'
          and goal = 'Ranking dos produtos com evidência' and max_steps = 6
   from public.agent_runs where id = :'e1_run'),
  '4e execução na fila em nome do responsável, ligada à missão'
);
select tests.ok(
  (select next_run_at > now() and last_run_id = :'e1_run'::uuid and last_enqueued_at is not null and last_skip_reason is null
   from public.agent_missions where id = :'m1'),
  '4f agenda avança e a missão guarda a última execução'
);
select tests.ok(
  (select count(*) = 1 from public.audit_log where table_name = 'agent_runs' and record_id = :'e1_run' and action = 'INSERT'),
  '4g execução criada pela missão entra na auditoria'
);
set local role service_role;
select tests.ok((select count(*) = 0 from public.agent_enqueue_due_missions()), '4h chamada repetida não duplica');
reset role;

-- 5. Sem acúmulo: execução anterior ainda ativa → pula e avança
update public.agent_missions set next_run_at = now() - interval '1 minute' where id = :'m1';
set local role service_role;
select skip_reason as s5, coalesce(run_id::text, 'none') as s5_run from public.agent_enqueue_due_missions() \gset
reset role;
select tests.ok(:'s5' = 'previous_run_active' and :'s5_run' = 'none', '5a anterior ativa → previous_run_active, sem execução nova');
select tests.ok(
  (select next_run_at > now() and last_skip_reason = 'previous_run_active' and last_run_id = :'e1_run'::uuid
   from public.agent_missions where id = :'m1'),
  '5b motivo registrado e agenda avançada'
);

-- 6. Kill switch
set local role authenticated;
select tests.login(:'owner_a');
select public.agent_set_kill_switch(:'org_a', true, 'Teste das missões');
reset role;
update public.agent_missions set next_run_at = now() - interval '1 minute' where id = :'m2';
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);
set local role service_role;
select skip_reason as s6 from public.agent_enqueue_due_missions() \gset
reset role;
select tests.ok(:'s6' = 'kill_switch', '6a kill switch ligado → nenhuma execução');
set local role authenticated;
select tests.login(:'owner_a');
select public.agent_set_kill_switch(:'org_a', false);
reset role;

-- 7. Limite diário
set local role authenticated;
select tests.login(:'owner_a');
select public.agent_update_limits(:'org_a', 1, 12);
reset role;
update public.agent_missions set next_run_at = now() - interval '1 minute' where id = :'m2';
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);
set local role service_role;
select skip_reason as s7 from public.agent_enqueue_due_missions() \gset
reset role;
select tests.ok(:'s7' = 'run_limit_reached', '7a limite de execuções em 24 h vale para missões');

-- 8. Passos acima do limite atual do workspace
set local role authenticated;
select tests.login(:'owner_a');
select public.agent_update_limits(:'org_a', 50, 5);
reset role;
update public.agent_missions set next_run_at = now() - interval '1 minute' where id = :'m3';
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);
set local role service_role;
select skip_reason as s8 from public.agent_enqueue_due_missions() \gset
reset role;
select tests.ok(:'s8' = 'max_steps_above_limit', '8a missão com mais passos que o limite atual não roda');
set local role authenticated;
select tests.login(:'owner_a');
select public.agent_update_limits(:'org_a', 50, 12);
reset role;

-- 9. Responsável perdeu o acesso → missão pausada
update public.organization_members set role = 'viewer' where organization_id = :'org_a' and user_id = :'admin_a';
update public.agent_missions set next_run_at = now() - interval '1 minute' where id = :'m2';
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);
set local role service_role;
select skip_reason as s9 from public.agent_enqueue_due_missions() \gset
reset role;
select tests.ok(:'s9' = 'owner_not_allowed', '9a responsável sem papel → owner_not_allowed');
select tests.ok(
  (select not enabled and next_run_at is null from public.agent_missions where id = :'m2'),
  '9b missão pausada'
);
select tests.ok(
  (select count(*) = 0 from public.agent_runs where mission_id = :'m2'),
  '9c nenhuma execução em nome de quem perdeu o acesso'
);

-- 10. Retomar passa a responsabilidade para quem retomou
set local role authenticated;
select tests.login(:'viewer_a');
select tests.throws(format('select public.agent_set_mission_enabled(%L, true)', :'m2'), 'forbidden', '10a viewer não retoma');
select tests.login(:'owner_b');
select tests.throws(format('select public.agent_set_mission_enabled(%L, true)', :'m2'), 'forbidden', '10b outro workspace não retoma');
select tests.login(:'owner_a');
select tests.ok(public.agent_set_mission_enabled(:'m2', true) > now(), '10c retomar devolve a próxima execução');
select tests.ok(
  (select enabled and owner_id = :'owner_a'::uuid and last_skip_reason is null from public.agent_missions where id = :'m2'),
  '10d responsável passa a ser quem retomou'
);
select tests.ok(public.agent_set_mission_enabled(:'m2', false) is null, '10e pausar');
select tests.ok((select not enabled and next_run_at is null from public.agent_missions where id = :'m2'), '10f pausada sem próxima execução');
select tests.throws(format('select public.agent_set_mission_enabled(%L, true)', '00000000-0000-4000-8000-000000000000'), 'mission_not_found', '10g missão inexistente');

-- 11. Arquivar
select public.agent_archive_mission(:'m2');
select tests.ok((select archived_at is not null and not enabled from public.agent_missions where id = :'m2'), '11a arquivada e desligada');
select tests.throws(format('select public.agent_set_mission_enabled(%L, true)', :'m2'), 'mission_archived', '11b arquivada não volta');
select tests.throws(format('select public.agent_archive_mission(%L)', :'m2'), 'mission_archived', '11c não arquiva duas vezes');

-- 12. Teto de 20 missões ativas por workspace
select public.agent_create_mission(:'org_a', format('Missão %s', g), 'operations_review', 'Resumo periódico', 5, 'interval', null, null, null, 24)
from generate_series(1, 18) g;
select tests.throws(format($$select public.agent_create_mission(%L, 'A vigésima primeira', 'operations_review', 'Resumo', 5, 'interval', null, null, null, 24)$$, :'org_a'), 'mission_limit_reached', '12a teto de 20 missões');
reset role;

rollback;
