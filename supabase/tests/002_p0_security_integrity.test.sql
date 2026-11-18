-- P0: bootstrap de workspace, aprovação da versão exata, auditoria, imutabilidade e isolamento.
-- SQL puro (sem pgTAP). Executar com scripts/test-db.sh após aplicar as migrations.
-- Cada bloco corresponde a um cenário do docs/S1_HANDOFF_VALIDACAO.md (seção 2.2).
\set ON_ERROR_STOP 1
\set user_a 'aaaaaaaa-0000-4000-8000-00000000000a'
\set user_b 'bbbbbbbb-0000-4000-8000-00000000000b'
\set user_v 'cccccccc-0000-4000-8000-00000000000c'
begin;

select tests.create_user(:'user_a', 'owner-a@smkon.test');
select tests.create_user(:'user_b', 'owner-b@smkon.test');
select tests.create_user(:'user_v', 'viewer-a@smkon.test');

-- ---------------------------------------------------------------------------
-- 1. ensure_workspace(): cria organização + owner e é idempotente
-- ---------------------------------------------------------------------------
set local role authenticated;
select tests.login(:'user_a');

select workspace_id as org_a, member_role as role_a from public.ensure_workspace() \gset
select tests.ok(:'role_a' = 'owner', '1a usuário novo vira owner do próprio workspace');
select tests.ok((select workspace_id from public.ensure_workspace()) = :'org_a'::uuid, '1b segunda chamada devolve o mesmo workspace');
select tests.ok((select count(*) from public.organization_members where user_id = :'user_a'::uuid) = 1, '1c exatamente uma membership');
select tests.ok((select count(*) from public.organizations where id = :'org_a'::uuid) = 1, '1d owner lê a própria organização');

reset role;
select tests.ok((select count(*) from public.organizations where created_by = :'user_a'::uuid) = 1, '1e nenhuma organização duplicada');
select tests.ok(
  (select count(*) from public.audit_log where organization_id = :'org_a'::uuid and table_name in ('organizations', 'organization_members') and action = 'INSERT') = 2,
  '1f bootstrap registrado na auditoria'
);

-- ---------------------------------------------------------------------------
-- 2. Sem INSERT direto nas tabelas de tenant
-- ---------------------------------------------------------------------------
set local role authenticated;
select tests.login(:'user_a');
select tests.throws(
  format('insert into public.organizations (name, slug, created_by) values (%L, %L, %L)', 'Outra', 'outra-org', :'user_a'),
  '42501', '2a authenticated não insere em organizations'
);
select tests.throws(
  format('insert into public.organization_members (organization_id, user_id, role) values (%L, %L, %L)', :'org_a', :'user_b', 'admin'),
  '42501', '2b authenticated não insere em organization_members'
);

-- ---------------------------------------------------------------------------
-- 3. Conteúdo não nasce aprovado
-- ---------------------------------------------------------------------------
select tests.throws(
  format('insert into public.content_items (organization_id, created_by, title, status) values (%L, %L, %L, %L)', :'org_a', :'user_a', 'Atalho', 'approved'),
  'approval_required', '3 insert com status approved é recusado'
);

-- ---------------------------------------------------------------------------
-- 4. Versão 1, hash SHA-256 e snapshot
-- ---------------------------------------------------------------------------
insert into public.content_items (organization_id, created_by, title, product, script)
values (:'org_a', :'user_a', 'Review fone ANC', 'Fone X', 'roteiro v1')
returning id as item1, content_hash as hash1, version as v1 \gset

select tests.ok(:v1 = 1, '4a primeira versão = 1');
select tests.ok(:'hash1' ~ '^[a-f0-9]{64}$', '4b hash SHA-256 em hexadecimal');
select tests.ok((select count(*) from public.content_versions where content_item_id = :'item1'::uuid) = 1, '4c snapshot da versão 1');

-- ---------------------------------------------------------------------------
-- 5. approve_content(): só com o hash exato; registra decisão e auditoria; idempotente
-- ---------------------------------------------------------------------------
select tests.throws(
  format('select public.approve_content(%L, %L)', :'item1', repeat('0', 64)),
  'hash_mismatch', '5a hash diferente é recusado'
);

