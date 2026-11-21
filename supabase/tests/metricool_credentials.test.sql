begin;

do $s19_metricool_structure$
declare
  v_definer boolean;
  v_config text[];
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'metricool_credentials' and c.relrowsecurity
  ) then
    raise exception 'metricool_credentials must keep RLS enabled';
  end if;

  select p.prosecdef, p.proconfig
    into v_definer, v_config
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'metricool_set_credentials';

  if v_definer is distinct from true
     or not ('search_path=""' = any(coalesce(v_config, array[]::text[]))) then
    raise exception 'set credentials RPC must be SECURITY DEFINER with empty search_path';
  end if;

  if has_function_privilege('anon', 'public.metricool_set_credentials(uuid,text,text,jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.metricool_set_credentials(uuid,text,text,jsonb)', 'execute')
     or not has_function_privilege('service_role', 'public.metricool_set_credentials(uuid,text,text,jsonb)', 'execute') then
    raise exception 'set credentials RPC privilege boundary is incorrect';
  end if;

  select p.prosecdef, p.proconfig
    into v_definer, v_config
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'metricool_sync_social_accounts';

  if v_definer is distinct from true
     or not ('search_path=""' = any(coalesce(v_config, array[]::text[]))) then
    raise exception 'sync accounts RPC must be SECURITY DEFINER with empty search_path';
  end if;

  if has_function_privilege('anon', 'public.metricool_sync_social_accounts(uuid,jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.metricool_sync_social_accounts(uuid,jsonb)', 'execute')
     or not has_function_privilege('service_role', 'public.metricool_sync_social_accounts(uuid,jsonb)', 'execute') then
    raise exception 'sync accounts RPC privilege boundary is incorrect';
  end if;
end;
$s19_metricool_structure$;

do $s19_metricool_behavior$
declare
  v_user uuid := 'f1900000-0000-4000-8000-000000000001';
  v_org uuid := 'f1900000-0000-4000-8000-000000000002';
  v_token_hash text := encode(sha256('metricool_user_token_abc'::bytea), 'hex');
  v_count integer;
  v_synced integer;
begin
  insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values (v_user, 'authenticated', 'authenticated', 's19-metricool@example.invalid', '', now(), now(), now());

  insert into public.organizations (id, name, slug, created_by)
  values (v_org, 'S19 Metricool Org', 's19-metricool-org', v_user);

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org, v_user, 'owner');

  -- 1. Gravar credenciais
  perform public.metricool_set_credentials(
    v_org, 'blog-12345', v_token_hash, '{"v":1}'::jsonb
  );

  select count(*) into v_count
  from public.metricool_credentials
  where organization_id = v_org and blog_id = 'blog-12345';

  if v_count <> 1 then
    raise exception 'credentials must be saved';
  end if;

  -- 2. Sincronizar contas respeitando as regras das redes (Instagram Business, Facebook Page, X ignorado)
  select public.metricool_sync_social_accounts(
    v_org,
    jsonb_build_array(
      jsonb_build_object(
        'network', 'instagram',
        'account_type', 'business',
        'external_account_id', 'ig-999',
        'handle', 'minhaloja',
        'display_name', 'Minha Loja IG',
        'capabilities', jsonb_build_array('publish', 'read_metrics')
      ),
      jsonb_build_object(
        'network', 'facebook',
        'account_type', 'page',
        'external_account_id', 'fb-888',
        'handle', 'minhapagina',
        'display_name', 'Minha Página FB',
        'capabilities', jsonb_build_array('publish', 'read_metrics')
      ),
      -- Inválido: Instagram pessoal não é aceito
      jsonb_build_object(
        'network', 'instagram',
        'account_type', 'personal',
        'external_account_id', 'ig-invalid',
        'handle', 'pessoal'
      ),
      -- Inválido: X via Metricool não é aceito
      jsonb_build_object(
        'network', 'x',
        'account_type', 'business',
        'external_account_id', 'x-invalid',
        'handle', 'xloja'
      )
    )
  ) into v_synced;

  -- Devem ter sido sincronizadas exatamente 2 contas válidas (as 2 inválidas ignoradas)
  if v_synced <> 2 then
    raise exception 'only valid accounts conforming to constraints must be synced, got %', v_synced;
  end if;

  select count(*) into v_count
  from public.social_accounts
  where organization_id = v_org and via = 'metricool';

  if v_count <> 2 then
    raise exception 'exactly 2 social accounts must exist in table';
  end if;
end;
$s19_metricool_behavior$;

rollback;
