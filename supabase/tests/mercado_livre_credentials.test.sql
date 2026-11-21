-- S11 Mercado Livre credentials: structural security and schema regression tests.
-- Runs after all migrations in scripts/test-db.sh against a disposable PostgreSQL database.
begin;

do $$
declare
  v_rls boolean;
  v_definer boolean;
  v_search_path text[];
begin
  select c.relrowsecurity into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'mercado_livre_credentials';
  if v_rls is distinct from true then
    raise exception 'mercado_livre_credentials must have RLS enabled';
  end if;

  if has_table_privilege('anon', 'public.mercado_livre_credentials', 'select')
     or has_table_privilege('authenticated', 'public.mercado_livre_credentials', 'select')
     or has_table_privilege('anon', 'public.mercado_livre_credentials', 'insert')
     or has_table_privilege('authenticated', 'public.mercado_livre_credentials', 'insert') then
    raise exception 'client roles must not access Mercado Livre credentials';
  end if;

  if not has_table_privilege('service_role', 'public.mercado_livre_credentials', 'select')
     or not has_table_privilege('service_role', 'public.mercado_livre_credentials', 'insert')
     or not has_table_privilege('service_role', 'public.mercado_livre_credentials', 'update') then
    raise exception 'service_role must have required credential table privileges';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.mercado_livre_credentials'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) like '%(connection_id, organization_id, domain)%'
  ) then
    raise exception 'credentials must be tenant/domain-bound to source_connections';
  end if;

  select p.prosecdef, p.proconfig
    into v_definer, v_search_path
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'mercado_livre_claim_refresh'
    and pg_get_function_identity_arguments(p.oid) = 'p_connection_id uuid, p_lease_seconds integer';

  if v_definer is distinct from true or not ('search_path=""' = any(coalesce(v_search_path, array[]::text[]))) then
    raise exception 'claim_refresh must be SECURITY DEFINER with empty search_path';
  end if;

  if has_function_privilege('anon', 'public.mercado_livre_claim_refresh(uuid,integer)', 'execute')
     or has_function_privilege('authenticated', 'public.mercado_livre_claim_refresh(uuid,integer)', 'execute')
     or not has_function_privilege('service_role', 'public.mercado_livre_claim_refresh(uuid,integer)', 'execute') then
    raise exception 'claim_refresh execute privilege boundary is incorrect';
  end if;

  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'mercado_livre_oauth_attempts' and c.relrowsecurity
  ) then
    raise exception 'OAuth attempts table must have RLS enabled';
  end if;

  if has_table_privilege('anon', 'public.mercado_livre_oauth_attempts', 'select')
     or has_table_privilege('authenticated', 'public.mercado_livre_oauth_attempts', 'select')
     or not has_table_privilege('service_role', 'public.mercado_livre_oauth_attempts', 'insert') then
    raise exception 'OAuth attempts table privilege boundary is incorrect';
  end if;

  if has_function_privilege('anon', 'public.mercado_livre_consume_oauth_attempt(text,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.mercado_livre_consume_oauth_attempt(text,uuid)', 'execute')
     or not has_function_privilege('service_role', 'public.mercado_livre_consume_oauth_attempt(text,uuid)', 'execute') then
    raise exception 'OAuth state consume RPC privilege boundary is incorrect';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'mercado_livre_credentials'
      and column_name = 'refresh_lease_id' and data_type = 'uuid'
  ) then
    raise exception 'refresh lease ownership id is missing';
  end if;
end;
$$;


-- Behavioral lease/CAS test with disposable tenant fixtures.
-- The surrounding test transaction rolls all fixture rows back.
do $
declare
  v_user uuid := 'f1000000-0000-4000-8000-000000000001';
  v_org uuid := 'f2000000-0000-4000-8000-000000000001';
  v_connection uuid := 'f3000000-0000-4000-8000-000000000001';
  v_old_lease uuid;
  v_new_lease uuid;
  v_claim record;
  v_second_count integer;
  v_saved boolean;
  v_version bigint;
  v_lease_after uuid;
