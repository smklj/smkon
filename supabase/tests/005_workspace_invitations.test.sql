-- S5: convites de workspace. Cenários do contrato docs/INVITATIONS_AND_IDEMPOTENCY_PLAN.md.
\set ON_ERROR_STOP 1
\set owner_a 'a5000000-0000-4000-8000-00000000000a'
\set viewer_a 'a5000000-0000-4000-8000-0000000000a2'
\set owner_b 'b5000000-0000-4000-8000-00000000000b'
\set guest 'c5000000-0000-4000-8000-00000000000c'
\set intruder 'd5000000-0000-4000-8000-00000000000d'
\set unverified 'e5000000-0000-4000-8000-00000000000e'
\set hash1 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
\set hash2 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
\set hash3 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
\set hash4 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
begin;

select tests.create_user(:'owner_a', 'owner-a5@smkon.test');
select tests.create_user(:'viewer_a', 'viewer-a5@smkon.test');
select tests.create_user(:'owner_b', 'owner-b5@smkon.test');
select tests.create_user(:'guest', 'convidado@smkon.test');
select tests.create_user(:'intruder', 'intruso@smkon.test');
select tests.create_user(:'unverified', 'naoconfirmado@smkon.test');
update auth.users set email_confirmed_at = null where id = :'unverified';

set local role authenticated;
select tests.login(:'owner_a');
select workspace_id as org_a from public.ensure_workspace() \gset
select tests.login(:'owner_b');
select workspace_id as org_b from public.ensure_workspace() \gset
reset role;
insert into public.organization_members (organization_id, user_id, role) values (:'org_a', :'viewer_a', 'viewer');

-- 1. Sem sessão / anon
set local role anon;
select tests.throws(
  format('select public.create_invitation(%L, %L, %L, %L)', :'org_a', 'x@smkon.test', 'viewer', :'hash1'),
  '42501', '1a anon não executa create_invitation'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true);
select tests.throws(
  format('select public.create_invitation(%L, %L, %L, %L)', :'org_a', 'x@smkon.test', 'viewer', :'hash1'),
  'not_authenticated', '1b sem usuário na sessão'
);

-- 2. Permissão e tenant
select tests.login(:'viewer_a');
select tests.throws(
  format('select public.create_invitation(%L, %L, %L, %L)', :'org_a', 'x@smkon.test', 'viewer', :'hash1'),
  'forbidden', '2a viewer não convida'
);
select tests.login(:'owner_b');
select tests.throws(
  format('select public.create_invitation(%L, %L, %L, %L)', :'org_a', 'x@smkon.test', 'viewer', :'hash1'),
  'forbidden', '2b owner de outro tenant não convida para A'
);

-- 3. Validação de entrada
select tests.login(:'owner_a');
select tests.throws(
  format('select public.create_invitation(%L, %L, %L, %L)', :'org_a', 'x@smkon.test', 'owner', :'hash1'),
  'invalid_role', '3a papel owner não é convidável'
);
select tests.throws(
  format('select public.create_invitation(%L, %L, %L, %L)', :'org_a', 'sem-arroba', 'viewer', :'hash1'),
  'invalid_email', '3b e-mail inválido'
);
select tests.throws(
  format('select public.create_invitation(%L, %L, %L, %L)', :'org_a', 'x@smkon.test', 'viewer', 'curto'),
  'invalid_token', '3c hash de token inválido'
);
select tests.throws(
  format('select public.create_invitation(%L, %L, %L, %L)', :'org_a', 'viewer-a5@smkon.test', 'admin', :'hash1'),
  'already_member', '3d quem já é membro não é convidado'
);

-- 4. Criação normaliza o e-mail e é idempotente
select invitation_id as inv1, created as created1 from public.create_invitation(:'org_a', '  Convidado@SMKON.test ', 'analyst', :'hash1') \gset
select tests.ok(:'created1'::boolean, '4a convite criado');
select tests.ok((select email from public.organization_invitations where id = :'inv1') = 'convidado@smkon.test', '4b e-mail normalizado');
select invitation_id as inv1b, created as created1b from public.create_invitation(:'org_a', 'convidado@smkon.test', 'admin', :'hash2') \gset
select tests.ok(:'inv1b' = :'inv1' and not :'created1b'::boolean, '4c reenvio devolve o mesmo convite sem novo token');

