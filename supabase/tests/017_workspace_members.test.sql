-- S5.1: membros do workspace (listar, alterar papel, remover) e workspace ativo.
\set ON_ERROR_STOP 1
\set owner_a 'a7000000-0000-4000-8000-00000000000a'
\set admin_a 'a7000000-0000-4000-8000-0000000000a1'
\set analyst_a 'a7000000-0000-4000-8000-0000000000a2'
\set viewer_a 'a7000000-0000-4000-8000-0000000000a3'
\set owner_b 'b7000000-0000-4000-8000-00000000000b'
\set stranger 'c7000000-0000-4000-8000-00000000000c'
begin;

select tests.create_user(:'owner_a', 'owner-a7@smkon.test');
select tests.create_user(:'admin_a', 'Admin-A7@SMKON.test');
select tests.create_user(:'analyst_a', 'analyst-a7@smkon.test');
select tests.create_user(:'viewer_a', 'viewer-a7@smkon.test');
select tests.create_user(:'owner_b', 'owner-b7@smkon.test');
select tests.create_user(:'stranger', 'stranger-a7@smkon.test');

set local role authenticated;
select tests.login(:'owner_a');
select workspace_id as org_a from public.ensure_workspace() \gset
select tests.login(:'owner_b');
select workspace_id as org_b from public.ensure_workspace() \gset
reset role;
insert into public.organization_members (organization_id, user_id, role) values
  (:'org_a', :'admin_a', 'admin'),
  (:'org_a', :'analyst_a', 'analyst'),
  (:'org_a', :'viewer_a', 'viewer'),
  -- owner_b também é viewer de A: pertence a dois workspaces.
  (:'org_a', :'owner_b', 'viewer');

-- 1. Sem sessão / anon
set local role anon;
select tests.throws(format('select * from public.list_workspace_members(%L)', :'org_a'), '42501', '1a anon não lista membros');
select tests.throws(format('select * from public.change_member_role(%L, %L, %L)', :'org_a', :'viewer_a', 'admin'), '42501', '1b anon não altera papel');
select tests.throws(format('select public.remove_member(%L, %L)', :'org_a', :'viewer_a'), '42501', '1c anon não remove membro');
select tests.throws(format('select * from public.set_active_workspace(%L)', :'org_a'), '42501', '1d anon não escolhe workspace');
select tests.throws('select * from public.user_active_workspace', '42501', '1e anon não lê workspace ativo');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true);
select tests.throws(format('select * from public.list_workspace_members(%L)', :'org_a'), 'not_authenticated', '1f sem usuário não lista');
select tests.throws(format('select * from public.change_member_role(%L, %L, %L)', :'org_a', :'viewer_a', 'admin'), 'not_authenticated', '1g sem usuário não altera');
select tests.throws(format('select public.remove_member(%L, %L)', :'org_a', :'viewer_a'), 'not_authenticated', '1h sem usuário não remove');

-- 2. Listagem: owner/admin do próprio workspace
select tests.login(:'owner_a');
select tests.ok((select count(*) from public.list_workspace_members(:'org_a')) = 5, '2a owner lista os 5 membros');
select tests.ok(
  (select array_agg(member_role order by ord) from (
    select member_role, row_number() over () as ord from public.list_workspace_members(:'org_a')
  ) s) = array['owner', 'admin', 'analyst', 'viewer', 'viewer'],
  '2b ordem por papel'
);
select tests.ok(
  (select email from public.list_workspace_members(:'org_a') where user_id = :'admin_a') = 'admin-a7@smkon.test',
  '2c e-mail normalizado em minúsculas'
);
select tests.login(:'admin_a');
select tests.ok((select count(*) from public.list_workspace_members(:'org_a')) = 5, '2d admin lista membros');
select tests.login(:'analyst_a');
select tests.throws(format('select * from public.list_workspace_members(%L)', :'org_a'), 'forbidden', '2e analista não lista');
select tests.login(:'viewer_a');
select tests.throws(format('select * from public.list_workspace_members(%L)', :'org_a'), 'forbidden', '2f leitura não lista');
select tests.login(:'stranger');
select tests.throws(format('select * from public.list_workspace_members(%L)', :'org_a'), 'forbidden', '2g quem não é membro não lista');
select tests.login(:'owner_b');
select tests.throws(format('select * from public.list_workspace_members(%L)', :'org_a'), 'forbidden', '2h viewer de A (owner de B) não lista A');
select tests.ok((select count(*) from public.list_workspace_members(:'org_b')) = 1, '2i owner de B lista só B');

