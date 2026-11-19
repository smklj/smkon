-- S7.2 fase C: séries diárias de public.workspace_overview.
\set ON_ERROR_STOP 1
\set owner_a 'a1400000-0000-4000-8000-00000000000a'
\set owner_b 'b1400000-0000-4000-8000-00000000000b'
begin;

select tests.create_user(:'owner_a', 'owner-a14@smkon.test');
select tests.create_user(:'owner_b', 'owner-b14@smkon.test');
set local role authenticated;
select tests.login(:'owner_a');
select workspace_id as org_a from public.ensure_workspace() \gset
select tests.login(:'owner_b');
select workspace_id as org_b from public.ensure_workspace() \gset

-- 1. Workspace vazio: todos os dias presentes, com zero
select tests.login(:'owner_a');
select public.workspace_overview(:'org_a') -> 'trends' as t0 \gset
select tests.ok(:'t0'::jsonb ->> 'timezone' = 'America/Sao_Paulo', '1a fuso declarado');
select tests.ok(
  jsonb_array_length(:'t0'::jsonb -> 'content_created') = 14
  and jsonb_array_length(:'t0'::jsonb -> 'publications_scheduled') = 7
  and jsonb_array_length(:'t0'::jsonb -> 'agent_runs') = 14,
  '1b 14, 7 e 14 dias'
);
select tests.ok(
  (select bool_and((e ->> 'count')::int = 0) from jsonb_array_elements(:'t0'::jsonb -> 'content_created') e),
  '1c dias sem registro valem zero'
);
select tests.ok(
  (:'t0'::jsonb #>> '{content_created,13,day}') = ((now() at time zone 'America/Sao_Paulo')::date)::text
  and (:'t0'::jsonb #>> '{publications_scheduled,0,day}') = ((now() at time zone 'America/Sao_Paulo')::date)::text,
  '1d último dia do passado e primeiro do futuro = hoje em Brasília, formato AAAA-MM-DD'
);

-- 2. Contagens por dia
insert into public.content_items (organization_id, created_by, title, caption, channels)
values (:'org_a', :'owner_a', 'Hoje 1', 'L', array['Instagram'])
returning id as item \gset
insert into public.content_items (organization_id, created_by, title, caption, channels)
values (:'org_a', :'owner_a', 'Hoje 2', 'L', array['Instagram']);
select public.agent_start_run(:'org_a', 'operations_review', 'Execução de hoje');
reset role;
-- Conteúdo de 3 dias atrás e de 20 dias atrás (fora da janela) e conteúdo do outro workspace
insert into public.content_items (organization_id, created_by, title, caption, channels, created_at)
values (:'org_a', :'owner_a', 'Antigo', 'L', array['Instagram'], now() - interval '3 days'),
       (:'org_a', :'owner_a', 'Muito antigo', 'L', array['Instagram'], now() - interval '20 days'),
       (:'org_b', :'owner_b', 'De B', 'L', array['Instagram'], now());
set local role authenticated;
select tests.login(:'owner_a');
select content_hash as h from public.content_items where id = :'item' \gset
select public.approve_content(:'item', :'h');
select public.schedule_publication(:'item', 'Instagram', date_trunc('minute', now()) + interval '2 days');
select public.schedule_publication(:'item', 'Instagram', date_trunc('minute', now()) + interval '30 days');

select public.workspace_overview(:'org_a') -> 'trends' as t1 \gset
select tests.ok((:'t1'::jsonb #>> '{content_created,13,count}')::int = 2, '2a dois conteúdos hoje (B não entra)');
select tests.ok(
  (select sum((e ->> 'count')::int) from jsonb_array_elements(:'t1'::jsonb -> 'content_created') e) = 3,
  '2b janela de 14 dias exclui o conteúdo de 20 dias atrás'
);
select tests.ok(
  (select sum((e ->> 'count')::int) from jsonb_array_elements(:'t1'::jsonb -> 'publications_scheduled') e) = 1,
  '2c publicação a 30 dias fica fora da janela de 7'
);
select tests.ok((:'t1'::jsonb #>> '{agent_runs,13,count}')::int = 1, '2d execução de agente de hoje');

-- 3. Chaves anteriores continuam
select tests.ok(
  (select public.workspace_overview(:'org_a') ?& array['content', 'approval_queue', 'products', 'publication', 'finance', 'connections', 'generated_at']),
  '3a contrato anterior preservado'
);
reset role;
select tests.ok(
  (select not prosecdef and provolatile = 's' from pg_proc where oid = 'public.workspace_overview(uuid)'::regprocedure)
  and not has_function_privilege('anon', 'public.workspace_overview(uuid)', 'execute'),
  '3b security invoker, stable, sem anon'
);

rollback;
