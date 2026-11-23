-- F2 (020): imagens do design (documento de cena) passam pelo verificador da fila.
\set ON_ERROR_STOP 1
\set owner_a 'ad000000-0000-4000-8000-00000000000a'
\set owner_b 'bd000000-0000-4000-8000-00000000000b'
begin;

select tests.create_user(:'owner_a', 'owner-a20@smkon.test');
select tests.create_user(:'owner_b', 'owner-b20@smkon.test');
set local role authenticated;
select tests.login(:'owner_a');
select workspace_id as org_a from public.ensure_workspace() \gset
select tests.login(:'owner_b');
select workspace_id as org_b from public.ensure_workspace() \gset
reset role;

-- Mídias: A licenciada, B sem licença, C arquivada, D de outro workspace.
insert into public.media_assets (organization_id, storage_path, kind, mime_type, size_bytes, original_name, uploaded_by)
values (:'org_a', :'org_a' || '/' || gen_random_uuid() || '.png', 'image', 'image/png', 1000, 'produto.png', :'owner_a')
returning id as img_ok \gset
insert into public.media_assets (organization_id, storage_path, kind, mime_type, size_bytes, original_name, uploaded_by)
values (:'org_a', :'org_a' || '/' || gen_random_uuid() || '.png', 'image', 'image/png', 1000, 'sem-licenca.png', :'owner_a')
returning id as img_nolicense \gset
insert into public.media_assets (organization_id, storage_path, kind, mime_type, size_bytes, original_name, uploaded_by, archived_at, archived_by)
values (:'org_a', :'org_a' || '/' || gen_random_uuid() || '.png', 'image', 'image/png', 1000, 'arquivada.png', :'owner_a', now(), :'owner_a')
returning id as img_archived \gset
insert into public.media_assets (organization_id, storage_path, kind, mime_type, size_bytes, original_name, uploaded_by)
values (:'org_b', :'org_b' || '/' || gen_random_uuid() || '.png', 'image', 'image/png', 1000, 'alheia.png', :'owner_b')
returning id as img_other \gset
insert into public.media_licenses (organization_id, media_asset_id, license_type, licensor, allows_commercial_use, allows_modification)
values (:'org_a', :'img_ok', 'own_production', 'SMKON', true, true);

insert into public.content_items (organization_id, created_by, title, caption, channels)
values (:'org_a', :'owner_a', 'Peça com design', 'Legenda', array['Instagram'])
returning id as item \gset

-- Job direto no banco para exercitar só as checagens (a fila completa já tem testes próprios).
create temp table job_scene on commit drop as
select * from public.publication_jobs where false;
insert into job_scene (id, organization_id, content_item_id, content_version, content_hash, channel, scheduled_for, created_by)
values (gen_random_uuid(), :'org_a', :'item', 1, repeat('a', 64), 'Instagram', now() + interval '2 days', :'owner_a');

create temp view scene_check as
select (select c from jsonb_array_elements(public.publication_checks(jsonb_populate_record(null::public.publication_jobs, to_jsonb(j)))) c where c ->> 'check' = 'scene_media') as c
from job_scene j;

-- 1. Sem design: checagem presente e ok
select tests.ok((select (c ->> 'ok')::boolean and c ->> 'detail' like '%não usa imagens%' from scene_check), '1a sem design, nada a conferir');
select tests.ok(
  (select jsonb_array_length(public.publication_checks(jsonb_populate_record(null::public.publication_jobs, to_jsonb(j)))) = jsonb_array_length(public.publication_checks_base(jsonb_populate_record(null::public.publication_jobs, to_jsonb(j)))) + 1 from job_scene j),
  '1b checagens anteriores preservadas, mais a nova'
);

-- 2. Imagem com licença: ok
update public.content_items set scene = jsonb_build_object('schema', 1, 'kind', 'image', 'width', 1080, 'height', 1080,
  'pages', jsonb_build_array(jsonb_build_object('id', 'p1', 'layers', jsonb_build_array(
    jsonb_build_object('id', 'foto', 'type', 'image', 'assetId', :'img_ok', 'x', 0, 'y', 0, 'width', 500, 'height', 500)))))
where id = :'item';
select tests.ok((select (c ->> 'ok')::boolean and c ->> 'detail' like '1 imagem(ns)%' from scene_check), '2a imagem licenciada passa');

-- 3. Sem licença, arquivada e de outro workspace: erro com o motivo de cada uma
update public.content_items set scene = jsonb_build_object('schema', 1, 'kind', 'carousel', 'width', 1080, 'height', 1080,
  'pages', jsonb_build_array(
    jsonb_build_object('id', 'p1', 'layers', jsonb_build_array(
      jsonb_build_object('id', 'a', 'type', 'image', 'assetId', :'img_ok', 'x', 0, 'y', 0, 'width', 1, 'height', 1),
      jsonb_build_object('id', 'b', 'type', 'image', 'assetId', :'img_nolicense', 'x', 0, 'y', 0, 'width', 1, 'height', 1))),
    jsonb_build_object('id', 'p2', 'layers', jsonb_build_array(
      jsonb_build_object('id', 'c', 'type', 'image', 'assetId', :'img_archived', 'x', 0, 'y', 0, 'width', 1, 'height', 1),
      jsonb_build_object('id', 'd', 'type', 'image', 'assetId', :'img_other', 'x', 0, 'y', 0, 'width', 1, 'height', 1)))))
where id = :'item';
select tests.ok((select not (c ->> 'ok')::boolean and c ->> 'severity' = 'error' from scene_check), '3a erro bloqueante');
select tests.ok((select c ->> 'detail' like '%sem-licenca.png sem licença comercial válida%' from scene_check), '3b aponta a imagem sem licença');
select tests.ok((select c ->> 'detail' like '%arquivada.png arquivada%' from scene_check), '3c aponta a imagem arquivada');
select tests.ok((select c ->> 'detail' like '%fora da biblioteca do workspace%' from scene_check), '3d aponta a imagem de outro workspace');
select tests.ok((select c ->> 'detail' not like '%produto.png%' from scene_check), '3e a licenciada não aparece como problema');

-- 4. Licença vencida na data agendada também bloqueia
update public.content_items set scene = jsonb_build_object('schema', 1, 'kind', 'image', 'width', 1080, 'height', 1080,
  'pages', jsonb_build_array(jsonb_build_object('id', 'p1', 'layers', jsonb_build_array(
    jsonb_build_object('id', 'foto', 'type', 'image', 'assetId', :'img_nolicense', 'x', 0, 'y', 0, 'width', 1, 'height', 1)))))
where id = :'item';
insert into public.media_licenses (organization_id, media_asset_id, license_type, licensor, proof_url, allows_commercial_use, allows_modification, valid_from, valid_until)
values (:'org_a', :'img_nolicense', 'licensed', 'Agência', 'https://contratos.exemplo.com/1', true, true, current_date - 30, current_date);
select tests.ok((select not (c ->> 'ok')::boolean from scene_check), '4a licença que vence antes da data agendada não vale');

-- 5. Funções internas fora do alcance da API
select tests.ok(not has_function_privilege('authenticated', 'public.publication_scene_media_check(public.publication_jobs)', 'execute'), '5a checagem não é RPC pública');
select tests.ok(not has_function_privilege('authenticated', 'public.publication_checks_base(public.publication_jobs)', 'execute'), '5b base não é RPC pública');
select tests.ok(not has_function_privilege('authenticated', 'public.publication_checks(public.publication_jobs)', 'execute'), '5c publication_checks continua interna');

rollback;
