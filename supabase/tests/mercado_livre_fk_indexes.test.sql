begin;

do $s11_fk_indexes$
begin
  if to_regclass('public.ml_credentials_conn_org_domain_fk_idx') is null then
    raise exception 'missing Mercado Livre credentials composite FK index';
  end if;
  if to_regclass('public.ml_oauth_conn_org_domain_fk_idx') is null then
    raise exception 'missing Mercado Livre OAuth connection composite FK index';
  end if;
  if to_regclass('public.ml_oauth_created_by_fk_idx') is null then
    raise exception 'missing Mercado Livre OAuth created_by FK index';
  end if;
  if to_regclass('public.ml_oauth_org_fk_idx') is null then
    raise exception 'missing Mercado Livre OAuth organization FK index';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.mercado_livre_credentials'::regclass) then
    raise exception 'credentials table must keep RLS enabled';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.mercado_livre_oauth_attempts'::regclass) then
    raise exception 'OAuth attempts table must keep RLS enabled';
  end if;

  if has_table_privilege('anon', 'public.mercado_livre_credentials', 'select')
     or has_table_privilege('authenticated', 'public.mercado_livre_credentials', 'select')
     or has_table_privilege('anon', 'public.mercado_livre_oauth_attempts', 'select')
     or has_table_privilege('authenticated', 'public.mercado_livre_oauth_attempts', 'select') then
    raise exception 'browser roles must not read Mercado Livre secret tables';
  end if;
end;
$s11_fk_indexes$;

rollback;
