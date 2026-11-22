-- F1: documento de cena na peça (content_items.scene), hash, versão, aprovação e isolamento.
\set ON_ERROR_STOP 1
\set owner_a 'ac000000-0000-4000-8000-00000000000a'
\set viewer_a 'ac000000-0000-4000-8000-0000000000a2'
\set owner_b 'bc000000-0000-4000-8000-00000000000b'
begin;

select tests.create_user(:'owner_a', 'owner-a18@smkon.test');
select tests.create_user(:'viewer_a', 'viewer-a18@smkon.test');
select tests.create_user(:'owner_b', 'owner-b18@smkon.test');
set local role authenticated;
select tests.login(:'owner_a');
select workspace_id as org_a from public.ensure_workspace() \gset
select tests.login(:'owner_b');
select workspace_id as org_b from public.ensure_workspace() \gset
reset role;
insert into public.organization_members (organization_id, user_id, role) values (:'org_a', :'viewer_a', 'viewer');

\set scene_v1 '{"schema": 1, "kind": "image", "width": 1080, "height": 1080, "pages": [{"id": "capa", "layers": [{"id": "headline", "type": "text", "text": "Achado", "font": "display", "size": 48, "color": "#FFFFFF", "x": 80, "y": 200}]}]}'
\set scene_v1_reordered '{"pages": [{"layers": [{"y": 200, "x": 80, "color": "#FFFFFF", "size": 48, "font": "display", "text": "Achado", "type": "text", "id": "headline"}], "id": "capa"}], "height": 1080, "width": 1080, "kind": "image", "schema": 1}'
\set scene_v2 '{"schema": 1, "kind": "image", "width": 1080, "height": 1080, "pages": [{"id": "capa", "layers": [{"id": "headline", "type": "text", "text": "Achado do dia", "font": "display", "size": 48, "color": "#FFFFFF", "x": 80, "y": 200}]}]}'

set local role authenticated;
select tests.login(:'owner_a');
insert into public.content_items (organization_id, created_by, title, caption, hashtags, channels)
values (:'org_a', :'owner_a', 'Peça F1', 'Legenda', '#a', array['Instagram'])
returning id as item, content_hash as hash_plain \gset

-- 1. Peça sem cena: hash idêntico à fórmula anterior (nada aprovado ou agendado muda)
reset role;
select tests.ok(
  (select c.content_hash = encode(sha256(convert_to(jsonb_build_array(
      c.title, c.product, c.source_url, c.asset_url, c.script, c.caption, c.cta, c.hashtags,
      to_jsonb(c.channels), c.rights_confirmed, c.media_asset_id)::text, 'UTF8')), 'hex')
   from public.content_items c where c.id = :'item'),
  '1a sem cena, o hash segue a fórmula anterior'
);
set local role authenticated;
select tests.login(:'owner_a');

-- 2. Gravar a cena cria versão nova e derruba a aprovação
select public.approve_content(:'item', :'hash_plain');
select tests.ok((select status = 'approved' and version = 1 from public.content_items where id = :'item'), '2a peça aprovada na versão 1');
update public.content_items set scene = :'scene_v1'::jsonb where id = :'item';
select tests.ok(
  (select version = 2 and status = 'draft' and approved_version is null and content_hash <> :'hash_plain'
   from public.content_items where id = :'item'),
  '2b cena nova: versão 2, volta para rascunho, aprovação anterior não vale'
);
select content_hash as hash_scene from public.content_items where id = :'item' \gset

-- 3. Mesma cena com chaves em outra ordem não gera versão (jsonb normaliza)
update public.content_items set scene = :'scene_v1_reordered'::jsonb where id = :'item';
select tests.ok((select version = 2 and content_hash = :'hash_scene' from public.content_items where id = :'item'), '3a mesma cena, mesma versão');

-- 4. Mudar o design muda o hash; a versão guarda a cena
update public.content_items set scene = :'scene_v2'::jsonb where id = :'item';
select tests.ok((select version = 3 and content_hash <> :'hash_scene' from public.content_items where id = :'item'), '4a design editado: versão 3');
select tests.ok(
  (select snapshot -> 'scene' -> 'pages' -> 0 -> 'layers' -> 0 ->> 'text' = 'Achado do dia'
   from public.content_versions where content_item_id = :'item' and version = 3),
  '4b snapshot da versão 3 contém a cena'
);
select tests.ok(
  (select snapshot -> 'scene' -> 'pages' -> 0 -> 'layers' -> 0 ->> 'text' = 'Achado'
   from public.content_versions where content_item_id = :'item' and version = 2),
  '4c versão 2 continua com a cena anterior'
);

-- 5. Aprovação exige o hash da versão com a cena
select tests.throws(format('select public.approve_content(%L, %L)', :'item', :'hash_scene'), 'hash_mismatch', '5a hash antigo não aprova');
select content_hash as hash_v3 from public.content_items where id = :'item' \gset
select public.approve_content(:'item', :'hash_v3');
select tests.ok((select status = 'approved' and approved_version = 3 from public.content_items where id = :'item'), '5b aprova a versão exata com a cena');

-- 6. Forma mínima e tamanho garantidos pelo banco
select tests.throws(format('update public.content_items set scene = ''[]''::jsonb where id = %L', :'item'), 'content_items_scene_shape', '6a cena precisa ser objeto');
select tests.throws(format('update public.content_items set scene = ''{"schema": 2, "kind": "image", "pages": [{}]}''::jsonb where id = %L', :'item'), 'content_items_scene_shape', '6b versão de schema desconhecida');
select tests.throws(format('update public.content_items set scene = ''{"schema": 1, "kind": "video", "pages": [{}]}''::jsonb where id = %L', :'item'), 'content_items_scene_shape', '6c vídeo ainda não é aceito');
select tests.throws(format('update public.content_items set scene = ''{"schema": 1, "kind": "image", "pages": []}''::jsonb where id = %L', :'item'), 'content_items_scene_shape', '6d ao menos uma página');
select tests.throws(
  format('update public.content_items set scene = jsonb_build_object(''schema'', 1, ''kind'', ''image'', ''pages'', jsonb_build_array(jsonb_build_object(''id'', repeat(''x'', 300000)))) where id = %L', :'item'),
  'content_items_scene_shape', '6e acima de 256 KB é recusado'
);
select tests.ok((select status = 'approved' and version = 3 from public.content_items where id = :'item'), '6f tentativas recusadas não mexem na peça');

-- 7. Viewer lê, mas não grava a cena; outro workspace não vê
select tests.login(:'viewer_a');
select tests.ok((select scene is not null from public.content_items where id = :'item'), '7a viewer lê a cena do workspace');
update public.content_items set scene = :'scene_v1'::jsonb where id = :'item';
select tests.login(:'owner_a');
select tests.ok((select version = 3 from public.content_items where id = :'item'), '7b viewer não altera a cena');
select tests.login(:'owner_b');
select tests.ok((select count(*) = 0 from public.content_items where id = :'item'), '7c outro workspace não vê a peça');
update public.content_items set scene = :'scene_v1'::jsonb where id = :'item';
select tests.login(:'owner_a');
select tests.ok((select version = 3 from public.content_items where id = :'item'), '7d outro workspace não altera a cena');

-- 8. Remover a cena volta para o hash sem cena (nova versão)
update public.content_items set scene = null where id = :'item';
select tests.ok((select version = 4 and scene is null and status = 'draft' from public.content_items where id = :'item'), '8a remover a cena é uma edição versionada');

reset role;
rollback;
