-- S10a: calendário e fila de publicação em dry-run.
\set ON_ERROR_STOP 1
\set owner_a 'aa000000-0000-4000-8000-00000000000a'
\set viewer_a 'aa000000-0000-4000-8000-0000000000a2'
\set owner_b 'ba000000-0000-4000-8000-00000000000b'
begin;

select tests.create_user(:'owner_a', 'owner-a10@smkon.test');
select tests.create_user(:'viewer_a', 'viewer-a10@smkon.test');
select tests.create_user(:'owner_b', 'owner-b10@smkon.test');
set local role authenticated;
select tests.login(:'owner_a');
select workspace_id as org_a from public.ensure_workspace() \gset
select tests.login(:'owner_b');
select workspace_id as org_b from public.ensure_workspace() \gset
reset role;
insert into public.organization_members (organization_id, user_id, role) values (:'org_a', :'viewer_a', 'viewer');

-- Mídia com licença própria (S10b): arquivo no Storage, registro e licença.
select :'org_a' || '/' || gen_random_uuid() || '.mp4' as media_path \gset
insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
values ('content-media', :'media_path', :'owner_a', :'owner_a', '{"mimetype": "video/mp4", "size": 1000}');

set local role authenticated;
select tests.login(:'owner_a');
select public.register_media_asset(:'media_path', 'peca.mp4') as media_id \gset
insert into public.media_licenses (organization_id, media_asset_id, license_type, licensor, allows_commercial_use, allows_modification)
values (:'org_a', :'media_id', 'own_production', 'Equipe SMKON', true, true);
insert into public.content_items (organization_id, created_by, title, caption, hashtags, channels, media_asset_id)
values (:'org_a', :'owner_a', 'Peça S10', 'Legenda curta', '#a #b', array['Instagram','YouTube'], :'media_id')
returning id as item, content_hash as hash1 \gset

-- 1. Só conteúdo aprovado entra na fila
select tests.throws(
  format('select public.schedule_publication(%L, ''Instagram'', now() + interval ''1 day'')', :'item'),
  'approval_required', '1a rascunho não é agendado'
);
select public.approve_content(:'item', :'hash1');
select tests.throws(
  format('select public.schedule_publication(%L, ''TikTok'', now() + interval ''1 day'')', :'item'),
  'invalid_channel', '1b canal fora da peça é recusado'
);
select tests.throws(
  format('select public.schedule_publication(%L, ''Instagram'', now() - interval ''1 hour'')', :'item'),
  'invalid_schedule', '1c horário no passado é recusado'
);
select tests.throws(
  format('select public.schedule_publication(%L, ''Instagram'', now() + interval ''400 days'')', :'item'),
  'invalid_schedule', '1d mais de 1 ano à frente é recusado'
);

select public.schedule_publication(:'item', 'Instagram', date_trunc('minute', now()) + interval '2 days') as job_ig \gset
select tests.ok(
  (select content_version = 1 and content_hash = :'hash1' and mode = 'dry_run' and status = 'scheduled' and created_by = :'owner_a'::uuid
   from public.publication_jobs where id = :'job_ig'),
  '1e job fixa versão e hash aprovados, modo dry_run'
);
select tests.throws(
  format('select public.schedule_publication(%L, ''Instagram'', date_trunc(''minute'', now()) + interval ''2 days'')', :'item'),
  'already_scheduled', '1f mesmo conteúdo, canal e horário não duplica'
);

-- 2. Cliente não escreve na fila
select tests.throws(
  format('insert into public.publication_jobs (organization_id, content_item_id, content_version, content_hash, channel, scheduled_for, created_by) values (%L, %L, 1, %L, ''YouTube'', now() + interval ''1 day'', %L)', :'org_a', :'item', :'hash1', :'owner_a'),
  '42501', '2a insert direto bloqueado'
);
select tests.throws(format('update public.publication_jobs set status = ''dry_run_passed'' where id = %L', :'job_ig'), '42501', '2b update direto bloqueado');
select tests.throws(format('delete from public.publication_jobs where id = %L', :'job_ig'), '42501', '2c delete direto bloqueado');
select tests.throws(format('update public.publication_job_events set event = ''cancelled'' where job_id = %L', :'job_ig'), '42501', '2d eventos imutáveis pela API');

-- 3. Dry-run passa com a versão aprovada intacta; mídia é aviso
select job_status as st1 from public.run_publication_dry_run(:'job_ig') \gset
select tests.ok(:'st1' = 'dry_run_passed', '3a dry-run passa');
select tests.ok(
  (select bool_and((c ->> 'ok')::boolean) from public.publication_jobs j, jsonb_array_elements(j.checks) c
   where j.id = :'job_ig' and c ->> 'severity' = 'error'),
  '3b todas as checagens bloqueantes ok'
);
select tests.ok(
  (select count(*) = 2 from public.publication_jobs j, jsonb_array_elements(j.checks) c
   where j.id = :'job_ig' and c ->> 'check' in ('media', 'license') and (c ->> 'ok')::boolean and c ->> 'severity' = 'error'),
  '3c mídia anexada e licença válida (bloqueantes)'
);