-- 5. token_hash não é legível pela API; owner lista convites; viewer e outro tenant não
select tests.throws('select token_hash from public.organization_invitations', '42501', '5a coluna token_hash inacessível');
select tests.ok((select count(*) from public.organization_invitations where organization_id = :'org_a') = 1, '5b owner lista convites do workspace');
select tests.login(:'viewer_a');
select tests.ok((select count(*) from public.organization_invitations) = 0, '5c viewer não lista convites');
select tests.login(:'owner_b');
select tests.ok((select count(*) from public.organization_invitations where organization_id = :'org_a') = 0, '5d outro tenant não lista convites');

-- 6. Aceite: e-mail divergente, e-mail não confirmado, sucesso, replay
select tests.login(:'intruder');
select tests.throws(format('select public.accept_invitation(%L)', :'hash1'), 'invitation_email_mismatch', '6a e-mail divergente é recusado');
select tests.login(:'unverified');
select tests.throws(format('select public.accept_invitation(%L)', :'hash1'), 'email_not_verified', '6b e-mail não confirmado é recusado');
select tests.login(:'guest');
select tests.throws(format('select public.accept_invitation(%L)', :'hash2'), 'invitation_invalid', '6c hash que nunca foi gravado é inválido');
select workspace_id as joined_org, member_role as joined_role from public.accept_invitation(:'hash1') \gset
select tests.ok(:'joined_org'::uuid = :'org_a'::uuid and :'joined_role' = 'analyst', '6d aceite cria membership com o papel do convite');
select tests.ok((select count(*) from public.content_items where organization_id = :'org_a') = 0 and (select count(*) from public.organization_members where user_id = :'guest'::uuid) = 1, '6e convidado vira membro de A');
select workspace_id as again_org from public.accept_invitation(:'hash1') \gset
select tests.ok(:'again_org'::uuid = :'org_a'::uuid, '6f replay pelo mesmo usuário é idempotente');
select tests.login(:'intruder');
select tests.throws(format('select public.accept_invitation(%L)', :'hash1'), 'invitation_invalid', '6g replay por outro usuário é inválido');

-- 7. Revogação
select tests.login(:'owner_a');
select invitation_id as inv2 from public.create_invitation(:'org_a', 'intruso@smkon.test', 'viewer', :'hash3') \gset
select tests.login(:'viewer_a');
select tests.throws(format('select public.revoke_invitation(%L)', :'inv2'), 'invitation_not_found', '7a viewer não revoga');
select tests.login(:'owner_a');
select public.revoke_invitation(:'inv2');
select tests.throws(format('select public.revoke_invitation(%L)', :'inv2'), 'invitation_not_pending', '7b não revoga duas vezes');
select tests.login(:'intruder');
select tests.throws(format('select public.accept_invitation(%L)', :'hash3'), 'invitation_invalid', '7c convite revogado não é aceito');

-- 8. Expiração: convite expirado não é aceito e é substituído ao convidar de novo
reset role;
update public.organization_invitations set created_at = now() - interval '10 days', expires_at = now() - interval '3 days'
where token_hash = :'hash3';
insert into public.organization_invitations (organization_id, email, role, token_hash, invited_by, created_at, expires_at)
values (:'org_a', 'atrasado@smkon.test', 'viewer', :'hash4', :'owner_a', now() - interval '10 days', now() - interval '3 days');
select tests.create_user('f5000000-0000-4000-8000-00000000000f', 'atrasado@smkon.test');
set local role authenticated;
select tests.login('f5000000-0000-4000-8000-00000000000f');
select tests.throws(format('select public.accept_invitation(%L)', :'hash4'), 'invitation_invalid', '8a convite expirado não é aceito');
select tests.login(:'owner_a');
select created as created_after_expiry from public.create_invitation(:'org_a', 'atrasado@smkon.test', 'viewer', repeat('e', 64)) \gset
select tests.ok(:'created_after_expiry'::boolean, '8b novo convite substitui o expirado');
reset role;
select tests.ok(
  (select revoked_at is not null from public.organization_invitations where token_hash = :'hash4'),
  '8c convite expirado foi encerrado'
);

-- 9. Auditoria
select tests.ok(
  (select count(*) from public.audit_log where table_name = 'organization_invitations' and action = 'INSERT') >= 3,
  '9a criação de convites auditada'
);
select tests.ok(
  (select count(*) from public.audit_log where table_name = 'organization_invitations' and action = 'UPDATE') >= 3,
  '9b aceite, revogação e expiração auditados'
);
select tests.ok(
  (select count(*) from public.audit_log where table_name = 'organization_members' and record_id = :'org_a' || ':' || :'guest') = 1,
  '9c entrada do convidado no workspace auditada'
);

rollback;
