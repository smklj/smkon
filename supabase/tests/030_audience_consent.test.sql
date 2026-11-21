-- S15: audiência e CRM com consentimento (LGPD).
\set ON_ERROR_STOP 1
\set owner_a 'a3000000-0000-4000-8000-00000000000a'
\set admin_a 'a3000000-0000-4000-8000-0000000000a1'
\set analyst_a 'a3000000-0000-4000-8000-0000000000a2'
\set viewer_a 'a3000000-0000-4000-8000-0000000000a3'
\set owner_b 'b3000000-0000-4000-8000-00000000000b'
begin;

select tests.create_user(:'owner_a', 'owner-a30@smkon.test');
select tests.create_user(:'admin_a', 'admin-a30@smkon.test');
select tests.create_user(:'analyst_a', 'analyst-a30@smkon.test');
select tests.create_user(:'viewer_a', 'viewer-a30@smkon.test');
select tests.create_user(:'owner_b', 'owner-b30@smkon.test');
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

-- 1. Estrutura: RLS ligada, sem escrita direta, anon sem acesso
select tests.ok(
  (select bool_and(c.relrowsecurity) from pg_class c
   where c.oid in ('public.contacts'::regclass, 'public.consent_events'::regclass, 'public.data_subject_requests'::regclass)),
  '1a RLS ligada nas três tabelas'
);
select tests.ok(
  not has_table_privilege('authenticated', 'public.contacts', 'INSERT')
  and not has_table_privilege('authenticated', 'public.contacts', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.consent_events', 'INSERT')
  and not has_table_privilege('authenticated', 'public.data_subject_requests', 'INSERT')
  and not has_table_privilege('anon', 'public.contacts', 'SELECT')
  and not has_table_privilege('anon', 'public.contact_consent_state', 'SELECT'),
  '1b authenticated só lê; anon não acessa'
);
select tests.ok(
  not has_function_privilege('anon', 'public.create_contact(uuid, text, text, text, text, text, text, text, text, text, text, timestamptz)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.audience_anonymize(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.audience_insert_consent(public.contacts, text, text, text, text, text, timestamptz)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.audience_contact_for_write(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.export_contact_data(uuid)', 'EXECUTE'),
  '1c funções internas fechadas; públicas só para authenticated'
);
select tests.ok(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('create_contact', 'update_contact', 'record_consent', 'revoke_all_consents',
     'register_data_subject_request', 'resolve_data_subject_request', 'anonymize_contact', 'export_contact_data')),
  '1d funções públicas são security definer com search_path vazio'
);

-- 2. Cadastro: papéis, validação, base legal
set local role authenticated;
select tests.login(:'viewer_a');
select tests.throws(
  format('select public.create_contact(%L, ''Ana'', ''ana@exemplo.com'', null, ''manual'', null, ''marketing'', ''legitimate_interest'')', :'org_a'),
  'forbidden', '2a viewer não cadastra'
);
select tests.login(:'analyst_a');
select tests.throws(
  format('select public.create_contact(%L, ''Ana'', ''ana@exemplo.com'', null, ''manual'', null, ''marketing'', ''legitimate_interest'')', :'org_a'),
  'forbidden', '2b analyst não cadastra'
);
select tests.login(:'owner_b');
select tests.throws(
  format('select public.create_contact(%L, ''Ana'', ''ana@exemplo.com'', null, ''manual'', null, ''marketing'', ''legitimate_interest'')', :'org_a'),
  'workspace_not_found', '2c outro workspace não cadastra'
);
select tests.login(:'owner_a');
select tests.throws(
  format('select public.create_contact(%L, ''Ana'', null, null, ''manual'', null, ''marketing'', ''legitimate_interest'')', :'org_a'),
  'contact_identifier_required', '2d exige e-mail ou telefone'
);
select tests.throws(
  format('select public.create_contact(%L, null, ''nao-e-email'', null, ''manual'', null, ''marketing'', ''legitimate_interest'')', :'org_a'),
  'invalid_email', '2e e-mail inválido'
);
select tests.throws(
  format('select public.create_contact(%L, null, null, ''11999999999'', ''manual'', null, ''marketing'', ''legitimate_interest'')', :'org_a'),
  'invalid_phone', '2f telefone fora do E.164'
);
select tests.throws(
  format('select public.create_contact(%L, null, ''x@exemplo.com'', null, ''manual'', null, ''marketing'', ''consent'')', :'org_a'),
  'consent_evidence_required', '2g base consentimento exige opt-in com evidência no cadastro'
);
select tests.throws(
  format('select public.create_contact(%L, null, ''x@exemplo.com'', null, ''manual'', null, ''marketing'', ''consent'', ''email'', ''form_checkbox'', '' '')', :'org_a'),
  'consent_evidence_required', '2h opt-in sem referência de evidência é recusado'
);
select tests.throws(
  format('select public.create_contact(%L, null, ''x@exemplo.com'', null, ''manual'', null, ''order_fulfillment'', ''consent'', ''email'', ''written'', ''Termo assinado'')', :'org_a'),
  'contacts_basis_purpose', '2i pedido exige base execução de contrato'
);
select tests.throws(
  format('select public.create_contact(%L, null, ''x@exemplo.com'', null, ''manual'', null, ''marketing'', ''contract'')', :'org_a'),
  'contacts_basis_purpose', '2j contrato não justifica marketing'
);
select public.create_contact(:'org_a', '  Ana Souza ', ' Ana@Exemplo.COM ', '+5511999990000', 'form', 'Formulário da landing',
  'newsletter', 'consent', 'email', 'double_opt_in', 'Confirmação de e-mail #123', now() - interval '2 days') as ana \gset
