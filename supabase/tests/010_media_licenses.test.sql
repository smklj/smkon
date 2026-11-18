-- S10b: mídia no Storage, licenças e exigência na fila de publicação.
\set ON_ERROR_STOP 1
\set owner_a 'ab000000-0000-4000-8000-00000000000a'
\set viewer_a 'ab000000-0000-4000-8000-0000000000a2'
\set owner_b 'bb000000-0000-4000-8000-00000000000b'
begin;

select tests.create_user(:'owner_a', 'owner-a11@smkon.test');
select tests.create_user(:'viewer_a', 'viewer-a11@smkon.test');
select tests.create_user(:'owner_b', 'owner-b11@smkon.test');
set local role authenticated;
select tests.login(:'owner_a');
select workspace_id as org_a from public.ensure_workspace() \gset
select tests.login(:'owner_b');
select workspace_id as org_b from public.ensure_workspace() \gset
reset role;
insert into public.organization_members (organization_id, user_id, role) values (:'org_a', :'viewer_a', 'viewer');

-- 1. Bucket privado com tipos e tamanho limitados
select tests.ok(
  (select not public and file_size_limit = 52428800 and allowed_mime_types @> array['video/mp4', 'image/png']
   from storage.buckets where id = 'content-media'),
  '1a bucket content-media privado, 50 MB, tipos permitidos'
);

-- 2. Políticas do Storage: upload só no diretório do próprio workspace, por owner/admin
select :'org_a' || '/' || gen_random_uuid() || '.mp4' as path_a \gset
select :'org_b' || '/' || gen_random_uuid() || '.mp4' as path_b \gset
set local role authenticated;
select tests.login(:'owner_a');
insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
values ('content-media', :'path_a', :'owner_a', :'owner_a', '{"mimetype": "video/mp4", "size": 2048}');
select tests.ok((select count(*) from storage.objects where name = :'path_a') = 1, '2a owner envia para o próprio workspace');
select tests.throws(
  format('insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values (''content-media'', %L, %L, %L, ''{}'')', :'path_b', :'owner_a', :'owner_a'),
  'row-level security', '2b não envia para outro workspace'
);
select tests.throws(
  format('insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values (''content-media'', %L, %L, %L, ''{}'')', :'org_a' || '/arquivo.exe', :'owner_a', :'owner_a'),
  'row-level security', '2c nome fora do padrão é recusado'
);
update storage.objects set metadata = '{"mimetype": "image/png", "size": 1}' where name = :'path_a';
delete from storage.objects where name = :'path_a';
select tests.ok(
  (select metadata ->> 'mimetype' = 'video/mp4' from storage.objects where name = :'path_a'),
  '2d arquivo não é sobrescrito nem apagado (sem política de update/delete)'
);
select tests.login(:'viewer_a');
select tests.ok((select count(*) from storage.objects where name = :'path_a') = 1, '2e viewer lê arquivos do workspace');
select tests.throws(
  format('insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values (''content-media'', %L, %L, %L, ''{}'')', :'org_a' || '/' || gen_random_uuid() || '.png', :'viewer_a', :'viewer_a'),
  'row-level security', '2f viewer não envia'
);
select tests.login(:'owner_b');
select tests.ok((select count(*) from storage.objects where name = :'path_a') = 0, '2g outro workspace não vê o arquivo');

