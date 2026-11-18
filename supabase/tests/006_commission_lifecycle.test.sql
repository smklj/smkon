-- S8: ciclo de vida das comissões de afiliado, histórico e ledger.
\set ON_ERROR_STOP 1
\set owner_a 'a8000000-0000-4000-8000-00000000000a'
\set viewer_a 'a8000000-0000-4000-8000-0000000000a2'
\set owner_b 'b8000000-0000-4000-8000-00000000000b'
begin;

-- 1. Enum e tipos de lançamento
select tests.ok(
  (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e
   where e.enumtypid = 'public.smkon_commission_status'::regtype)
  @> array['pending', 'approved', 'settled', 'paid', 'cancelled', 'reversed'],
  '1a enum tem prevista, aprovada, liquidada, paga, cancelada e estornada'
);
select tests.ok(
  (select count(*) from pg_constraint
   where conrelid = 'public.financial_ledger_entries'::regclass and conname = 'financial_ledger_entries_entry_type_check'
     and pg_get_constraintdef(oid) like '%affiliate_commission_settled%'
     and pg_get_constraintdef(oid) like '%affiliate_commission_cancelled%') = 1,
  '1b ledger aceita os novos tipos de lançamento (constraint única, atualizada)'
);

-- Fixture: dois tenants, um viewer em A, conexão de afiliado em A.
select tests.create_user(:'owner_a', 'owner-a8@smkon.test');
select tests.create_user(:'viewer_a', 'viewer-a8@smkon.test');
select tests.create_user(:'owner_b', 'owner-b8@smkon.test');
set local role authenticated;
select tests.login(:'owner_a');
select workspace_id as org_a from public.ensure_workspace() \gset
select tests.login(:'owner_b');
select workspace_id as org_b from public.ensure_workspace() \gset
reset role;
insert into public.organization_members (organization_id, user_id, role) values (:'org_a', :'viewer_a', 'viewer');
insert into public.source_connections (organization_id, domain, provider, external_account_id, status)
values (:'org_a', 'affiliate', 'amazon_associates', 'assoc-a', 'connected')
returning id as conn_a \gset

-- 2. Inserção: prevista gera histórico e lançamento positivo
set local role authenticated;
select tests.login(:'owner_a');
insert into public.affiliate_conversions (organization_id, connection_id, provider, external_conversion_id, currency, order_amount, commission_amount, occurred_at)
values (:'org_a', :'conn_a', 'amazon_associates', 'conv-1', 'BRL', 200, 10, now())
returning id as conv1 \gset
select tests.ok((select status::text from public.affiliate_conversions where id = :'conv1') = 'pending', '2a nasce prevista');
select tests.ok((select count(*) from public.affiliate_commission_status_history where conversion_id = :'conv1') = 1, '2b histórico da criação');
select tests.ok(
  (select amount = 10 and domain::text = 'affiliate' from public.financial_ledger_entries where source_id = :'conv1' and entry_type = 'affiliate_commission_pending'),
  '2c lançamento prevista +10 no domínio afiliado'
);

-- 3. Valores podem mudar enquanto prevista; travam depois
update public.affiliate_conversions set commission_amount = 12 where id = :'conv1';
select tests.ok((select commission_amount = 12 from public.affiliate_conversions where id = :'conv1'), '3a valor ajustável enquanto prevista');

-- 4. Caminho completo: aprovada → liquidada → paga
update public.affiliate_conversions set status = 'approved' where id = :'conv1';
select tests.throws(format('update public.affiliate_conversions set commission_amount = 99 where id = %L', :'conv1'), 'commission_amount_locked', '4a valor travado após aprovação');
select tests.throws(format('update public.affiliate_conversions set currency = %L where id = %L', 'USD', :'conv1'), 'commission_amount_locked', '4b moeda travada após aprovação');
update public.affiliate_conversions set status = 'settled' where id = :'conv1';
update public.affiliate_conversions set status = 'paid' where id = :'conv1';
select tests.ok(
  (select array_agg(to_status order by changed_at, id) from public.affiliate_commission_status_history where conversion_id = :'conv1')
  = array['pending', 'approved', 'settled', 'paid'],
  '4c histórico registra cada estado na ordem'
);
select tests.ok(
  (select array_agg(entry_type || '=' || amount::numeric(18,2) order by entry_type) from public.financial_ledger_entries where source_id = :'conv1')
  = array['affiliate_commission_approved=12.00', 'affiliate_commission_paid=12.00', 'affiliate_commission_pending=10.00', 'affiliate_commission_settled=12.00'],
  '4d um lançamento por estado, com o valor vigente na transição'
);

