-- S14 etapa 4: draft_content cria só rascunho, vinculado à execução, autoria humana; nunca aprova nem publica.
\set ON_ERROR_STOP 1
\set owner_a 'a1400000-0000-4000-8000-00000000000a'
\set admin_a 'a1400000-0000-4000-8000-0000000000a1'
\set viewer_a 'a1400000-0000-4000-8000-0000000000a2'
\set owner_b 'b1400000-0000-4000-8000-00000000000b'
begin;

select tests.create_user(:'owner_a', 'owner-a14@smkon.test');
select tests.create_user(:'admin_a', 'admin-a14@smkon.test');
select tests.create_user(:'viewer_a', 'viewer-a14@smkon.test');
select tests.create_user(:'owner_b', 'owner-b14@smkon.test');
set local role authenticated;
select tests.login(:'owner_a');
select workspace_id as org_a from public.ensure_workspace() \gset
select tests.login(:'owner_b');
select workspace_id as org_b from public.ensure_workspace() \gset
reset role;
insert into public.organization_members (organization_id, user_id, role) values
  (:'org_a', :'admin_a', 'admin'), (:'org_a', :'viewer_a', 'viewer');

set local role authenticated;
select tests.login(:'admin_a');
select public.agent_start_run(:'org_a', 'content_drafting', 'Rascunho de roteiro para o produto X', 12) as run1 \gset
select tests.login(:'owner_b');
select public.agent_set_tool(:'org_b', 'draft_content', true);
select public.agent_start_run(:'org_b', 'content_drafting', 'Rascunho no workspace B', 12) as run_b \gset
reset role;

-- O executor do servidor não carrega sessão de usuário.
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);

-- 1. Só o executor do servidor chama
set local role authenticated;
select tests.login(:'admin_a');
select tests.throws(format('select * from public.agent_draft_content(%L, ''{"title":"x"}'')', :'run1'), '42501', '1a usuário não chama draft_content');
reset role;
set local role anon;
select tests.throws(format('select * from public.agent_draft_content(%L, ''{"title":"x"}'')', :'run1'), '42501', '1b anon não chama draft_content');
reset role;
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);

-- 2. Pré-condições da execução
set local role service_role;
select tests.throws(format('select * from public.agent_draft_content(%L, ''{"title":"x"}'')', gen_random_uuid()), 'agent_run_not_found', '2a execução inexistente');
select tests.throws(format('select * from public.agent_draft_content(%L, ''{"title":"Roteiro"}'')', :'run1'), 'run_not_active', '2b execução na fila (sem plano) não escreve');
select public.agent_record_step(:'run1', 'plan', null, '{}', '{}', 'ok');
select tests.throws(format('select * from public.agent_draft_content(%L, ''{"title":"Roteiro"}'')', :'run1'), 'tool_not_allowed', '2c draft_content não liberado no workspace');
reset role;
set local role authenticated;
select tests.login(:'admin_a');
select public.agent_set_tool(:'org_a', 'draft_content', true);
reset role;
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);