begin
  insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values (v_user, 'authenticated', 'authenticated', 's11-lease-test@example.invalid', '', now(), now(), now());

  insert into public.organizations (id, name, slug, created_by)
  values (v_org, 'S11 Lease Test', 's11-lease-test', v_user);

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org, v_user, 'owner');

  insert into public.source_connections (
    id, organization_id, domain, provider, external_account_id, status
  ) values (
    v_connection, v_org, 'owned_sales', 'mercado_livre', 'ml-test-account', 'connected'
  );

  insert into public.mercado_livre_credentials (
    connection_id, organization_id, domain, encrypted_tokens, token_expires_at
  ) values (
    v_connection,
    v_org,
    'owned_sales',
    '{"v":1,"alg":"A256GCM","kid":"test","iv":"AAAAAAAAAAAAAAAA","tag":"AAAAAAAAAAAAAAAAAAAAAA==","ciphertext":"AA=="}'::jsonb,
    now() + interval '1 hour'
  );

  -- First worker owns the lease; a concurrent claimant must receive no row.
  select * into v_claim
  from public.mercado_livre_claim_refresh(v_connection, 90);
  if v_claim.lease_id is null then
    raise exception 'first refresh worker must acquire a lease';
  end if;
  v_old_lease := v_claim.lease_id;

  select count(*) into v_second_count
  from public.mercado_livre_claim_refresh(v_connection, 90);
  if v_second_count <> 0 then
    raise exception 'second refresh worker must not acquire an active lease';
  end if;

  -- A stale/incorrect lease cannot commit the rotated token pair.
  select public.mercado_livre_save_refreshed_tokens(
    v_connection, 1, gen_random_uuid(),
    '{"v":1,"alg":"A256GCM","kid":"test","iv":"AAAAAAAAAAAAAAAA","tag":"AAAAAAAAAAAAAAAAAAAAAA==","ciphertext":"AQ=="}'::jsonb,
    now() + interval '2 hours'
  ) into v_saved;
  if v_saved is distinct from false then
    raise exception 'save with incorrect lease id must fail';
  end if;

  -- Correct lease + expected version commits exactly once and clears ownership.
  select public.mercado_livre_save_refreshed_tokens(
    v_connection, 1, v_old_lease,
    '{"v":1,"alg":"A256GCM","kid":"test","iv":"AAAAAAAAAAAAAAAA","tag":"AAAAAAAAAAAAAAAAAAAAAA==","ciphertext":"Ag=="}'::jsonb,
    now() + interval '2 hours'
  ) into v_saved;
  if v_saved is distinct from true then
    raise exception 'save with current lease/version must succeed';
  end if;

  select token_version, refresh_lease_id
    into v_version, v_lease_after
  from public.mercado_livre_credentials
  where connection_id = v_connection;
  if v_version <> 2 or v_lease_after is not null then
    raise exception 'successful CAS must increment version and clear lease';
  end if;

  -- Reacquire and prove stale cleanup cannot release a newer worker's lease.
  select * into v_claim
  from public.mercado_livre_claim_refresh(v_connection, 90);
  v_new_lease := v_claim.lease_id;
  if v_new_lease is null or v_new_lease = v_old_lease then
    raise exception 'a subsequent worker must receive a new lease id';
  end if;

  perform public.mercado_livre_release_refresh(v_connection, v_old_lease);
  select refresh_lease_id into v_lease_after
  from public.mercado_livre_credentials
  where connection_id = v_connection;
  if v_lease_after is distinct from v_new_lease then
    raise exception 'stale worker must not release a newer worker lease';
  end if;

  -- Correct lease/version pair remains able to complete the next rotation.
  select public.mercado_livre_save_refreshed_tokens(
    v_connection, 2, v_new_lease,
    '{"v":1,"alg":"A256GCM","kid":"test","iv":"AAAAAAAAAAAAAAAA","tag":"AAAAAAAAAAAAAAAAAAAAAA==","ciphertext":"Aw=="}'::jsonb,
    now() + interval '3 hours'
  ) into v_saved;
  if v_saved is distinct from true then
    raise exception 'second worker must save with its own lease and current version';
  end if;
end;
$;

rollback;