-- 5. Transições inválidas
insert into public.affiliate_conversions (organization_id, connection_id, provider, external_conversion_id, currency, commission_amount, occurred_at)
values (:'org_a', :'conn_a', 'amazon_associates', 'conv-2', 'BRL', 5, now())
returning id as conv2 \gset
select tests.throws(format('update public.affiliate_conversions set status = %L where id = %L', 'paid', :'conv2'), 'invalid_commission_transition', '5a prevista não pula para paga');
select tests.throws(format('update public.affiliate_conversions set status = %L where id = %L', 'settled', :'conv2'), 'invalid_commission_transition', '5b prevista não pula para liquidada');
select tests.throws(format('update public.affiliate_conversions set status = %L where id = %L', 'reversed', :'conv2'), 'invalid_commission_transition', '5c prevista não é estornada (é cancelada)');
update public.affiliate_conversions set status = 'cancelled' where id = :'conv2';
select tests.ok(
  (select amount = -5 from public.financial_ledger_entries where source_id = :'conv2' and entry_type = 'affiliate_commission_cancelled'),
  '5d cancelamento lança -5'
);
select tests.throws(format('update public.affiliate_conversions set status = %L where id = %L', 'approved', :'conv2'), 'invalid_commission_transition', '5e cancelada é final');

-- 6. Estorno depois de paga
update public.affiliate_conversions set status = 'reversed' where id = :'conv1';
select tests.ok(
  (select amount = -12 from public.financial_ledger_entries where source_id = :'conv1' and entry_type = 'affiliate_commission_reversed'),
  '6a estorno lança -12'
);
select tests.throws(format('update public.affiliate_conversions set status = %L where id = %L', 'paid', :'conv1'), 'invalid_commission_transition', '6b estornada é final');

-- 7. Salvar sem mudar o estado não gera histórico nem lançamento
insert into public.affiliate_conversions (organization_id, connection_id, provider, external_conversion_id, currency, commission_amount, occurred_at)
values (:'org_a', :'conn_a', 'amazon_associates', 'conv-3', 'BRL', 7, now())
returning id as conv3 \gset
update public.affiliate_conversions set tracking_id = 'tag-1' where id = :'conv3';
select tests.ok((select count(*) from public.affiliate_commission_status_history where conversion_id = :'conv3') = 1, '7a sem novo histórico');
select tests.ok((select count(*) from public.financial_ledger_entries where source_id = :'conv3') = 1, '7b sem novo lançamento');

-- 8. Sem valor de comissão: histórico sim, ledger não
insert into public.affiliate_conversions (organization_id, connection_id, provider, external_conversion_id, currency, occurred_at)
values (:'org_a', :'conn_a', 'amazon_associates', 'conv-4', 'BRL', now())
returning id as conv4 \gset
select tests.ok((select count(*) from public.affiliate_commission_status_history where conversion_id = :'conv4') = 1, '8a histórico sem valor');
select tests.ok((select count(*) from public.financial_ledger_entries where source_id = :'conv4') = 0, '8b nenhum lançamento sem valor');

-- 9. Identidade imutável
update public.affiliate_conversions set external_conversion_id = 'outro', provider = 'x', organization_id = :'org_b' where id = :'conv3';
select tests.ok(
  (select external_conversion_id = 'conv-3' and provider = 'amazon_associates' and organization_id = :'org_a'::uuid from public.affiliate_conversions where id = :'conv3'),
  '9 identidade e tenant não mudam'
);

-- 10. Resumo por estado (RLS de quem consulta)
select tests.ok(
  (select conversions = 4 and forecast_amount = 7 and cancelled_amount = 5 and reversed_amount = 12 and paid_amount = 0
   from public.affiliate_commission_summary where organization_id = :'org_a' and currency = 'BRL'),
  '10a resumo do owner por estado'
);
select tests.login(:'viewer_a');
select tests.ok((select count(*) from public.affiliate_commission_summary where organization_id = :'org_a') = 1, '10b viewer lê o resumo');
update public.affiliate_conversions set status = 'approved' where id = :'conv3';
select tests.ok((select status::text from public.affiliate_conversions where id = :'conv3') = 'pending', '10c viewer não muda estado (RLS)');
select tests.login(:'owner_b');
select tests.ok((select count(*) from public.affiliate_commission_summary where organization_id = :'org_a') = 0, '10d outro tenant não vê o resumo');
select tests.ok((select count(*) from public.affiliate_commission_status_history where organization_id = :'org_a') = 0, '10e outro tenant não vê o histórico');
set local role anon;
select tests.throws('select * from public.affiliate_commission_summary', '42501', '10f anon não lê o resumo');

-- 11. Histórico e ledger append-only, inclusive para o superusuário
reset role;
select tests.throws(format('update public.affiliate_commission_status_history set to_status = %L where conversion_id = %L', 'paid', :'conv2'), '42501', '11a histórico não é alterado');
select tests.throws(format('delete from public.affiliate_commission_status_history where conversion_id = %L', :'conv2'), '42501', '11b histórico não é apagado');
select tests.throws(format('update public.financial_ledger_entries set amount = 0 where source_id = %L', :'conv2'), '42501', '11c ledger continua imutável');
set local role authenticated;
select tests.login(:'owner_a');
select tests.throws('insert into public.affiliate_commission_status_history (organization_id, conversion_id, to_status, currency) values (gen_random_uuid(), gen_random_uuid(), ''paid'', ''BRL'')', '42501', '11d authenticated não grava histórico direto');
reset role;

rollback;
