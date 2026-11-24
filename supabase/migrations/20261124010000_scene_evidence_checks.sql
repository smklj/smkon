-- F3 · Campos do design ligados ao produto entram no verificador da fila.
--
-- Uma camada de texto pode mostrar um dado do produto (content_items.scene -> layer.bind):
-- nome, preço, fonte/data do preço ou avaliação, apontando para a evidência verificada.
-- A aplicação já confere o texto ao salvar; a fila confere de novo na data agendada:
--
--   scene_evidence (erro): produto do workspace; evidência do mesmo produto, verificada;
--     preço observado no máximo 7 dias antes do dia da publicação (fuso de Brasília).
--   scene_price_text (aviso): texto com preço (R$, US$, €) digitado sem vínculo a evidência.
--
-- As checagens anteriores (publication_checks_base e scene_media) continuam iguais.

create or replace function public.publication_scene_evidence_check(p_job public.publication_jobs)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_scene jsonb;
  v_on date := (p_job.scheduled_for at time zone 'America/Sao_Paulo')::date;
  v_max_age integer := 7;
  v_fields integer := 0;
  v_problems text[] := '{}';
  r record;
begin
  select c.scene into v_scene from public.content_items c where c.id = p_job.content_item_id;

  -- Produtos ligados (qualquer campo).
  for r in
    select distinct b ->> 'productId' as product_id, p.id as found_id, p.organization_id
    from jsonb_array_elements(coalesce(v_scene -> 'pages', '[]'::jsonb)) page,
         jsonb_array_elements(coalesce(page -> 'layers', '[]'::jsonb)) layer,
         lateral (select layer -> 'bind' as b) bound
    left join public.products p
      on (b ->> 'productId') ~ '^[0-9a-fA-F-]{36}$' and p.id = (b ->> 'productId')::uuid
    where layer ->> 'type' = 'text' and jsonb_typeof(layer -> 'bind') = 'object'
  loop
    v_fields := v_fields + 1;
    if r.found_id is null or r.organization_id <> p_job.organization_id then
      v_problems := array_append(v_problems, 'produto ligado fora do catálogo do workspace');
    end if;
  end loop;

  -- Evidências ligadas (preço, fonte do preço, avaliação): uma linha por evidência.
  for r in
    select distinct b ->> 'evidenceId' as evidence_id, b ->> 'productId' as product_id,
           e.id as found_id, e.organization_id, e.product_id as e_product, e.kind, e.review_status, e.observed_at
    from jsonb_array_elements(coalesce(v_scene -> 'pages', '[]'::jsonb)) page,
         jsonb_array_elements(coalesce(page -> 'layers', '[]'::jsonb)) layer,
         lateral (select layer -> 'bind' as b) bound
    left join public.product_evidence e
      on (b ->> 'evidenceId') ~ '^[0-9a-fA-F-]{36}$' and e.id = (b ->> 'evidenceId')::uuid
    where layer ->> 'type' = 'text' and jsonb_typeof(layer -> 'bind') = 'object' and b ? 'evidenceId'
  loop
    if r.found_id is null or r.organization_id <> p_job.organization_id or r.e_product::text <> lower(r.product_id) then
      v_problems := array_append(v_problems, 'evidência ligada não encontrada para o produto');
    elsif r.review_status <> 'verified' then
      v_problems := array_append(v_problems, 'evidência ligada não está verificada');
    elsif r.kind = 'price' and (r.observed_at at time zone 'America/Sao_Paulo')::date < v_on - v_max_age then
      v_problems := array_append(v_problems, format(
        'preço visto em %s, mais de %s dias antes da publicação: registre e verifique o preço atual',
        to_char(r.observed_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'), v_max_age));
    end if;
  end loop;

  return jsonb_build_object(
    'check', 'scene_evidence', 'severity', 'error',
    'ok', cardinality(v_problems) = 0,
    'detail', case
      when v_fields = 0 then 'O design não usa dados de produto.'
      when cardinality(v_problems) = 0 then format('Dados do produto verificados; preço visto até %s dias antes de %s.', v_max_age, to_char(v_on, 'DD/MM/YYYY'))
      else 'Dados do produto no design: ' || array_to_string(v_problems, '; ') || '.' end);
end;
$$;

revoke all on function public.publication_scene_evidence_check(public.publication_jobs) from public, anon, authenticated;

create or replace function public.publication_scene_price_text_check(p_job public.publication_jobs)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with typed as (
    select coalesce(layer ->> 'name', layer ->> 'id') as label
    from public.content_items c,
         jsonb_array_elements(coalesce(c.scene -> 'pages', '[]'::jsonb)) page,
         jsonb_array_elements(coalesce(page -> 'layers', '[]'::jsonb)) layer
    where c.id = p_job.content_item_id
      and layer ->> 'type' = 'text'
      and jsonb_typeof(layer -> 'bind') is distinct from 'object'
      and coalesce((layer ->> 'hidden')::boolean, false) = false
      and layer ->> 'text' ~ '(R\$|US\$|€)\s?[0-9]'
  )
  select jsonb_build_object(
    'check', 'scene_price_text', 'severity', 'warning',
    'ok', not exists (select 1 from typed),
    'detail', case
      when not exists (select 1 from typed) then 'Nenhum preço digitado à mão no design.'
      else 'Preço digitado sem evidência no design (' || (select string_agg(distinct label, ', ') from typed)
        || '): prefira o preço ligado ao produto, com fonte e data.' end);
$$;

revoke all on function public.publication_scene_price_text_check(public.publication_jobs) from public, anon, authenticated;

create or replace function public.publication_checks(p_job public.publication_jobs)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select public.publication_checks_base(p_job)
    || jsonb_build_array(
      public.publication_scene_media_check(p_job),
      public.publication_scene_evidence_check(p_job),
      public.publication_scene_price_text_check(p_job));
$$;

revoke all on function public.publication_checks(public.publication_jobs) from public, anon, authenticated;