select tests.ok(
  (select display_name = 'Ana Souza' and email = 'ana@exemplo.com' and created_by = :'owner_a'::uuid and anonymized_at is null
   from public.contacts where id = :'ana'),
  '2k cadastro normaliza nome e e-mail e registra autor'
);
select tests.ok(
  (select count(*) = 1 and bool_and(action = 'opt_in' and purpose = 'newsletter' and channel = 'email' and recorded_by = :'owner_a'::uuid)
   from public.consent_events where contact_id = :'ana'),
  '2l opt-in inicial registrado com finalidade e canal'
);
select tests.throws(
  format('select public.create_contact(%L, null, ''ANA@exemplo.com'', null, ''manual'', null, ''marketing'', ''legitimate_interest'')', :'org_a'),
  'contact_already_exists', '2m e-mail duplicado no workspace'
);
select tests.login(:'admin_a');
select public.create_contact(:'org_a', null, null, '+5521988887777', 'purchase', null, 'order_fulfillment', 'contract') as bia \gset
select tests.ok((select count(*) = 0 from public.consent_events where contact_id = :'bia'), '2n admin cadastra por contrato sem opt-in');
select tests.login(:'owner_b');
select public.create_contact(:'org_b', null, 'ana@exemplo.com', null, 'manual', null, 'marketing', 'legitimate_interest') as ana_b \gset
select tests.ok(:'ana_b' is not null, '2o o mesmo e-mail pode existir em outro workspace');

-- 3. Isolamento
select tests.ok((select count(*) = 0 from public.contacts where id = :'ana'), '3a outro workspace não vê o contato');
select tests.ok((select count(*) = 0 from public.consent_events where contact_id = :'ana'), '3b nem o histórico');
select tests.ok((select count(*) = 0 from public.contact_consent_state where contact_id = :'ana'), '3c nem o estado derivado');
select tests.throws(format('select public.record_consent(%L, ''opt_out'', ''newsletter'', ''email'', ''titular_request'')', :'ana'),
  'contact_not_found', '3d outro workspace não registra consentimento');
select tests.throws(format('select public.export_contact_data(%L)', :'ana'), 'contact_not_found', '3e outro workspace não exporta');
select tests.throws(format('select public.anonymize_contact(%L, ''motivo qualquer'')', :'ana'), 'contact_not_found', '3f outro workspace não anonimiza');
select tests.login(:'viewer_a');
select tests.ok((select count(*) = 2 from public.contacts where organization_id = :'org_a'), '3g viewer lê os contatos do workspace');
select tests.ok((select count(*) = 1 from public.contact_consent_state where contact_id = :'ana' and granted), '3h viewer lê o estado');
select tests.throws(format('select public.record_consent(%L, ''opt_out'', ''newsletter'', ''email'', ''titular_request'')', :'ana'),
  'forbidden', '3i viewer não revoga');