-- 3. Registro confere o Storage
select tests.login(:'owner_a');
select tests.throws(format('select public.register_media_asset(%L, ''x.mp4'')', :'org_a' || '/' || gen_random_uuid() || '.mp4'), 'media_upload_not_found', '3a sem arquivo no Storage não registra');
select tests.throws('select public.register_media_asset(''../etc/passwd'', ''x'')', 'invalid_media_path', '3b caminho inválido');
select public.register_media_asset(:'path_a', 'video-final.mp4') as media_a \gset
select tests.ok(
  (select kind = 'video' and mime_type = 'video/mp4' and size_bytes = 2048 and uploaded_by = :'owner_a'::uuid and original_name = 'video-final.mp4'
   from public.media_assets where id = :'media_a'),
  '3c tipo, tamanho e autor vêm do Storage, não do cliente'
);
select tests.ok((select public.register_media_asset(:'path_a', 'outro-nome.mp4')) = :'media_a'::uuid, '3d registro é idempotente');
select tests.throws(format('update public.media_assets set size_bytes = 1 where id = %L', :'media_a'), '42501', '3e cliente não altera o registro');
select tests.throws(format('delete from public.media_assets where id = %L', :'media_a'), '42501', '3f cliente não apaga o registro');
reset role;
select :'org_a' || '/' || gen_random_uuid() || '.mp4' as path_exe \gset
insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
values ('content-media', :'path_exe', :'owner_a', :'owner_a', '{"mimetype": "application/x-msdownload", "size": 10}');
select :'org_a' || '/' || gen_random_uuid() || '.mp4' as path_other_owner \gset
insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
values ('content-media', :'path_other_owner', :'viewer_a', :'viewer_a', '{"mimetype": "video/mp4", "size": 10}');
set local role authenticated;
select tests.login(:'owner_a');
select tests.throws(format('select public.register_media_asset(%L, ''x'')', :'path_exe'), 'invalid_media_type', '3g tipo real fora da lista é recusado');
select tests.throws(format('select public.register_media_asset(%L, ''x'')', :'path_other_owner'), 'forbidden', '3h só registra o próprio upload');
select tests.login(:'owner_b');
select tests.throws(format('select public.register_media_asset(%L, ''x'')', :'path_a'), 'forbidden', '3i outro workspace não registra');
select tests.ok((select count(*) from public.media_assets where id = :'media_a') = 0, '3j outro workspace não vê a mídia');

-- 4. Licenças
select tests.login(:'owner_a');
select tests.throws(
  format('insert into public.media_licenses (organization_id, media_asset_id, license_type, licensor, allows_commercial_use, allows_modification) values (%L, %L, ''creator_authorization'', ''Criador X'', true, true)', :'org_a', :'media_a'),
  'media_licenses_proof_required', '4a licença de terceiro exige comprovação'
);
select tests.throws(
  format('insert into public.media_licenses (organization_id, media_asset_id, license_type, licensor, proof_url, allows_commercial_use, allows_modification, valid_from, valid_until) values (%L, %L, ''licensed'', ''Agência'', ''https://contratos.exemplo.com/1'', true, true, ''2026-12-01'', ''2026-11-01'')', :'org_a', :'media_a'),
  'media_licenses_period', '4b validade final antes da inicial'
);
insert into public.media_licenses (organization_id, media_asset_id, license_type, licensor, proof_url, allows_commercial_use, allows_modification, valid_until)
values (:'org_a', :'media_a', 'creator_authorization', 'Criador X', 'https://drive.exemplo.com/autorizacao', true, false, current_date + 10)
returning id as lic1 \gset
select tests.ok((select recorded_by = :'owner_a'::uuid and revoked_at is null from public.media_licenses where id = :'lic1'), '4c licença com autoria real');
select tests.throws(format('update public.media_licenses set valid_until = null where id = %L', :'lic1'), '42501', '4d licença não é editada');
select tests.throws(format('delete from public.media_licenses where id = %L', :'lic1'), '42501', '4e licença não é apagada');
select tests.login(:'viewer_a');
select tests.throws(
  format('insert into public.media_licenses (organization_id, media_asset_id, license_type, licensor, allows_commercial_use, allows_modification) values (%L, %L, ''own_production'', ''Eu'', true, true)', :'org_a', :'media_a'),
  'row-level security', '4f viewer não registra licença'
);
select tests.throws(format('select public.revoke_media_license(%L, ''motivo'')', :'lic1'), 'forbidden', '4g viewer não revoga');