select approved_version as av1 from public.approve_content(:'item1', :'hash1') \gset
select tests.ok(:av1 = 1, '5b aprova a versão 1');
select tests.ok((select status from public.content_items where id = :'item1'::uuid) = 'approved', '5c status approved');
select tests.ok(
  (select approved_version = 1 and approved_by = :'user_a'::uuid and approved_at is not null from public.content_items where id = :'item1'::uuid),
  '5d campos de aprovação preenchidos'
);
select tests.ok((select count(*) from public.content_approvals where content_item_id = :'item1'::uuid) = 1, '5e uma decisão registrada');

select public.approve_content(:'item1', :'hash1');
select tests.ok((select count(*) from public.content_approvals where content_item_id = :'item1'::uuid) = 1, '5f reaprovar a mesma versão é idempotente');
select tests.ok(
  (select count(*) from public.audit_log where table_name = 'content_items' and record_id = :'item1' and action = 'APPROVE') = 1,
  '5g evento APPROVE na auditoria (visível ao owner)'
);

-- ---------------------------------------------------------------------------
-- 6. Editar conteúdo aprovado cria versão nova e remove a aprovação
-- ---------------------------------------------------------------------------
update public.content_items set script = 'roteiro v2' where id = :'item1';
select tests.ok(
  (select version = 2 and status = 'draft' and approved_version is null and approved_by is null and approved_at is null
   from public.content_items where id = :'item1'::uuid),
  '6a edição gera v2 em rascunho, sem aprovação'
);
select tests.ok((select content_hash <> :'hash1' from public.content_items where id = :'item1'::uuid), '6b hash muda com o conteúdo');
select tests.ok((select count(*) from public.content_versions where content_item_id = :'item1'::uuid) = 2, '6c snapshot da versão 2');

update public.content_items set status = 'draft' where id = :'item1';
select tests.ok((select version from public.content_items where id = :'item1'::uuid) = 2, '6d salvar sem mudar conteúdo não cria versão');

-- ---------------------------------------------------------------------------
-- 7. Status approved não pode ser gravado diretamente
-- ---------------------------------------------------------------------------
select tests.throws(
  format('update public.content_items set status = %L where id = %L', 'approved', :'item1'),
  'approval_required', '7a update direto para approved é recusado'
);
-- Voltar ao texto da v1 não reaproveita a aprovação antiga (versão diferente).
update public.content_items set script = 'roteiro v1' where id = :'item1';
select tests.throws(
  format('update public.content_items set status = %L where id = %L', 'approved', :'item1'),
  'approval_required', '7b aprovação da v1 não vale para a v3 com o mesmo texto'
);

select content_hash as hash3 from public.content_items where id = :'item1' \gset

-- ---------------------------------------------------------------------------
-- 8. Papéis e tenants: viewer não aprova; outro tenant não enxerga
-- ---------------------------------------------------------------------------
reset role;
insert into public.organization_members (organization_id, user_id, role) values (:'org_a', :'user_v', 'viewer');

set local role authenticated;
select tests.login(:'user_v');
select tests.ok((select count(*) from public.content_items where id = :'item1'::uuid) = 1, '8a viewer lê o conteúdo do workspace');
select tests.throws(format('select public.approve_content(%L, %L)', :'item1', :'hash3'), 'forbidden', '8b viewer não aprova');
-- 8c: RLS de UPDATE não gera erro para quem não pode editar; a linha simplesmente não muda (verificado em 8d).
update public.content_items set title = 'alterado pelo viewer' where id = :'item1';
select tests.login(:'user_a');
select tests.ok((select title from public.content_items where id = :'item1'::uuid) = 'Review fone ANC', '8d viewer não altera conteúdo (RLS)');

select tests.login(:'user_b');
select workspace_id as org_b from public.ensure_workspace() \gset
select tests.ok(:'org_b'::uuid <> :'org_a'::uuid, '8e tenant B recebe workspace próprio');
select tests.throws(format('select public.approve_content(%L, %L)', :'item1', :'hash3'), 'content_not_found', '8f outro tenant recebe content_not_found');

-- ---------------------------------------------------------------------------
-- 9. Exclusão: conteúdo com aprovação não pode ser apagado; sem aprovação, apaga com histórico
-- ---------------------------------------------------------------------------
select tests.login(:'user_a');
select tests.throws(format('delete from public.content_items where id = %L', :'item1'), '23503', '9a conteúdo com aprovação registrada não é apagado');

insert into public.content_items (organization_id, created_by, title)
values (:'org_a', :'user_a', 'Rascunho descartável')
returning id as item2 \gset
delete from public.content_items where id = :'item2';

