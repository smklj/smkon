-- S19: Conexões Sociais, Adaptador Metricool e Aprovações de Ações Externas (Frente C)
--
-- 1. metricool_credentials:
--    Armazena com segurança credenciais da conta Metricool do workspace (user token, blog_id).
--    RLS ativa; revogada de anon e authenticated; exclusiva do service_role.
-- 2. metricool_set_credentials:
--    Grava ou atualiza as credenciais de forma segura (service_role).
-- 3. metricool_sync_social_accounts:
--    Sincroniza em lote as contas sociais descobertas no Metricool para social_accounts.

create table if not exists public.metricool_credentials (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  blog_id text not null check (length(blog_id) between 1 and 100),
  user_token_hash text not null check (user_token_hash ~ '^[a-f0-9]{64}$'),
  encrypted_token jsonb not null check (jsonb_typeof(encrypted_token) = 'object'),
  status public.smkon_connection_status not null default 'connected',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.metricool_credentials enable row level security;
revoke all on public.metricool_credentials from public, anon, authenticated;
grant select, insert, update, delete on public.metricool_credentials to service_role;

-- ---------------------------------------------------------------------------
-- 2. Parametrização de credenciais (service_role)
-- ---------------------------------------------------------------------------
create or replace function public.metricool_set_credentials(
  p_organization_id uuid,
  p_blog_id text,
  p_user_token_hash text,
  p_encrypted_token jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_organization_id is null then
    raise exception 'invalid_organization_id' using errcode = '22023';
  end if;

  if p_blog_id is null or length(trim(p_blog_id)) = 0 or length(p_blog_id) > 100 then
    raise exception 'invalid_blog_id' using errcode = '22023';
  end if;

  if p_user_token_hash is null or p_user_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_token_hash' using errcode = '22023';
  end if;

  insert into public.metricool_credentials (
    organization_id, blog_id, user_token_hash, encrypted_token, status, updated_at
  ) values (
    p_organization_id, p_blog_id, p_user_token_hash, coalesce(p_encrypted_token, '{}'::jsonb), 'connected', now()
  )
  on conflict (organization_id)
  do update set
    blog_id = excluded.blog_id,
    user_token_hash = excluded.user_token_hash,
    encrypted_token = excluded.encrypted_token,
    status = 'connected',
    updated_at = now();
end;
$$;

revoke all on function public.metricool_set_credentials(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.metricool_set_credentials(uuid, text, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Sincronização em lote de contas sociais (service_role)
-- ---------------------------------------------------------------------------
create or replace function public.metricool_sync_social_accounts(
  p_organization_id uuid,
  p_accounts jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_network text;
  v_account_type text;
  v_external_id text;
  v_handle text;
  v_display_name text;
  v_capabilities text[];
  v_synced integer := 0;
begin
  if p_organization_id is null then
    raise exception 'invalid_organization_id' using errcode = '22023';
  end if;

  if p_accounts is null or jsonb_typeof(p_accounts) <> 'array' then
    raise exception 'invalid_accounts_array' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_accounts)
  loop
    v_network := v_item->>'network';
    v_account_type := v_item->>'account_type';
    v_external_id := v_item->>'external_account_id';
    v_handle := v_item->>'handle';
    v_display_name := v_item->>'display_name';
    v_capabilities := array(select jsonb_array_elements_text(coalesce(v_item->'capabilities', '[]'::jsonb)));

    if v_network is null or v_account_type is null or v_external_id is null then
      continue;
    end if;

    -- Respeita as constraints de rede social do S17
    if v_network in ('instagram', 'threads') and v_account_type not in ('business', 'creator') then
      continue;
    end if;
    if v_network = 'facebook' and v_account_type <> 'page' then
      continue;
    end if;
    if v_network = 'youtube' and v_account_type <> 'channel' then
      continue;
    end if;
    if v_network = 'x' then
      -- O X não é atendido pelo Metricool
      continue;
    end if;

    insert into public.social_accounts (
      organization_id, network, account_type, via, external_account_id,
      handle, display_name, status, capabilities, last_synced_at
    ) values (
      p_organization_id, v_network, v_account_type, 'metricool', v_external_id,
      v_handle, v_display_name, 'connected', v_capabilities, now()
    )
    on conflict (organization_id, network, external_account_id)
    do update set
      account_type = excluded.account_type,
      handle = excluded.handle,
      display_name = excluded.display_name,
      status = 'connected',
      capabilities = excluded.capabilities,
      last_synced_at = now(),
      updated_at = now();

    v_synced := v_synced + 1;
  end loop;

  update public.metricool_credentials
  set last_synced_at = now(), updated_at = now()
  where organization_id = p_organization_id;

  return v_synced;
end;
$$;

revoke all on function public.metricool_sync_social_accounts(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.metricool_sync_social_accounts(uuid, jsonb) to service_role;