-- 5. Conteúdo com mídia: entra no hash; mídia de outro workspace é recusada
select tests.login(:'owner_a');
insert into public.content_items (organization_id, created_by, title, caption, channels)
values (:'org_a', :'owner_a', 'Com mídia', 'Legenda', array['Instagram'])
returning id as item, content_hash as h1 \gset
update public.content_items set media_asset_id = :'media_a' where id = :'item';
select tests.ok(
  (select version = 2 and content_hash <> :'h1' from public.content_items where id = :'item'),
  '5a anexar mídia cria nova versão (mídia está no hash)'
);
select tests.ok(
  (select snapshot ->> 'media_asset_id' = :'media_a' from public.content_versions where content_item_id = :'item' and version = 2),
  '5b snapshot da versão guarda a mídia'
);
select tests.login(:'owner_b');
select :'org_b' || '/' || gen_random_uuid() || '.png' as path_b2 \gset
insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
values ('content-media', :'path_b2', :'owner_b', :'owner_b', '{"mimetype": "image/png", "size": 500}');
select public.register_media_asset(:'path_b2', 'b.png') as media_b \gset
select tests.login(:'owner_a');
select tests.throws(format('update public.content_items set media_asset_id = %L where id = %L', :'media_b', :'item'), 'invalid_media', '5c mídia de outro workspace é recusada');

-- 6. Fila: licença válida na data agendada
select content_hash as h2 from public.content_items where id = :'item' \gset
select public.approve_content(:'item', :'h2');
select public.schedule_publication(:'item', 'Instagram', now() + interval '2 days') as job_ok \gset
select public.schedule_publication(:'item', 'Instagram', now() + interval '30 days') as job_late \gset
select tests.ok((select job_status from public.run_publication_dry_run(:'job_ok')) = 'dry_run_passed', '6a licença válida na data: passa');
select tests.ok((select job_status from public.run_publication_dry_run(:'job_late')) = 'dry_run_failed', '6b data depois do fim da licença: reprova');
select tests.ok(
  (select c ->> 'detail' like 'Nenhuma licença para uso comercial válida em%' from public.publication_jobs j, jsonb_array_elements(j.checks) c
   where j.id = :'job_late' and c ->> 'check' = 'license'),
  '6c motivo cita a data sem licença'
);
select tests.throws(format('select public.revoke_media_license(%L, '''')', :'lic1'), 'revoke_reason_required', '6d revogar exige motivo');
select public.revoke_media_license(:'lic1', 'Criador retirou a autorização');
select tests.ok((select job_status from public.run_publication_dry_run(:'job_ok')) = 'dry_run_failed', '6e licença revogada reprova o dry-run');
select tests.throws(format('select public.revoke_media_license(%L, ''de novo'')', :'lic1'), 'license_already_revoked', '6f revogação acontece uma vez');

-- 7. Arquivar mídia
select public.archive_media_asset(:'media_a');
select tests.ok((select archived_by = :'owner_a'::uuid from public.media_assets where id = :'media_a'), '7a arquivar registra quem');
insert into public.content_items (organization_id, created_by, title, channels)
values (:'org_a', :'owner_a', 'Outra', array['YouTube']) returning id as item2 \gset
select tests.throws(format('update public.content_items set media_asset_id = %L where id = %L', :'media_a', :'item2'), 'invalid_media', '7b mídia arquivada não é anexada de novo');

-- 8. Auditoria e funções internas
reset role;
select tests.ok((select count(*) from public.audit_log where table_name = 'media_licenses' and record_id = :'lic1') = 2, '8a licença e revogação no audit_log');
select tests.ok(
  not has_function_privilege('authenticated', 'public.media_active_license(uuid, date)', 'execute')
  and not has_function_privilege('anon', 'public.register_media_asset(text, text)', 'execute')
  and not has_function_privilege('anon', 'public.media_folder_role(text)', 'execute'),
  '8b funções internas fechadas'
);

rollback;