reset role;
select tests.ok((select count(*) from public.content_items where id = :'item2'::uuid) = 0, '9b rascunho sem aprovação é apagado');
select tests.ok((select count(*) from public.content_versions where content_item_id = :'item2'::uuid) = 0, '9c versões do rascunho removidas em cascata');
select tests.ok((select count(*) from public.audit_log where record_id = :'item2' and action = 'DELETE') = 1, '9d exclusão registrada na auditoria');

-- Conteúdo arquivado não pode ser aprovado.
set local role authenticated;
select tests.login(:'user_a');
update public.content_items set status = 'archived' where id = :'item1';
select tests.throws(format('select public.approve_content(%L, %L)', :'item1', :'hash3'), 'content_archived', '9e arquivado não é aprovado');

-- ---------------------------------------------------------------------------
-- 10. Registros append-only, inclusive para o superusuário
-- ---------------------------------------------------------------------------
select tests.throws(
  format(
    'insert into public.financial_ledger_entries (organization_id, domain, entry_type, source_table, source_id, currency, amount, effective_at) values (%L, %L, %L, %L, %L, %L, %s, now())',
    :'org_a', 'owned_sales', 'sales_gross', 'sales_orders', gen_random_uuid(), 'BRL', 10
  ),
  '42501', '10a authenticated não grava no ledger'
);

reset role;
insert into public.financial_ledger_entries (organization_id, domain, entry_type, source_table, source_id, currency, amount, effective_at)
values (:'org_a', 'owned_sales', 'sales_gross', 'sales_orders', gen_random_uuid(), 'BRL', 10, now())
returning id as ledger1 \gset

select tests.throws(format('update public.financial_ledger_entries set amount = 0 where id = %L', :'ledger1'), '42501', '10b ledger não é alterado');
select tests.throws(format('delete from public.financial_ledger_entries where id = %L', :'ledger1'), '42501', '10c ledger não é apagado');
select tests.throws('update public.audit_log set action = ''DELETE''', '42501', '10d audit_log não é alterado');
select tests.throws('delete from public.audit_log', '42501', '10e audit_log não é apagado');
select tests.throws(format('update public.content_versions set snapshot = ''{}'' where content_item_id = %L', :'item1'), '42501', '10f content_versions não é alterado');
select tests.throws(format('delete from public.content_versions where content_item_id = %L', :'item1'), '42501', '10g content_versions não é apagado diretamente');
select tests.throws(format('update public.content_approvals set decision = ''rejected'' where content_item_id = %L', :'item1'), '42501', '10h content_approvals não é alterado');
select tests.throws(format('delete from public.content_approvals where content_item_id = %L', :'item1'), '42501', '10i content_approvals não é apagado');

-- ---------------------------------------------------------------------------
-- 11. Isolamento entre tenants e leitura da auditoria por papel
-- ---------------------------------------------------------------------------
set local role authenticated;
select tests.login(:'user_b');
select tests.ok((select count(*) from public.content_items where organization_id = :'org_a'::uuid) = 0, '11a B não lê conteúdo de A');
select tests.ok((select count(*) from public.content_versions where organization_id = :'org_a'::uuid) = 0, '11b B não lê versões de A');
select tests.ok((select count(*) from public.content_approvals where organization_id = :'org_a'::uuid) = 0, '11c B não lê aprovações de A');
select tests.ok((select count(*) from public.audit_log where organization_id = :'org_a'::uuid) = 0, '11d B não lê auditoria de A');
select tests.ok((select count(*) from public.financial_ledger_entries where organization_id = :'org_a'::uuid) = 0, '11e B não lê ledger de A');

select tests.login(:'user_v');
select tests.ok((select count(*) from public.audit_log) = 0, '11f viewer não lê a auditoria');

select tests.login(:'user_a');
select tests.ok((select count(*) from public.audit_log where organization_id = :'org_a'::uuid) > 0, '11g owner lê a auditoria do próprio tenant');

-- ---------------------------------------------------------------------------
-- 12. Campos de identidade e propriedade são imutáveis
-- ---------------------------------------------------------------------------
update public.content_items set status = 'draft' where id = :'item1';
update public.content_items set organization_id = :'org_b', created_by = :'user_b' where id = :'item1';
reset role;
select tests.ok(
  (select organization_id = :'org_a'::uuid and created_by = :'user_a'::uuid from public.content_items where id = :'item1'::uuid),
  '12 organization_id e created_by não mudam'
);

rollback;
