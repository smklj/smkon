-- SMKON S14 etapa 4: ferramenta draft_content do executor de agentes.
-- - Único caminho de escrita de um agente: cria um content_items em status 'draft', nada além disso.
-- - Nunca aprova, agenda nem publica; não declara direitos (rights_confirmed = false, sem source_url,
--   asset_url ou mídia). Publicar continua exigindo aprovação humana da versão exata (approve_content).
-- - Autoria: o rascunho é do humano que iniciou a execução (agent_runs.created_by), que precisa ainda
--   ser owner/admin do workspace — a mesma regra de quem cria conteúdo pela interface — e fica marcado
--   com agent_run_id (imutável; só o executor do servidor consegue gravar).
-- - Só roda para execução ativa em fase de execução, com draft_content liberado no workspace, kill
--   switch desligado e no máximo 5 rascunhos por execução.
-- - Chamado só pelo executor do servidor (service_role). Migration aditiva: nenhuma linha existente muda.

-- ---------------------------------------------------------------------------
-- 1. Vínculo do conteúdo com a execução do agente
-- ---------------------------------------------------------------------------
alter table public.content_items
  add column agent_run_id uuid references public.agent_runs (id) on delete restrict;

create index content_items_agent_run_idx on public.content_items (agent_run_id) where agent_run_id is not null;

-- agent_run_id só é gravado pelo executor (função abaixo, security definer) e nunca muda depois.
-- Usuários (anon/authenticated) não conseguem forjar autoria de agente nem apagar a marca.
-- security invoker de propósito: current_user é o papel de quem escreve (authenticated via PostgREST)
-- ou o dono da função agent_draft_content quando o insert vem dela.
create or replace function public.content_items_agent_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.agent_run_id is not null and current_user in ('anon', 'authenticated') then
      raise exception 'agent_run_reserved' using errcode = '42501';
    end if;
  elsif new.agent_run_id is distinct from old.agent_run_id then
    raise exception 'agent_run_immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.content_items_agent_guard() from public, anon, authenticated;

-- Roda antes do content_items_guard (ordem alfabética dos triggers BEFORE).
create trigger content_items_a_agent_guard
before insert or update on public.content_items
for each row execute function public.content_items_agent_guard();

-- ---------------------------------------------------------------------------
-- 2. draft_content (executor do servidor)
-- ---------------------------------------------------------------------------
-- p_draft aceita só: title (obrigatório), product, script, caption, cta, hashtags, channels.
-- Qualquer outra chave (status, rights_confirmed, source_url, organization_id, ...) é recusada.
create or replace function public.agent_draft_content(p_run_id uuid, p_draft jsonb)
returns table (content_id uuid, content_version integer, content_hash text, content_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.agent_runs%rowtype;
  v_allowed constant text[] := array['title', 'product', 'script', 'caption', 'cta', 'hashtags', 'channels'];
  v_text_limits constant jsonb := '{"title":180,"product":180,"script":8000,"caption":2200,"cta":300,"hashtags":500}';
  v_key text;
  v_value jsonb;
  v_channels text[];
  v_id uuid;
begin
  select * into v_run from public.agent_runs r where r.id = p_run_id for update;
  if not found then
    raise exception 'agent_run_not_found' using errcode = 'P0002';
  end if;
  -- Rascunho só entre o plano e a verificação; fila, verificação e execuções encerradas não escrevem.
  if v_run.status not in ('planning', 'executing') then
    raise exception 'run_not_active' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.agent_settings s where s.organization_id = v_run.organization_id and s.kill_switch
  ) then
    raise exception 'agents_killed' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.agent_tool_grants g
    where g.organization_id = v_run.organization_id and g.tool = 'draft_content'
  ) then
    raise exception 'tool_not_allowed' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = v_run.organization_id and m.user_id = v_run.created_by and m.role in ('owner', 'admin')
  ) then
    raise exception 'run_owner_not_allowed' using errcode = '42501';
  end if;
  if (select count(*) from public.content_items c where c.agent_run_id = p_run_id) >= 5 then
    raise exception 'draft_limit_reached' using errcode = '54000';
  end if;

  -- Entrada estrita
  if p_draft is null or jsonb_typeof(p_draft) <> 'object' then
    raise exception 'invalid_draft' using errcode = '22023';
  end if;
  for v_key, v_value in select e.key, e.value from jsonb_each(p_draft) e loop
    if not (v_key = any (v_allowed)) then
      raise exception 'invalid_draft' using errcode = '22023', detail = 'unknown_key:' || left(v_key, 64);
    end if;
    if v_key = 'channels' then
      if jsonb_typeof(v_value) <> 'array' or jsonb_array_length(v_value) = 0
         or exists (select 1 from jsonb_array_elements(v_value) c where jsonb_typeof(c) <> 'string') then
        raise exception 'invalid_draft' using errcode = '22023', detail = 'channels';
      end if;
    elsif jsonb_typeof(v_value) <> 'string'
          or char_length(v_value #>> '{}') > (v_text_limits ->> v_key)::integer then
      raise exception 'invalid_draft' using errcode = '22023', detail = v_key;
    end if;
  end loop;
  if char_length(trim(coalesce(p_draft ->> 'title', ''))) = 0 then
    raise exception 'invalid_draft' using errcode = '22023', detail = 'title';
  end if;

  if p_draft ? 'channels' then
    select array_agg(distinct c order by c) into v_channels from jsonb_array_elements_text(p_draft -> 'channels') c;
    if not (v_channels <@ array['YouTube', 'Instagram', 'TikTok']::text[]) then
      raise exception 'invalid_draft' using errcode = '22023', detail = 'channels';
    end if;
  else
    v_channels := array['YouTube', 'Instagram', 'TikTok']::text[];
  end if;

  insert into public.content_items (
    organization_id, created_by, agent_run_id, title, product, script, caption, cta, hashtags, channels,
    source_url, asset_url, rights_confirmed, status
  ) values (
    v_run.organization_id, v_run.created_by, p_run_id,
    trim(p_draft ->> 'title'),
    coalesce(p_draft ->> 'product', ''),
    coalesce(p_draft ->> 'script', ''),
    coalesce(p_draft ->> 'caption', ''),
    coalesce(p_draft ->> 'cta', ''),
    coalesce(p_draft ->> 'hashtags', ''),
    v_channels,
    '', '', false, 'draft'
  )
  returning id into v_id;

  return query
    select c.id, c.version, c.content_hash, c.status from public.content_items c where c.id = v_id;
end;
$$;

revoke all on function public.agent_draft_content(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.agent_draft_content(uuid, jsonb) to service_role;
