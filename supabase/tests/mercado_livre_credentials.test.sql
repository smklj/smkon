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

rollback;