select tests.throws(format('select public.export_contact_data(%L)', :'ana'), 'forbidden', '3j viewer não exporta');
select tests.throws(format('select public.register_data_subject_request(%L, ''access'', ''email'')', :'ana'), 'forbidden', '3k viewer não registra pedido');

-- 4. Append-only
select tests.login(:'owner_a');
select tests.throws(format('update public.consent_events set action = ''opt_out'' where contact_id = %L', :'ana'), '42501', '4a cliente não altera evento');
select tests.throws(format('delete from public.consent_events where contact_id = %L', :'ana'), '42501', '4b cliente não apaga evento');
select tests.throws(format('update public.contacts set email = ''outra@exemplo.com'' where id = %L', :'ana'), '42501', '4c cliente não altera contato direto');
select tests.throws(format('delete from public.contacts where id = %L', :'ana'), '42501', '4d cliente não apaga contato');
reset role;
select tests.throws(format('update public.consent_events set action = ''opt_out'' where contact_id = %L', :'ana'), 'append-only', '4e nem o dono do banco altera o evento');
select tests.throws(format('delete from public.consent_events where contact_id = %L', :'ana'), 'append-only', '4f nem apaga');
select tests.throws(format('delete from public.contacts where id = %L', :'ana'), 'append-only', '4g contato não é apagado, só anonimizado');
set local role authenticated;
select tests.login(:'owner_a');

-- 5. Consentimento: estado derivado do histórico e revogação
select tests.throws(format('select public.record_consent(%L, ''opt_in'', ''marketing'', ''whatsapp'', ''written'', null)', :'ana'),
  'consent_evidence_required', '5a opt-in exige evidência');
select tests.throws(format('select public.record_consent(%L, ''opt_in'', ''marketing'', ''whatsapp'', ''unsubscribe_link'', ''link'')', :'ana'),
  'invalid_evidence_type', '5b link de descadastro não prova opt-in');
select tests.throws(format('select public.record_consent(%L, ''opt_in'', ''marketing'', ''whatsapp'', ''written'', ''Termo'', now() + interval ''1 day'')', :'ana'),
  'invalid_occurred_at', '5c data do fato no futuro');
select tests.throws(format('select public.record_consent(%L, ''opt_in'', ''marketing'', ''fax'', ''written'', ''Termo'')', :'ana'),
  'invalid_channel_consent', '5d canal inválido');
select public.record_consent(:'ana', 'opt_in', 'marketing', 'whatsapp', 'written', 'Termo assinado na feira', now() - interval '1 day');
select tests.ok(
  (select count(*) = 2 and bool_and(granted) from public.contact_consent_state where contact_id = :'ana'),
  '5e dois consentimentos ativos'
);
select public.record_consent(:'ana', 'opt_out', 'marketing', 'whatsapp', 'titular_request', null);
select tests.ok(
  (select not granted from public.contact_consent_state where contact_id = :'ana' and purpose = 'marketing' and channel = 'whatsapp'),
  '5f revogação vira o estado para não concedido'
);
select tests.ok(
  (select count(*) = 2 from public.consent_events where contact_id = :'ana' and purpose = 'marketing'),
  '5g o opt-in continua no histórico'
);
-- Opt-in registrado depois, mas com data do fato anterior à revogação, não reativa.
select public.record_consent(:'ana', 'opt_in', 'marketing', 'whatsapp', 'written', 'Termo antigo encontrado', now() - interval '3 days');
select tests.ok(
  (select not granted from public.contact_consent_state where contact_id = :'ana' and purpose = 'marketing' and channel = 'whatsapp'),
  '5h estado segue a data do fato, não a ordem de registro'
);
select tests.ok((select public.revoke_all_consents(:'ana', 'titular_request', 'Pediu por e-mail para sair de tudo')) = 1,
  '5i revogar tudo cria opt-out só onde havia consentimento ativo');
select tests.ok((select count(*) = 0 from public.contact_consent_state where contact_id = :'ana' and granted), '5j nada ativo após revogar tudo');

