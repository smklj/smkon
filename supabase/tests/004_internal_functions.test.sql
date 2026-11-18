-- Funções internas não ficam expostas aos papéis da API; o versionamento continua funcionando.
\set ON_ERROR_STOP 1
\set user_a 'dddddddd-0000-4000-8000-00000000000d'
begin;

select tests.ok(not has_function_privilege('anon', 'public.content_canonical_hash(public.content_items)', 'execute'), '1a anon não executa content_canonical_hash');
select tests.ok(not has_function_privilege('authenticated', 'public.content_canonical_hash(public.content_items)', 'execute'), '1b authenticated não executa content_canonical_hash');
select tests.ok(not has_function_privilege('authenticated', 'public.reject_mutation()', 'execute'), '1c authenticated não executa reject_mutation');
select tests.ok(has_function_privilege('authenticated', 'public.ensure_workspace()', 'execute'), '1d ensure_workspace continua disponível');
select tests.ok(has_function_privilege('authenticated', 'public.approve_content(uuid, text, text)', 'execute'), '1e approve_content continua disponível');

-- O trigger de versionamento continua calculando o hash para usuários autenticados.
select tests.create_user(:'user_a', 'internal-fn@smkon.test');
set local role authenticated;
select tests.login(:'user_a');
select workspace_id as org_a from public.ensure_workspace() \gset
insert into public.content_items (organization_id, created_by, title)
values (:'org_a', :'user_a', 'Hash via trigger')
returning content_hash as h \gset
select tests.ok(:'h' ~ '^[a-f0-9]{64}$', '2 trigger calcula o hash sem EXECUTE direto do papel');
reset role;

rollback;
