-- S17: Hub de Conectores (contas sociais, novos provedores e ações externas aprovadas por hash).
\set ON_ERROR_STOP 1
\set owner_a 'a4000000-0000-4000-8000-00000000000a'
\set admin_a 'a4000000-0000-4000-8000-0000000000a1'
\set analyst_a 'a4000000-0000-4000-8000-0000000000a2'
\set viewer_a 'a4000000-0000-4000-8000-0000000000a3'
\set owner_b 'b4000000-0000-4000-8000-00000000000b'
begin;

select tests.create_user(:'owner_a', 'owner-a40@smkon.test');
select tests.create_user(:'admin_a', 'admin-a40@smkon.test');
select tests.create_user(:'analyst_a', 'analyst-a40@smkon.test');
select tests.create_user(:'viewer_a', 'viewer-a40@smkon.test');
select tests.create_user(:'owner_b', 'owner-b40@smkon.test');
set local role authenticated;
select tests.login(:'owner_a');
select workspace_id as org_a from public.ensure_workspace() \gset
select tests.login(:'owner_b');
select workspace_id as org_b from public.ensure_workspace() \gset
reset role;
insert into public.organization_members (organization_id, user_id, role) values
  (:'org_a', :'admin_a', 'admin'),
  (:'org_a', :'analyst_a', 'analyst'),
  (:'org_a', :'viewer_a', 'viewer');