-- 3. Alterar papel: só owner
select tests.login(:'admin_a');
select tests.throws(format('select * from public.change_member_role(%L, %L, %L)', :'org_a', :'viewer_a', 'analyst'), 'forbidden', '3a admin não altera papel');
select tests.login(:'owner_b');
select tests.throws(format('select * from public.change_member_role(%L, %L, %L)', :'org_a', :'viewer_a', 'analyst'), 'forbidden', '3b owner de outro tenant não altera papel em A');
select tests.login(:'owner_a');
select tests.throws(format('select * from public.change_member_role(%L, %L, %L)', :'org_a', :'viewer_a', 'superuser'), 'invalid_member_role', '3c papel inválido');
select tests.throws(format('select * from public.change_member_role(%L, %L, %L)', :'org_a', :'viewer_a', null), 'invalid_member_role', '3d papel nulo');
select tests.throws(format('select * from public.change_member_role(%L, %L, %L)', :'org_a', :'stranger', 'viewer'), 'member_not_found', '3e não membro não é alterado');
select tests.throws(format('select * from public.change_member_role(%L, %L, %L)', :'org_b', :'owner_b', 'viewer'), 'forbidden', '3f owner de A não altera B');

select changed as c1 from public.change_member_role(:'org_a', :'viewer_a', 'analyst') \gset
select tests.ok(:'c1'::boolean, '3g viewer promovido a analista');
select changed as c2 from public.change_member_role(:'org_a', :'viewer_a', 'analyst') \gset
select tests.ok(not :'c2'::boolean, '3h mesmo papel é idempotente (changed = false)');

-- 4. Último owner
select tests.throws(format('select * from public.change_member_role(%L, %L, %L)', :'org_a', :'owner_a', 'admin'), 'last_owner', '4a último owner não se rebaixa');
select tests.throws(format('select public.remove_member(%L, %L)', :'org_a', :'owner_a'), 'last_owner', '4b último owner não se remove');
select changed as c3 from public.change_member_role(:'org_a', :'admin_a', 'owner') \gset
select tests.ok(:'c3'::boolean, '4c owner promove admin a owner');
select tests.login(:'admin_a');
select changed as c4 from public.change_member_role(:'org_a', :'owner_a', 'admin') \gset
select tests.ok(:'c4'::boolean, '4d com dois owners, um pode rebaixar o outro');
select tests.throws(format('select * from public.change_member_role(%L, %L, %L)', :'org_a', :'admin_a', 'viewer'), 'last_owner', '4e o owner restante não se rebaixa');
select tests.login(:'owner_a');
select tests.throws(format('select * from public.change_member_role(%L, %L, %L)', :'org_a', :'admin_a', 'viewer'), 'forbidden', '4f ex-owner (agora admin) perde o poder de alterar papéis');
reset role;
select tests.ok(
  (select count(*) from public.organization_members where organization_id = :'org_a' and role = 'owner') = 1,
  '4g workspace mantém exatamente um owner'
);

-- 5. Remover membro
set local role authenticated;
select tests.login(:'owner_a');
select tests.throws(format('select public.remove_member(%L, %L)', :'org_a', :'analyst_a'), 'forbidden', '5a admin não remove');
select tests.login(:'admin_a');  -- owner atual de A
select tests.throws(format('select public.remove_member(%L, %L)', :'org_a', :'stranger'), 'member_not_found', '5b não membro');
select tests.throws(format('select public.remove_member(%L, %L)', :'org_b', :'owner_b'), 'forbidden', '5c owner de A não remove em B');

