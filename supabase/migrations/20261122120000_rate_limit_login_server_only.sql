-- SMKON: limite de tentativas de login só pelo servidor.
--
-- Problema: rate_limit_consume era executável por anon. Com a publishable key (pública),
-- qualquer pessoa podia chamar rate_limit_consume('login_email', sha256(email)) 11 vezes e
-- bloquear o login daquele e-mail por 15 minutos, em loop. Também podia inserir sujeitos
-- aleatórios sem limite na tabela de contadores.
--
-- Correção:
-- - Escopos de login (login_ip, login_email) passam para public.rate_limit_consume_login,
--   executável SOMENTE por service_role (a Server Action de login usa a chave de servidor).
-- - public.rate_limit_consume fica só para escopos autenticados (convites), sem anon, e
--   recusa escopos de login.
-- - A contagem fica numa função interna, sem EXECUTE para os papéis da API.

-- Interna: roda com os privilégios de quem chama (as duas funções abaixo, security definer).
create or replace function public.rate_limit_hit(p_scope text, p_subject text, p_limit integer, p_window integer)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_hits integer;
begin
  v_start := to_timestamp(floor(extract(epoch from clock_timestamp()) / p_window) * p_window);

  insert into public.rate_limit_buckets as b (scope, subject, window_start, hits)
  values (p_scope, p_subject, v_start, 1)
  on conflict (scope, subject, window_start) do update set hits = b.hits + 1
  returning b.hits into v_hits;

  -- Limpeza oportunista de janelas antigas.
  if random() < 0.02 then
    delete from public.rate_limit_buckets where window_start < clock_timestamp() - interval '1 day';
  end if;

  return query select
    v_hits <= p_limit,
    greatest(p_limit - v_hits, 0),
    case
      when v_hits <= p_limit then 0
      else greatest(1, ceil(extract(epoch from (v_start + make_interval(secs => p_window) - clock_timestamp())))::integer)
    end;
end;
$$;

revoke all on function public.rate_limit_hit(text, text, integer, integer) from public, anon, authenticated, service_role;

-- Escopos autenticados: o sujeito é sempre auth.uid(); o valor enviado é ignorado.
create or replace function public.rate_limit_consume(p_scope text, p_subject text default null)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_scope in ('login_ip', 'login_email') then
    raise exception 'login_scope_server_only' using errcode = '42501';
  end if;
  if p_scope not in ('invite_create', 'invite_accept') then
    raise exception 'invalid_rate_limit_scope' using errcode = 'P0001';
  end if;
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  return query select * from public.rate_limit_hit(
    p_scope,
    auth.uid()::text,
    case p_scope when 'invite_create' then 30 else 20 end,  -- 30 convites / hora; 20 aceites / hora
    3600
  );
end;
$$;

revoke all on function public.rate_limit_consume(text, text) from public, anon;
grant execute on function public.rate_limit_consume(text, text) to authenticated;

-- Escopos de login: só a chave de servidor. Recebe apenas o SHA-256 (hex) do IP ou do e-mail.
create or replace function public.rate_limit_consume_login(p_scope text, p_subject text)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_scope not in ('login_ip', 'login_email') then
    raise exception 'invalid_rate_limit_scope' using errcode = 'P0001';
  end if;
  if coalesce(p_subject, '') !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_rate_limit_subject' using errcode = 'P0001';
  end if;

  return query select * from public.rate_limit_hit(
    p_scope,
    p_subject,
    case p_scope when 'login_ip' then 30 else 10 end,  -- 30 por IP e 10 por e-mail, a cada 15 min
    900
  );
end;
$$;

revoke all on function public.rate_limit_consume_login(text, text) from public, anon, authenticated;
grant execute on function public.rate_limit_consume_login(text, text) to service_role;