-- 6. Pedidos do titular
select tests.throws(format('select public.register_data_subject_request(%L, ''portabilidade'', ''email'')', :'ana'), 'invalid_request_kind', '6a tipo inválido');
select tests.throws(format('select public.register_data_subject_request(%L, ''access'', ''email'', null, now() + interval ''2 days'')', :'ana'), 'invalid_received_at', '6b recebimento no futuro');
select public.register_data_subject_request(:'ana', 'access', 'email', 'Quero saber quais dados vocês têm', now() - interval '20 days') as req_access \gset
select tests.ok(
  (select due_at = received_at + interval '15 days' and status = 'open' and due_at < now() from public.data_subject_requests where id = :'req_access'),
  '6c prazo de 15 dias calculado (e vencido neste caso)'
);
select tests.throws(format('select public.resolve_data_subject_request(%L, ''rejected'', null)', :'req_access'), 'resolution_note_required', '6d recusa exige motivo');
select tests.login(:'viewer_a');
select tests.throws(format('select public.resolve_data_subject_request(%L, ''completed'', null)', :'req_access'), 'forbidden', '6e viewer não resolve');
select tests.login(:'owner_b');
select tests.throws(format('select public.resolve_data_subject_request(%L, ''completed'', null)', :'req_access'), 'request_not_found', '6f outro workspace não resolve');
select tests.login(:'owner_a');
select public.resolve_data_subject_request(:'req_access', 'completed', 'Exportação enviada ao titular');
select tests.throws(format('select public.resolve_data_subject_request(%L, ''rejected'', ''de novo'')', :'req_access'), 'request_already_resolved', '6g pedido resolvido não muda');
reset role;
select tests.throws(format('update public.data_subject_requests set status = ''open'', resolved_at = null, resolved_by = null where id = %L', :'req_access'),
  'request_already_resolved', '6h nem o dono do banco reabre');
select tests.throws(format('delete from public.data_subject_requests where id = %L', :'req_access'), 'append-only', '6i pedido não é apagado');
set local role authenticated;
select tests.login(:'owner_a');

-- Correção
select public.register_data_subject_request(:'ana', 'correction', 'form', 'Meu nome é Ana S. Lima') as req_fix \gset
select public.update_contact(:'ana', 'Ana S. Lima', 'ana@exemplo.com', '+5511999990000', 'newsletter', 'consent');
select public.resolve_data_subject_request(:'req_fix', 'completed', 'Nome corrigido');
select tests.ok((select display_name = 'Ana S. Lima' and updated_by = :'owner_a'::uuid from public.contacts where id = :'ana'), '6j correção aplicada');
select tests.throws(format('select public.update_contact(%L, null, ''ana@exemplo.com'', null, ''order_fulfillment'', ''consent'')', :'ana'),
  'contacts_basis_purpose', '6k correção respeita a regra de base legal');

-- 7. Exportação
select public.export_contact_data(:'ana') as export \gset
select tests.ok(
  (:'export'::jsonb ->> 'format') = 'smkon.contact_export.v1'
  and (:'export'::jsonb -> 'contact' ->> 'email') = 'ana@exemplo.com'
  and jsonb_array_length(:'export'::jsonb -> 'consent_events') = 5
  and jsonb_array_length(:'export'::jsonb -> 'data_subject_requests') = 2
  and jsonb_array_length(:'export'::jsonb -> 'consent_state') = 2,
  '7a exportação traz contato, histórico, estado e pedidos'
);
reset role;
select tests.ok(
  (select count(*) = 1 from public.audit_log where table_name = 'contact_exports' and record_id = :'ana' and actor_id = :'owner_a'::uuid),
  '7b exportação registrada na auditoria'
);
select tests.ok(
  (select count(*) = 0 from public.audit_log
   where table_name in ('contacts', 'consent_events', 'data_subject_requests')
     and (coalesce(old_data, '{}') ?| array['email', 'phone', 'display_name', 'evidence_ref', 'details', 'resolution_note']
          or coalesce(new_data, '{}') ?| array['email', 'phone', 'display_name', 'evidence_ref', 'details', 'resolution_note'])),
  '7c auditoria não guarda dado pessoal'
);
select tests.ok(
  (select count(*) >= 1 from public.audit_log where table_name = 'contacts' and record_id = :'ana' and action = 'UPDATE'
   and new_data -> 'pii_fields_changed' ? 'display_name'),
  '7d auditoria registra quais campos pessoais mudaram, sem o valor'
);
set local role authenticated;