-- 6. Workspace ativo
select tests.login(:'owner_b');
select tests.throws(format('select * from public.set_active_workspace(%L)', 'f7000000-0000-4000-8000-00000000000f'), 'workspace_not_found', '6a workspace inexistente');
select tests.login(:'stranger');
select tests.throws(format('select * from public.set_active_workspace(%L)', :'org_a'), 'workspace_not_found', '6b quem não é membro não escolhe A');
select tests.login(:'owner_b');
select member_role as r1 from public.set_active_workspace(:'org_a') \gset
select tests.ok(:'r1' = 'viewer', '6c owner de B escolhe A e recebe o papel de A');
select tests.ok((select organization_id from public.user_active_workspace) = :'org_a', '6d preferência lida pelo próprio usuário');
select member_role as r2 from public.set_active_workspace(:'org_b') \gset
select tests.ok(:'r2' = 'owner' and (select count(*) from public.user_active_workspace) = 1, '6e trocar de volta atualiza a mesma linha');
select tests.throws(format('insert into public.user_active_workspace (user_id, organization_id) values (%L, %L)', :'owner_b', :'org_a'), '42501', '6f sem INSERT direto');
select tests.throws(format('update public.user_active_workspace set organization_id = %L', :'org_a'), '42501', '6g sem UPDATE direto');
select tests.throws('delete from public.user_active_workspace', '42501', '6h sem DELETE direto');
select tests.login(:'owner_a');
select tests.ok((select count(*) from public.user_active_workspace) = 0, '6i preferência de outro usuário é invisível');

-- 7. Remoção apaga a preferência e encerra o acesso
select tests.login(:'owner_b');
select workspace_id from public.set_active_workspace(:'org_a') \gset
select tests.login(:'admin_a');
select public.remove_member(:'org_a', :'owner_b');
reset role;
select tests.ok(
  not exists (select 1 from public.organization_members where organization_id = :'org_a' and user_id = :'owner_b'),
  '7a membro removido'
);
select tests.ok(not exists (select 1 from public.user_active_workspace where user_id = :'owner_b'), '7b preferência apagada junto (FK em cascata)');
set local role authenticated;
select tests.login(:'owner_b');
select tests.throws(format('select * from public.set_active_workspace(%L)', :'org_a'), 'workspace_not_found', '7c ex-membro não volta a escolher A');
select tests.ok((select count(*) from public.organizations where id = :'org_a') = 0, '7d ex-membro não lê mais o workspace A');
select tests.login(:'admin_a');
select tests.throws(format('select public.remove_member(%L, %L)', :'org_a', :'owner_b'), 'member_not_found', '7e remover de novo não é idempotente silencioso');

-- 8. Auditoria
reset role;
select tests.ok(
  (select count(*) from public.audit_log
   where table_name = 'organization_members' and action = 'UPDATE' and organization_id = :'org_a') = 3,
  '8a três mudanças de papel auditadas (sem auditar o no-op)'
);
select tests.ok(
  exists (select 1 from public.audit_log
          where table_name = 'organization_members' and action = 'DELETE'
            and record_id = :'org_a' || ':' || :'owner_b' and actor_id = :'admin_a'),
  '8b remoção auditada com o ator'
);
select tests.ok(
  exists (select 1 from public.audit_log
          where table_name = 'organization_members' and action = 'UPDATE'
            and record_id = :'org_a' || ':' || :'owner_a'
            and old_data ->> 'role' = 'owner' and new_data ->> 'role' = 'admin' and actor_id = :'admin_a'),
  '8c rebaixamento auditado com papel anterior e novo'
);

-- 9. Grants: sem UPDATE/DELETE direto em organization_members
set local role authenticated;
select tests.login(:'admin_a');
select tests.throws(format('update public.organization_members set role = %L where user_id = %L', 'owner', :'analyst_a'), '42501', '9a sem UPDATE direto em membros');
select tests.throws(format('delete from public.organization_members where user_id = %L', :'analyst_a'), '42501', '9b sem DELETE direto em membros');
reset role;

rollback;
