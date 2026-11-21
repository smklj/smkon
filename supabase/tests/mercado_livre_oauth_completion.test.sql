begin;

do $s11_oauth_completion_structure$
declare
  v_definer boolean;
  v_config text[];
begin
  select p.prosecdef, p.proconfig into v_definer, v_config
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'mercado_livre_complete_oauth_connection';

  if v_definer is distinct from true
     or not ('search_path=""' = any(coalesce(v_config, array[]::text[]))) then
    raise exception 'OAuth completion RPC must be SECURITY DEFINER with empty search_path';
  end if;

  if has_function_privilege('anon', 'public.mercado_livre_complete_oauth_connection(uuid,uuid,uuid,text,text,text[],jsonb,timestamp with time zone)', 'execute')
     or has_function_privilege('authenticated', 'public.mercado_livre_complete_oauth_connection(uuid,uuid,uuid,text,text,text[],jsonb,timestamp with time zone)', 'execute')
     or not has_function_privilege('service_role', 'public.mercado_livre_complete_oauth_connection(uuid,uuid,uuid,text,text,text[],jsonb,timestamp with time zone)', 'execute') then
    raise exception 'OAuth completion RPC privilege boundary is incorrect';
  end if;
end;
$s11_oauth_completion_structure$;

do $s11_oauth_completion_behavior$
declare
  v_user uuid := 'f4100000-0000-4000-8000-000000000001';
  v_non_admin uuid := 'f4100000-0000-4000-8000-000000000002';
  v_org uuid := 'f4200000-0000-4000-8000-000000000001';
  v_connection uuid := 'f4300000-0000-4000-8000-000000000001';
  v_rejected boolean;
  v_status text;
  v_external_id text;
  v_display_name text;
  v_scopes text[];
  v_version bigint;
  v_lease uuid;
  v_consumed_count integer;