-- 8. Exclusão = anonimização
select tests.login(:'owner_a');
select public.record_consent(:'ana', 'opt_in', 'research', 'email', 'form_checkbox', 'Pesquisa NPS, caixa desmarcada por padrão');
select public.register_data_subject_request(:'ana', 'deletion', 'email', 'Apaguem meus dados, Ana S. Lima') as req_del \gset
select tests.login(:'admin_a');
select public.resolve_data_subject_request(:'req_del', 'completed', 'Pedido de exclusão atendido');
select tests.ok(
  (select display_name is null and email is null and phone is null and source_detail is null
          and anonymized_at is not null and anonymized_by = :'admin_a'::uuid
          and purpose = 'newsletter' and legal_basis = 'consent' and source = 'form'
   from public.contacts where id = :'ana'),
  '8a dados pessoais removidos; origem, finalidade e base legal preservadas'
);
select tests.ok(
  (select count(*) >= 7 and bool_and(evidence_ref is null) from public.consent_events where contact_id = :'ana'),
  '8b histórico de consentimento preservado sem referência pessoal'
);
select tests.ok(
  (select count(*) = 0 from public.contact_consent_state where contact_id = :'ana' and granted),
  '8c anonimização revoga o que estava ativo'
);
select tests.ok(
  (select count(*) = 3 and bool_and(details is null) from public.data_subject_requests where contact_id = :'ana'),
  '8d pedidos preservados sem o texto do titular'
);
select tests.ok(
  (select status = 'completed' and resolved_by = :'admin_a'::uuid from public.data_subject_requests where id = :'req_del'),
  '8e pedido de exclusão concluído'
);
select tests.throws(format('select public.record_consent(%L, ''opt_in'', ''newsletter'', ''email'', ''written'', ''Termo'')', :'ana'), 'contact_anonymized', '8f anonimizado não recebe consentimento');
select tests.throws(format('select public.update_contact(%L, ''Ana'', ''ana@exemplo.com'', null, ''newsletter'', ''consent'')', :'ana'), 'contact_anonymized', '8g anonimizado não volta a ter dado');
select tests.throws(format('select public.anonymize_contact(%L, ''de novo'')', :'ana'), 'contact_anonymized', '8h anonimização acontece uma vez');
select tests.ok(
  ((public.export_contact_data(:'ana')) -> 'contact' ->> 'email') is null,
  '8i exportação após anonimização não traz dado pessoal'
);
reset role;
select tests.ok(
  (select count(*) = 0 from public.audit_log
   where (table_name in ('contacts', 'consent_events', 'data_subject_requests') and record_id in (:'ana', :'req_del'))
     and (old_data::text like '%ana@exemplo.com%' or new_data::text like '%ana@exemplo.com%'
          or old_data::text like '%Ana S. Lima%' or new_data::text like '%Ana S. Lima%')),
  '8j nenhum vestígio do e-mail ou do nome na auditoria'
);
select tests.throws(format('update public.contacts set email = ''volta@exemplo.com'' where id = %L', :'ana'), 'contact_anonymized', '8k nem o dono do banco reidentifica');
set local role authenticated;

-- O e-mail fica livre para um novo cadastro com novo consentimento.
select tests.login(:'owner_a');
select public.create_contact(:'org_a', null, 'ana@exemplo.com', null, 'manual', null, 'marketing', 'legitimate_interest') as ana2 \gset
select tests.ok(:'ana2' <> :'ana', '8l e-mail anonimizado pode ser cadastrado de novo como novo contato');

-- Exclusão direta (UI): cria e conclui um pedido interno
select tests.throws(format('select public.anonymize_contact(%L, ''x'')', :'bia'), 'resolution_note_required', '8m exclusão direta exige motivo');
select public.anonymize_contact(:'bia', 'Duplicado, cadastro de teste') as req_bia \gset
select tests.ok(
  (select kind = 'deletion' and received_via = 'internal' and status = 'completed' from public.data_subject_requests where id = :'req_bia')
  and (select anonymized_at is not null and phone is null from public.contacts where id = :'bia'),
  '8n exclusão direta deixa pedido interno concluído e contato anonimizado'
);

rollback;