-- 4. Conteúdo editado depois do agendamento: dry-run falha
update public.content_items set caption = 'Legenda alterada depois da aprovação' where id = :'item';
select job_status as st2 from public.run_publication_dry_run(:'job_ig') \gset
select tests.ok(:'st2' = 'dry_run_failed', '4a edição após agendar reprova o dry-run');
select tests.ok(
  (select (c ->> 'ok')::boolean = false from public.publication_jobs j, jsonb_array_elements(j.checks) c
   where j.id = :'job_ig' and c ->> 'check' = 'approved_version'),
  '4b motivo: versão aprovada mudou'
);
select tests.throws(
  format('select public.schedule_publication(%L, ''YouTube'', now() + interval ''3 days'')', :'item'),
  'approval_required', '4c versão nova sem aprovação não agenda'
);

-- 5. Limites por canal
select content_hash as hash2 from public.content_items where id = :'item' \gset
update public.content_items set hashtags = (select string_agg('#t' || g, ' ') from generate_series(1, 31) g) where id = :'item';
select content_hash as hash3 from public.content_items where id = :'item' \gset
select public.approve_content(:'item', :'hash3');
select public.schedule_publication(:'item', 'Instagram', now() + interval '5 days') as job_ig2 \gset
select public.schedule_publication(:'item', 'YouTube', now() + interval '5 days') as job_yt \gset
select tests.ok((select job_status from public.run_publication_dry_run(:'job_ig2')) = 'dry_run_failed', '5a Instagram com 31 hashtags falha');
select tests.ok((select job_status from public.run_publication_dry_run(:'job_yt')) = 'dry_run_passed', '5b a mesma peça passa no YouTube');

-- 6. Cancelamento exige motivo e é definitivo
select tests.throws(format('select public.cancel_publication(%L, '''')', :'job_ig2'), 'cancel_reason_required', '6a cancelar exige motivo');
select public.cancel_publication(:'job_ig2', 'Excesso de hashtags');
select tests.ok(
  (select status = 'cancelled' and cancelled_by = :'owner_a'::uuid and cancel_reason = 'Excesso de hashtags' from public.publication_jobs where id = :'job_ig2'),
  '6b cancelamento registra quem e por quê'
);
select tests.throws(format('select public.run_publication_dry_run(%L)', :'job_ig2'), 'publication_cancelled', '6c cancelado não roda de novo');
select tests.throws(format('select public.cancel_publication(%L, ''de novo'')', :'job_ig2'), 'publication_cancelled', '6d cancelar duas vezes é recusado');

-- 7. Papéis e isolamento
select tests.login(:'viewer_a');
select tests.ok((select count(*) from public.publication_jobs where organization_id = :'org_a') = 3, '7a viewer lê o calendário');
select tests.throws(format('select public.run_publication_dry_run(%L)', :'job_yt'), 'forbidden', '7b viewer não roda dry-run');
select tests.throws(format('select public.schedule_publication(%L, ''YouTube'', now() + interval ''9 days'')', :'item'), 'forbidden', '7c viewer não agenda');
select tests.login(:'owner_b');
select tests.ok((select count(*) from public.publication_jobs) = 0, '7d outro workspace não vê a fila');
select tests.throws(format('select public.run_publication_dry_run(%L)', :'job_yt'), 'publication_not_found', '7e outro workspace não roda dry-run');
select tests.throws(format('select public.schedule_publication(%L, ''YouTube'', now() + interval ''9 days'')', :'item'), 'content_not_found', '7f outro workspace não agenda');

-- 8. Histórico, auditoria e funções internas
reset role;
select tests.ok(
  (select array_agg(event order by id) from public.publication_job_events where job_id = :'job_ig') = array['scheduled', 'dry_run_passed', 'dry_run_failed'],
  '8a histórico do job em ordem'
);
select tests.ok((select count(*) from public.audit_log where table_name = 'publication_jobs' and record_id = :'job_ig') >= 3, '8b mudanças no audit_log');
select tests.ok(
  not has_function_privilege('authenticated', 'public.publication_checks(public.publication_jobs)', 'execute')
  and not has_function_privilege('authenticated', 'public.publication_member_role(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.schedule_publication(uuid, text, timestamptz)', 'execute'),
  '8c funções internas fechadas'
);
select tests.throws(format('delete from public.content_items where id = %L', :'item'), '23503', '8d conteúdo com publicação agendada não é apagado');

rollback;