begin
  insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values
    (v_user, 'authenticated', 'authenticated', 's11-oauth-owner@example.invalid', '', now(), now(), now()),
    (v_non_admin, 'authenticated', 'authenticated', 's11-oauth-member@example.invalid', '', now(), now(), now());

  insert into public.organizations (id, name, slug, created_by)
  values (v_org, 'S11 OAuth Completion', 's11-oauth-completion', v_user);
  insert into public.organization_members (organization_id, user_id, role)
  values (v_org, v_user, 'owner'), (v_org, v_non_admin, 'viewer');
  insert into public.source_connections (id, organization_id, domain, provider, display_name, status)
  values (v_connection, v_org, 'owned_sales', 'mercado_livre', 'Mercado Livre', 'pending');

  -- OAuth state is one-time, owner-bound and expires.
  insert into public.mercado_livre_oauth_attempts (
    state_hash, organization_id, connection_id, domain, created_by,
    encrypted_verifier, expires_at
  ) values (
    repeat('f', 64), v_org, v_connection, 'owned_sales', v_user,
    '{"v":1,"alg":"A256GCM","kid":"test","iv":"AAAAAAAAAAAAAAAA","tag":"AAAAAAAAAAAAAAAAAAAAAA==","ciphertext":"AA=="}'::jsonb,
    now() + interval '5 minutes'
  );
  select count(*) into v_consumed_count
  from public.mercado_livre_consume_oauth_attempt(repeat('f', 64), v_non_admin);
  if v_consumed_count <> 0 then raise exception 'OAuth state must not be consumable by another user'; end if;
  select count(*) into v_consumed_count
  from public.mercado_livre_consume_oauth_attempt(repeat('f', 64), v_user);
  if v_consumed_count <> 1 then raise exception 'OAuth state must be consumable once by its initiating user'; end if;
  select count(*) into v_consumed_count
  from public.mercado_livre_consume_oauth_attempt(repeat('f', 64), v_user);
  if v_consumed_count <> 0 then raise exception 'OAuth state replay must be rejected'; end if;

  insert into public.mercado_livre_oauth_attempts (
    state_hash, organization_id, connection_id, domain, created_by,
    encrypted_verifier, expires_at
  ) values (
    repeat('e', 64), v_org, v_connection, 'owned_sales', v_user,
    '{"v":1,"alg":"A256GCM","kid":"test","iv":"BBBBBBBBBBBBBBBB","tag":"BBBBBBBBBBBBBBBBBBBBBB==","ciphertext":"AQ=="}'::jsonb,
    now() - interval '1 minute'
  );
  select count(*) into v_consumed_count
  from public.mercado_livre_consume_oauth_attempt(repeat('e', 64), v_user);
  if v_consumed_count <> 0 then raise exception 'expired OAuth state must be rejected'; end if;

  perform public.mercado_livre_complete_oauth_connection(
    v_connection, v_org, v_user, '123456789', 'Mercado Livre · seller-test',
    array['read','offline_access'],
    '{"v":1,"alg":"A256GCM","kid":"test","iv":"AAAAAAAAAAAAAAAA","tag":"AAAAAAAAAAAAAAAAAAAAAA==","ciphertext":"AA=="}'::jsonb,
    now() + interval '1 hour'
  );

  select status, external_account_id, display_name, granted_scopes
    into v_status, v_external_id, v_display_name, v_scopes
  from public.source_connections where id = v_connection;
  select token_version into v_version from public.mercado_livre_credentials where connection_id = v_connection;

  if v_status <> 'connected' or v_external_id <> '123456789'
     or v_display_name <> 'Mercado Livre · seller-test'
     or v_scopes <> array['read','offline_access']
     or v_version <> 1 then
    raise exception 'OAuth completion did not atomically activate connection and save credentials';
  end if;

  -- An active refresh lease blocks credential replacement; the connection update must roll back too.
  update public.mercado_livre_credentials
  set refresh_lease_until = now() + interval '1 minute',
      refresh_lease_id = 'f4400000-0000-4000-8000-000000000001'
  where connection_id = v_connection;
  update public.source_connections set display_name = 'Before failed reauth' where id = v_connection;

  v_rejected := false;
  begin
    perform public.mercado_livre_complete_oauth_connection(
      v_connection, v_org, v_user, '123456789', 'After failed reauth',
      array['read'],
      '{"v":1,"alg":"A256GCM","kid":"test","iv":"BBBBBBBBBBBBBBBB","tag":"BBBBBBBBBBBBBBBBBBBBBB==","ciphertext":"AQ=="}'::jsonb,
      now() + interval '2 hours'
    );
  exception when others then v_rejected := true;
  end;
  if not v_rejected then raise exception 'active refresh lease must reject OAuth token replacement'; end if;

  select display_name into v_display_name from public.source_connections where id = v_connection;
  select token_version, refresh_lease_id into v_version, v_lease
  from public.mercado_livre_credentials where connection_id = v_connection;
  if v_display_name <> 'Before failed reauth' or v_version <> 1 or v_lease is null then
    raise exception 'failed OAuth completion must roll back connection metadata';
  end if;

  update public.mercado_livre_credentials
  set refresh_lease_until = null, refresh_lease_id = null
  where connection_id = v_connection;

  perform public.mercado_livre_complete_oauth_connection(
    v_connection, v_org, v_user, '123456789', 'After successful reauth',
    array['read'],
    '{"v":1,"alg":"A256GCM","kid":"test","iv":"CCCCCCCCCCCCCCCC","tag":"CCCCCCCCCCCCCCCCCCCCCC==","ciphertext":"Ag=="}'::jsonb,
    now() + interval '2 hours'
  );
  select token_version into v_version from public.mercado_livre_credentials where connection_id = v_connection;
  select display_name into v_display_name from public.source_connections where id = v_connection;
  if v_version <> 2 or v_display_name <> 'After successful reauth' then
    raise exception 'successful reauthorization must update credentials and metadata together';
  end if;

  v_rejected := false;
  begin
    perform public.mercado_livre_complete_oauth_connection(
      v_connection, v_org, v_non_admin, '123456789', 'Member attempt',
      array['read'],
      '{"v":1,"alg":"A256GCM","kid":"test","iv":"DDDDDDDDDDDDDDDD","tag":"DDDDDDDDDDDDDDDDDDDDDD==","ciphertext":"Aw=="}'::jsonb,
      now() + interval '2 hours'
    );
  exception when others then v_rejected := true;
  end;
  if not v_rejected then raise exception 'non-admin member must not complete OAuth'; end if;

  v_rejected := false;
  begin
    perform public.mercado_livre_complete_oauth_connection(
      v_connection, v_org, v_user, '999999999', 'Mismatched account',
      array['read'],
      '{"v":1,"alg":"A256GCM","kid":"test","iv":"EEEEEEEEEEEEEEEE","tag":"EEEEEEEEEEEEEEEEEEEEEE==","ciphertext":"BA=="}'::jsonb,
      now() + interval '2 hours'
    );
  exception when others then v_rejected := true;
  end;
  if not v_rejected then raise exception 'different external account must not replace a connection'; end if;
end;
$s11_oauth_completion_behavior$;

rollback;
