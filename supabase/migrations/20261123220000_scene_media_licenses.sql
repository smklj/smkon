-- F2 · Imagens do design (documento de cena) entram no verificador da fila.
--
-- A mídia principal da peça já precisa de licença comercial válida na data agendada.
-- Com o editor de camadas, o design pode usar outras imagens da biblioteca; cada uma
-- passa pela mesma regra: existir no workspace da peça, não estar arquivada e ter
-- licença comercial válida no dia da publicação.
--
-- As checagens anteriores continuam intactas: a função original vira
-- publication_checks_base e a nova publication_checks devolve as mesmas checagens
-- mais a checagem 'scene_media'.

alter function public.publication_checks(public.publication_jobs) rename to publication_checks_base;
revoke all on function public.publication_checks_base(public.publication_jobs) from public, anon, authenticated;

create or replace function public.publication_scene_media_check(p_job public.publication_jobs)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_scene jsonb;
  v_on date := (p_job.scheduled_for at time zone 'America/Sao_Paulo')::date;
  v_total integer := 0;
  v_problems text[] := '{}';
  r record;
begin
  select c.scene into v_scene from public.content_items c where c.id = p_job.content_item_id;

  for r in
    select distinct ids.asset_id, a.id as found_id, a.original_name, a.archived_at, a.organization_id
    from (
      select (layer ->> 'assetId')::uuid as asset_id
      from jsonb_array_elements(coalesce(v_scene -> 'pages', '[]'::jsonb)) page,
           jsonb_array_elements(coalesce(page -> 'layers', '[]'::jsonb)) layer
      where layer ->> 'type' = 'image'
        and layer ->> 'assetId' ~ '^[0-9a-fA-F-]{36}$'
    ) ids
    left join public.media_assets a on a.id = ids.asset_id
  loop
    v_total := v_total + 1;
    if r.found_id is null or r.organization_id <> p_job.organization_id then
      v_problems := array_append(v_problems, 'imagem fora da biblioteca do workspace');
    elsif r.archived_at is not null then
      v_problems := array_append(v_problems, format('%s arquivada', r.original_name));
    elsif (public.media_active_license(r.found_id, v_on)).id is null then
      v_problems := array_append(v_problems, format('%s sem licença comercial válida em %s', r.original_name, to_char(v_on, 'DD/MM/YYYY')));
    end if;
  end loop;

  return jsonb_build_object(
    'check', 'scene_media', 'severity', 'error',
    'ok', cardinality(v_problems) = 0,
    'detail', case
      when v_total = 0 then 'O design não usa imagens da biblioteca.'
      when cardinality(v_problems) = 0 then format('%s imagem(ns) do design com licença válida em %s.', v_total, to_char(v_on, 'DD/MM/YYYY'))
      else 'Imagens do design: ' || array_to_string(v_problems, '; ') || '.' end);
end;
$$;

revoke all on function public.publication_scene_media_check(public.publication_jobs) from public, anon, authenticated;

create or replace function public.publication_checks(p_job public.publication_jobs)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select public.publication_checks_base(p_job) || jsonb_build_array(public.publication_scene_media_check(p_job));
$$;

revoke all on function public.publication_checks(public.publication_jobs) from public, anon, authenticated;
