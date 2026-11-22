-- S6 + 22/11: limite de tentativas. Login só pela chave de servidor (service_role).
\set ON_ERROR_STOP 1
\set user_a 'a7000000-0000-4000-8000-00000000000a'
\set user_b 'b7000000-0000-4000-8000-00000000000b'
\set email_hash '1111111111111111111111111111111111111111111111111111111111111111'
\set other_hash '2222222222222222222222222222222222222222222222222222222222222222'
begin;

select tests.create_user(:'user_a', 'rl-a@smkon.test');
select tests.create_user(:'user_b', 'rl-b@smkon.test');

-- 0. Permissões: ninguém de fora bloqueia o login de um e-mail
select tests.ok(not has_function_privilege('anon', 'public.rate_limit_consume(text, text)', 'execute'), '0a anon não executa rate_limit_consume');
select tests.ok(not has_function_privilege('anon', 'public.rate_limit_consume_login(text, text)', 'execute'), '0b anon não executa rate_limit_consume_login');
select tests.ok(not has_function_privilege('authenticated', 'public.rate_limit_consume_login(text, text)', 'execute'), '0c authenticated não executa rate_limit_consume_login');
select tests.ok(has_function_privilege('service_role', 'public.rate_limit_consume_login(text, text)', 'execute'), '0d service_role executa rate_limit_consume_login');
select tests.ok(has_function_privilege('authenticated', 'public.rate_limit_consume(text, text)', 'execute'), '0e authenticated continua com os escopos de convite');
select tests.ok(not has_function_privilege('anon', 'public.rate_limit_hit(text, text, integer, integer)', 'execute'), '0f anon não executa a contagem interna');
select tests.ok(not has_function_privilege('authenticated', 'public.rate_limit_hit(text, text, integer, integer)', 'execute'), '0g authenticated não executa a contagem interna');
select tests.ok(not has_function_privilege('service_role', 'public.rate_limit_hit(text, text, integer, integer)', 'execute'), '0h service_role não executa a contagem interna');

-- 1. Validação (servidor)
set local role service_role;
select tests.throws('select public.rate_limit_consume_login(''invite_create'', null)', 'invalid_rate_limit_scope', '1a escopo de convite não passa pela função de login');
select tests.throws('select public.rate_limit_consume_login(''login_email'', ''pessoa@empresa.com'')', 'invalid_rate_limit_subject', '1b sujeito em texto puro é recusado (só hash)');
select tests.throws('select public.rate_limit_consume_login(''login_email'', null)', 'invalid_rate_limit_subject', '1c sujeito vazio é recusado');

-- 2. Contagem e bloqueio (login_email: 10 por janela)
-- A chamada referencia g para ser avaliada uma vez por linha (sem isso o planner a executa uma única vez).
select tests.ok(
  (select bool_and(allowed) from generate_series(1, 10) g, lateral public.rate_limit_consume_login('login_email', case when g > 0 then :'email_hash' end)),
  '2a as 10 primeiras tentativas passam'
);
select allowed as eleventh, retry_after_seconds as retry from public.rate_limit_consume_login('login_email', :'email_hash') \gset
select tests.ok(not :'eleventh'::boolean, '2b a 11ª tentativa é bloqueada');
select tests.ok(:retry > 0 and :retry <= 900, '2c retry_after dentro da janela');
select tests.ok((select allowed from public.rate_limit_consume_login('login_email', :'other_hash')), '2d outro e-mail não é afetado');
select tests.ok((select allowed from public.rate_limit_consume_login('login_ip', :'email_hash')), '2e escopos são independentes');
reset role;

-- 3. Escopo autenticado usa auth.uid e ignora o sujeito enviado; login fica fora
set local role authenticated;
select tests.login(:'user_a');
select tests.throws('select public.rate_limit_consume(''login_email'', ''' || :'email_hash' || ''')', 'login_scope_server_only', '3a usuário logado não consome escopo de login');
select tests.throws('select public.rate_limit_consume(''qualquer'', null)', 'invalid_rate_limit_scope', '3b escopo desconhecido é recusado');
select tests.ok(
  (select bool_and(allowed) from generate_series(1, 30) g, lateral public.rate_limit_consume('invite_create', case when g > 0 then :'other_hash' end)),
  '3c 30 convites por hora passam'
);
select tests.ok(not (select allowed from public.rate_limit_consume('invite_create', :'email_hash')), '3d o 31º é bloqueado mesmo trocando o sujeito');
select tests.login(:'user_b');
select tests.ok((select allowed from public.rate_limit_consume('invite_create', null)), '3e outro usuário tem a própria cota');
select tests.ok((select bool_and(allowed) from generate_series(1, 20) g, lateral public.rate_limit_consume('invite_accept', case when g > 0 then null end)), '3f 20 aceites por hora passam');
select tests.ok(not (select allowed from public.rate_limit_consume('invite_accept', null)), '3g o 21º aceite é bloqueado');

-- 4. A tabela não é acessível pela API
select tests.throws('select * from public.rate_limit_buckets', '42501', '4a authenticated não lê os contadores');
select tests.throws('delete from public.rate_limit_buckets', '42501', '4b authenticated não zera os contadores');
reset role;
set local role anon;
select tests.throws('select * from public.rate_limit_buckets', '42501', '4c anon não lê os contadores');
reset role;

-- 5. Nenhum e-mail ou IP em texto puro armazenado
select tests.ok(
  not exists (select 1 from public.rate_limit_buckets where scope like 'login_%' and subject !~ '^[a-f0-9]{64}$'),
  '5 escopos de login guardam só hashes'
);

rollback;