-- 3. Entrada estrita: nada de status, direitos, links, mídia ou organização vindos do modelo
set local role service_role;
select tests.throws(format('select * from public.agent_draft_content(%L, null)', :'run1'), 'invalid_draft', '3a rascunho nulo');
select tests.throws(format('select * from public.agent_draft_content(%L, ''[]'')', :'run1'), 'invalid_draft', '3b rascunho não é objeto');
select tests.throws(format('select * from public.agent_draft_content(%L, ''{"title":"  "}'')', :'run1'), 'invalid_draft', '3c título vazio');
select tests.throws(format('select * from public.agent_draft_content(%L, ''{"title":"T","status":"approved"}'')', :'run1'), 'invalid_draft', '3d não define status');
select tests.throws(format('select * from public.agent_draft_content(%L, ''{"title":"T","rights_confirmed":true}'')', :'run1'), 'invalid_draft', '3e não declara direitos');
select tests.throws(format('select * from public.agent_draft_content(%L, ''{"title":"T","source_url":"https://x.test"}'')', :'run1'), 'invalid_draft', '3f não define fonte externa');
select tests.throws(format('select * from public.agent_draft_content(%L, %L)', :'run1', jsonb_build_object('title', 'T', 'organization_id', :'org_b')), 'invalid_draft', '3g não escolhe organização');
select tests.throws(format('select * from public.agent_draft_content(%L, ''{"title":"T","channels":["Facebook"]}'')', :'run1'), 'invalid_draft', '3h canal fora da lista');
select tests.throws(format('select * from public.agent_draft_content(%L, ''{"title":"T","channels":[]}'')', :'run1'), 'invalid_draft', '3i canais vazios');
select tests.throws(format('select * from public.agent_draft_content(%L, ''{"title":"T","script":42}'')', :'run1'), 'invalid_draft', '3j tipo inválido');
select tests.throws(format('select * from public.agent_draft_content(%L, %L)', :'run1', jsonb_build_object('title', repeat('x', 181))), 'invalid_draft', '3k título longo demais');
select tests.throws(format('select * from public.agent_draft_content(%L, %L)', :'run1', jsonb_build_object('title', 'T', 'caption', repeat('x', 2201))), 'invalid_draft', '3l legenda longa demais');
select tests.ok((select count(*) = 0 from public.content_items where organization_id = :'org_a'), '3m entrada inválida não grava nada');

-- 4. Rascunho criado: status draft, autoria humana, vinculado à execução, sem direitos nem aprovação
select content_id as c1, content_version as v1, content_hash as h1, content_status as st1
from public.agent_draft_content(:'run1', '{"title":"  Roteiro do produto X  ","script":"Gancho, demonstração, CTA","caption":"Legenda","cta":"Saiba mais","hashtags":"#x","channels":["TikTok","Instagram","TikTok"]}') \gset
select tests.ok(:'st1' = 'draft' and :v1 = 1 and :'h1' ~ '^[a-f0-9]{64}$', '4a retorna rascunho versão 1 com hash');
select tests.ok(
  (select organization_id = :'org_a'::uuid and created_by = :'admin_a'::uuid and agent_run_id = :'run1'::uuid
     and status = 'draft' and title = 'Roteiro do produto X' and channels = array['Instagram','TikTok']
     and not rights_confirmed and source_url = '' and asset_url = '' and media_asset_id is null
     and approved_version is null and approved_by is null
   from public.content_items where id = :'c1'),
  '4b dados gravados: workspace e autor da execução, canais normalizados, sem direitos/mídia/aprovação'
);
select tests.ok((select count(*) = 1 from public.content_versions where content_item_id = :'c1' and version = 1), '4c versão 1 no histórico');
select tests.ok((select count(*) = 0 from public.content_approvals where content_item_id = :'c1'), '4d nenhuma aprovação criada');
select tests.ok((select count(*) = 0 from public.publication_jobs where content_item_id = :'c1'), '4e nada agendado na fila de publicação');
select content_id as c_default from public.agent_draft_content(:'run1', '{"title":"Só título"}') \gset
select tests.ok(
  (select channels = array['YouTube','Instagram','TikTok'] and script = '' from public.content_items where id = :'c_default'),
  '4f padrões da tabela quando o modelo omite campos'
);
reset role;
select tests.ok((select count(*) > 0 from public.audit_log where table_name = 'content_items' and record_id = :'c1'), '4g criação vai para o audit_log');