-- 1. Estrutura e permissões
select tests.ok(
  (select bool_and(c.relrowsecurity) from pg_class c
   where c.oid in ('public.social_accounts'::regclass, 'public.external_action_requests'::regclass)),
  '1a RLS ligada nas tabelas novas'
);
select tests.ok(
  not has_table_privilege('authenticated', 'public.social_accounts', 'INSERT')
  and not has_table_privilege('authenticated', 'public.social_accounts', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.external_action_requests', 'INSERT')
  and not has_table_privilege('authenticated', 'public.external_action_requests', 'UPDATE')
  and not has_table_privilege('anon', 'public.social_accounts', 'SELECT')
  and not has_table_privilege('anon', 'public.external_action_requests', 'SELECT'),
  '1b authenticated só lê; anon sem acesso'
);
select tests.ok(
  not has_function_privilege('authenticated', 'public.claim_external_action(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.finish_external_action(uuid,boolean,text,text)', 'execute')
  and has_function_privilege('service_role', 'public.claim_external_action(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.request_external_action(uuid,text,jsonb)', 'execute'),
  '1c executor restrito ao service_role; anon não pede ações'
);

-- 2. Novos provedores de receita
insert into public.source_connections (organization_id, domain, provider, external_account_id)
values (:'org_a', 'owned_sales', 'hotmart', 'hm-producer'),
       (:'org_a', 'affiliate', 'hotmart', 'hm-affiliate'),
       (:'org_a', 'owned_sales', 'shopify', 'shop-1'),
       (:'org_a', 'owned_sales', 'stripe', 'acct_1');
select tests.ok(
  (select count(*) from public.source_connections where organization_id = :'org_a'
     and provider in ('hotmart', 'shopify', 'stripe')) = 4,
  '2a Hotmart (produtor e afiliado), Shopify e Stripe aceitos'
);
select tests.throws(
  format($$insert into public.source_connections (organization_id, domain, provider, external_account_id)
           values (%L, 'paid_media', 'hotmart', 'x')$$, :'org_a'),
  'source_connections_check', '2b Hotmart não entra como mídia paga');
select tests.throws(
  format($$insert into public.source_connections (organization_id, domain, provider, external_account_id)
           values (%L, 'affiliate', 'stripe', 'y')$$, :'org_a'),
  'source_connections_check', '2c Stripe só como venda própria');
insert into public.source_connections (organization_id, domain, provider, external_account_id)
values (:'org_a', 'owned_sales', 'mercado_livre', 'ml-1'), (:'org_a', 'paid_media', 'meta_ads', 'act-1');
select tests.throws(
  format($$insert into public.source_connections (organization_id, domain, provider, external_account_id)
           values (%L, 'affiliate', 'mercado_livre', 'ml-2')$$, :'org_a'),
  'source_connections_check', '2d provedores anteriores mantêm as regras de domínio');

-- 3. Regras das contas sociais
insert into public.social_accounts (id, organization_id, network, account_type, via, external_account_id, handle, status, capabilities)
values
  ('a4000000-0000-4000-8000-00000000c001', :'org_a', 'instagram', 'creator', 'metricool', 'ig-1', 'smkon', 'connected', '{publish,read_metrics}'),
  ('a4000000-0000-4000-8000-00000000c002', :'org_a', 'youtube', 'channel', 'native', 'yt-1', 'smkon', 'connected', '{publish,update_bio}'),
  ('a4000000-0000-4000-8000-00000000c003', :'org_a', 'tiktok', 'business', 'metricool', 'tt-1', 'smkon', 'pending', '{publish}'),
  ('b4000000-0000-4000-8000-00000000c001', :'org_b', 'instagram', 'business', 'metricool', 'ig-b', 'outro', 'connected', '{publish}');
select tests.throws(
  format($$insert into public.social_accounts (organization_id, network, account_type, via, external_account_id)
           values (%L, 'instagram', 'personal', 'metricool', 'ig-p')$$, :'org_a'),
  '23514', '3a Instagram pessoal recusado (exige Business/Creator)');
select tests.throws(
  format($$insert into public.social_accounts (organization_id, network, account_type, via, external_account_id)
           values (%L, 'x', 'personal', 'metricool', 'x-1')$$, :'org_a'),
  '23514', '3b X não pode ser via Metricool');
select tests.throws(
  format($$insert into public.social_accounts (organization_id, network, account_type, via, external_account_id, capabilities)
           values (%L, 'pinterest', 'business', 'metricool', 'p-1', '{delete_everything}')$$, :'org_a'),
  '23514', '3c capacidade desconhecida recusada');

-- 4. Isolamento de leitura
set local role authenticated;
select tests.login(:'viewer_a');
select tests.ok((select count(*) from public.social_accounts) = 3, '4a viewer vê só as contas do próprio workspace');
select tests.login(:'owner_b');
select tests.ok((select count(*) from public.social_accounts) = 1, '4b outro workspace vê só a sua conta');
select tests.ok((select count(*) from public.external_action_requests) = 0, '4c sem pedidos visíveis de outro workspace');

-- 5. Pedido de ação
select tests.login(:'viewer_a');
select tests.throws($$select * from public.request_external_action('a4000000-0000-4000-8000-00000000c001', 'publish_post', '{"caption":"oi"}')$$,
  'forbidden', '5a viewer não pede ações');
select tests.login(:'owner_b');
select tests.throws($$select * from public.request_external_action('a4000000-0000-4000-8000-00000000c001', 'publish_post', '{"caption":"oi"}')$$,
  'social_account_not_found', '5b outro workspace recebe "não encontrado"');
select tests.login(:'analyst_a');
select tests.throws($$select * from public.request_external_action('a4000000-0000-4000-8000-00000000c003', 'publish_post', '{"caption":"oi"}')$$,
  'social_account_not_connected', '5c conta não conectada recusada');
select tests.throws($$select * from public.request_external_action('a4000000-0000-4000-8000-00000000c001', 'update_photo', '{"url":"x"}')$$,
  'capability_not_supported', '5d foto de perfil no Instagram recusada (sem capacidade)');
select tests.throws($$select * from public.request_external_action('a4000000-0000-4000-8000-00000000c001', 'delete_account', '{}')$$,
  'invalid_action', '5e ação desconhecida recusada');

select request_id as req1, payload_hash as hash1
from public.request_external_action('a4000000-0000-4000-8000-00000000c001', 'publish_post', '{"caption":"Lançamento","media":["m1"]}') \gset
select tests.ok(:'hash1' = public.external_action_hash('publish_post', '{"caption":"Lançamento","media":["m1"]}'),
  '5f hash calculado no servidor a partir de ação + payload');
select tests.ok((select status from public.external_action_requests where id = :'req1') = 'pending_approval',
  '5g pedido nasce aguardando aprovação');

-- 6. Decisão
select tests.throws(format($$select public.decide_external_action(%L, 'approved', %L)$$, :'req1', :'hash1'),
  'forbidden', '6a analyst não aprova');
select tests.login(:'admin_a');
select tests.throws(format($$select public.decide_external_action(%L, 'approved', %L)$$, :'req1', repeat('a', 64)),
  'hash_mismatch', '6b hash diferente do exibido é recusado');
select tests.ok(public.decide_external_action(:'req1', 'approved', :'hash1', 'ok') = 'approved', '6c admin aprova com o hash exato');
select tests.ok(public.decide_external_action(:'req1', 'approved', :'hash1') = 'approved', '6d decisão repetida é idempotente');
select tests.throws(format($$select public.decide_external_action(%L, 'rejected', %L)$$, :'req1', :'hash1'),
  'action_request_closed', '6e pedido aprovado não volta a ser decidido');
select tests.ok(
  (select approved_hash = payload_hash and decided_by = :'admin_a'::uuid from public.external_action_requests where id = :'req1'),
  '6f aprovação registra quem decidiu e o hash aprovado');

-- 7. Imutabilidade (inclusive para o dono do banco)
reset role;
select tests.throws(format($$update public.external_action_requests set payload = '{"caption":"trocado"}' where id = %L$$, :'req1'),
  'action_request_immutable', '7a payload aprovado não pode ser trocado');
select tests.throws(format($$update public.external_action_requests set status = 'executed' where id = %L$$, :'req1'),
  'invalid_status_transition', '7b não pula de aprovado para executado');
select tests.throws(format($$delete from public.external_action_requests where id = %L$$, :'req1'),
  'append-only', '7c pedidos não são apagados');
select tests.throws(format($$insert into public.external_action_requests (organization_id, social_account_id, action, payload, payload_hash, requested_by, status)
                             values (%L, 'a4000000-0000-4000-8000-00000000c001', 'publish_post', '{}', repeat('0',64), %L, 'approved')$$, :'org_a', :'owner_a'),
  'invalid_initial_status', '7d pedido não nasce aprovado');

-- 8. Execução pelo service_role
set local role service_role;
select tests.ok((select status from public.claim_external_action(:'req1')) = 'executing', '8a executor reivindica pedido aprovado');
select tests.throws(format($$select public.claim_external_action(%L)$$, :'req1'),
  'action_request_not_claimable', '8b o mesmo pedido não é reivindicado duas vezes');
select public.finish_external_action(:'req1', true, 'ig-media-123');
select tests.ok((select status = 'executed' and external_ref = 'ig-media-123' and executed_at is not null
                 from public.external_action_requests where id = :'req1'), '8c execução concluída com referência externa');
reset role;

-- 9. Rejeição, cancelamento e pedido não aprovado
set local role authenticated;
select tests.login(:'analyst_a');
select request_id as req2, payload_hash as hash2
from public.request_external_action('a4000000-0000-4000-8000-00000000c002', 'update_bio', '{"bio":"nova"}') \gset
select request_id as req3 from public.request_external_action('a4000000-0000-4000-8000-00000000c001', 'publish_post', '{"caption":"b"}') \gset
reset role;
set local role service_role;
select tests.throws(format($$select public.claim_external_action(%L)$$, :'req2'),
  'action_request_not_claimable', '9a pedido não aprovado não executa');
reset role;
set local role authenticated;
select tests.login(:'owner_a');
select tests.ok(public.decide_external_action(:'req2', 'rejected', :'hash2', 'não') = 'rejected', '9b owner rejeita');
select tests.login(:'analyst_a');
select public.cancel_external_action(:'req3');
select tests.ok((select status from public.external_action_requests where id = :'req3') = 'cancelled', '9c quem pediu cancela antes da decisão');
select tests.throws(format($$select public.cancel_external_action(%L)$$, :'req2'),
  'action_request_closed', '9d pedido rejeitado não é cancelado');
reset role;

-- 10. Auditoria
select tests.ok(
  (select count(*) from public.audit_log where table_name = 'external_action_requests' and record_id = :'req1') >= 4,
  '10a criação, aprovação, execução e conclusão auditadas'
);
select tests.ok(
  not exists (select 1 from public.audit_log where table_name = 'external_action_requests' and new_data ? 'payload'),
  '10b auditoria guarda o hash, não o conteúdo do payload'
);

rollback;
