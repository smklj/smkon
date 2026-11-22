-- F1 · Documento de cena do Content Studio.
--
-- content_items.scene guarda o design da peça (camadas, páginas, template) como JSON.
-- A validação completa fica na aplicação (src/lib/scene/schema.ts); o banco garante a
-- forma mínima e o tamanho, para nenhum caminho gravar lixo ou documentos enormes.
--
-- A cena entra no hash da versão: mudar o design cria versão nova e derruba a aprovação,
-- como já acontece com texto e mídia. Peças sem cena mantêm exatamente o hash anterior,
-- então nada que já está aprovado ou agendado muda.

alter table public.content_items
  add column scene jsonb;

alter table public.content_items
  add constraint content_items_scene_shape check (
    scene is null or (
      jsonb_typeof(scene) = 'object'
      and scene ->> 'schema' = '1'
      and scene ->> 'kind' in ('image', 'carousel')
      and jsonb_typeof(scene -> 'pages') = 'array'
      and jsonb_array_length(scene -> 'pages') between 1 and 10
      and octet_length(scene::text) <= 262144
    )
  );

comment on column public.content_items.scene is
  'Documento de cena v1 (src/lib/scene). Faz parte do content_hash: editar o design exige nova aprovação.';

create or replace function public.content_canonical_hash(item public.content_items)
returns text
language sql
stable
set search_path = ''
as $$
  select encode(
    sha256(convert_to((
      case
        when item.scene is null then jsonb_build_array(
          item.title, item.product, item.source_url, item.asset_url, item.script,
          item.caption, item.cta, item.hashtags, to_jsonb(item.channels), item.rights_confirmed,
          item.media_asset_id
        )
        else jsonb_build_array(
          item.title, item.product, item.source_url, item.asset_url, item.script,
          item.caption, item.cta, item.hashtags, to_jsonb(item.channels), item.rights_confirmed,
          item.media_asset_id, item.scene
        )
      end
    )::text, 'UTF8')),
    'hex'
  );
$$;

revoke all on function public.content_canonical_hash(public.content_items) from public, anon, authenticated;

create or replace function public.content_items_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.version <> old.version then
    insert into public.content_versions (organization_id, content_item_id, version, content_hash, snapshot, created_by)
    values (
      new.organization_id, new.id, new.version, new.content_hash,
      jsonb_build_object(
        'title', new.title, 'product', new.product, 'source_url', new.source_url,
        'asset_url', new.asset_url, 'script', new.script, 'caption', new.caption,
        'cta', new.cta, 'hashtags', new.hashtags, 'channels', to_jsonb(new.channels),
        'rights_confirmed', new.rights_confirmed, 'media_asset_id', new.media_asset_id,
        'scene', new.scene
      ),
      auth.uid()
    );
  end if;
  return null;
end;
$$;

revoke all on function public.content_items_snapshot() from public, anon, authenticated;
