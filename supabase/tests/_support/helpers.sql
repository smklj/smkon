-- Helpers de teste SQL (sem dependência de pgTAP).
-- Cada falha interrompe a execução (psql com ON_ERROR_STOP=1) com a mensagem "FAIL: ...".

create schema if not exists tests;

-- Afirmação simples.
create or replace function tests.ok(p_condition boolean, p_description text)
returns void
language plpgsql
as $$
begin
  if p_condition is distinct from true then
    raise exception 'FAIL: %', p_description;
  end if;
  raise notice 'ok - %', p_description;
end;
$$;

-- Executa SQL e exige erro. p_expected pode ser a mensagem exata (ex.: 'hash_mismatch')
-- ou o SQLSTATE (ex.: '42501'). Roda com o papel corrente (não é security definer).
create or replace function tests.throws(p_sql text, p_expected text, p_description text)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm = p_expected or sqlstate = p_expected or sqlerrm like '%' || p_expected || '%' then
      raise notice 'ok - % (erro esperado: %)', p_description, sqlerrm;
      return;
    end if;
    raise exception 'FAIL: % — erro inesperado [%] %', p_description, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL: % — o comando deveria falhar com "%"', p_description, p_expected;
end;
$$;

-- Simula a sessão de um usuário autenticado (claims do JWT).
create or replace function tests.login(p_user uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end;
$$;

create or replace function tests.create_user(p_user uuid, p_email text)
returns void
language sql
as $$
  insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values (p_user, 'authenticated', 'authenticated', p_email, '', now(), now(), now());
$$;

grant usage on schema tests to anon, authenticated, service_role;
grant execute on all functions in schema tests to anon, authenticated, service_role;