-- 5. Marca de agente: usuário não forja nem apaga; aprovação continua humana
set local role authenticated;
select tests.login(:'admin_a');
select tests.throws(
  format('insert into public.content_items (organization_id, created_by, title, agent_run_id) values (%L, %L, ''Forjado'', %L)', :'org_a', :'admin_a', :'run1'),
  'agent_run_reserved', '5a usuário não cria conteúdo com marca de agente'
);
select tests.throws(format('update public.content_items set agent_run_id = null where id = %L', :'c1'), 'agent_run_immutable', '5b usuário não remove a marca de agente');
insert into public.content_items (organization_id, created_by, title) values (:'org_a', :'admin_a', 'Manual') returning id as c_manual \gset
select tests.throws(format('update public.content_items set agent_run_id = %L where id = %L', :'run1', :'c_manual'), 'agent_run_immutable', '5c usuário não atribui conteúdo manual a um agente');
select tests.throws(format('update public.content_items set status = ''approved'' where id = %L', :'c1'), 'approval_required', '5d rascunho de agente não vira aprovado sem decisão humana');
select tests.login(:'viewer_a');
select tests.ok((select count(*) = 2 from public.content_items where agent_run_id = :'run1'), '5e membros leem os rascunhos do agente');
select tests.throws(format('select * from public.approve_content(%L, %L)', :'c1', :'h1'), 'forbidden', '5f viewer não aprova rascunho do agente');
select tests.login(:'owner_a');
select approved_version as av from public.approve_content(:'c1', :'h1') \gset
select tests.ok(
  (select status = 'approved' and approved_by = :'owner_a'::uuid and approved_version = 1 from public.content_items where id = :'c1'),
  '5g aprovação humana da versão exata segue o fluxo normal'
);
select tests.login(:'owner_b');
select tests.ok((select count(*) = 0 from public.content_items where organization_id = :'org_a'), '5h outro workspace não lê os rascunhos');
reset role;
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);

-- 6. Isolamento: execução de B escreve só em B
set local role service_role;
select public.agent_record_step(:'run_b', 'plan', null, '{}', '{}', 'ok');
select content_id as cb from public.agent_draft_content(:'run_b', '{"title":"Rascunho B"}') \gset
select tests.ok(
  (select organization_id = :'org_b'::uuid and created_by = :'owner_b'::uuid from public.content_items where id = :'cb'),
  '6a rascunho da execução de B fica em B com autor de B'
);

-- 7. Limite de 5 rascunhos por execução
select public.agent_draft_content(:'run1', '{"title":"Terceiro"}');
select public.agent_draft_content(:'run1', '{"title":"Quarto"}');
select public.agent_draft_content(:'run1', '{"title":"Quinto"}');
select tests.throws(format('select * from public.agent_draft_content(%L, ''{"title":"Sexto"}'')', :'run1'), 'draft_limit_reached', '7a sexto rascunho recusado');

-- 8. Fases e estados: verificação, encerrada, cancelada
select public.agent_record_step(:'run1', 'execute', 'draft_content', '{}', '{}', 'ok');
select public.agent_record_step(:'run1', 'verify', null, '{}', '{}', 'ok');
select tests.throws(format('select * from public.agent_draft_content(%L, ''{"title":"Na verificação"}'')', :'run1'), 'run_not_active', '8a não escreve durante a verificação');
select public.agent_finish_run(:'run1', '{}');
select tests.throws(format('select * from public.agent_draft_content(%L, ''{"title":"Depois"}'')', :'run1'), 'run_not_active', '8b execução encerrada não escreve');
reset role;

-- 9. Autor removido ou rebaixado: o rascunho não sai em nome de quem não pode criar conteúdo
set local role authenticated;
select tests.login(:'admin_a');
select public.agent_start_run(:'org_a', 'content_drafting', 'Execução de autor rebaixado', 12) as run2 \gset
reset role;
update public.organization_members set role = 'viewer' where organization_id = :'org_a' and user_id = :'admin_a';
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);
set local role service_role;
select public.agent_record_step(:'run2', 'plan', null, '{}', '{}', 'ok');
select tests.throws(format('select * from public.agent_draft_content(%L, ''{"title":"Em nome de viewer"}'')', :'run2'), 'run_owner_not_allowed', '9a autor sem papel de criação bloqueia o rascunho');
reset role;

-- 10. Kill switch: execução interrompida não escreve
update public.organization_members set role = 'admin' where organization_id = :'org_a' and user_id = :'admin_a';
set local role authenticated;
select tests.login(:'owner_a');
select public.agent_set_kill_switch(:'org_a', true, 'Incidente de custo');
reset role;
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true);
set local role service_role;
select tests.throws(format('select * from public.agent_draft_content(%L, ''{"title":"Depois do kill"}'')', :'run2'), 'run_not_active', '10a execução morta pelo kill switch não escreve');
reset role;
select tests.ok((select count(*) = 5 from public.content_items where agent_run_id = :'run1'), '10b total de rascunhos da execução 1 é 5');

rollback;
