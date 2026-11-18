-- SMKON S6: limite de tentativas (janela fixa) no Postgres.
-- - Escopos e limites são definidos aqui, não pelo cliente.
-- - Escopos de login recebem só o SHA-256 (hex) do IP ou do e-mail: o banco nunca guarda o valor real.
-- - Escopos autenticados usam auth.uid(); o sujeito enviado pelo cliente é ignorado.
-- - A tabela não é acessível pela API; só a função lê e escreve nela.

create table public.rate_limit_buckets (
  scope text not null,
  subject text not null,
  window_start timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  primary key (scope, subject, window_start)
);

create index rate_limit_buckets_window_idx on public.rate_limit_buckets (window_start);

alter table public.rate_limit_buckets enable row level security;
revoke all on public.rate_limit_buckets from anon, authenticated;

create or replace function public.rate_limit_consume(p_scope text, p_subject text default null)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_window integer;
  v_subject text;
  v_start timestamptz;
  v_hits integer;
begin
  case p_scope
    when 'login_ip' then v_limit := 30; v_window := 900;       -- 30 tentativas / 15 min por IP
    when 'login_email' then v_limit := 10; v_window := 900;    -- 10 tentativas / 15 min por e-mail
    when 'invite_create' then v_limit := 30; v_window := 3600; -- 30 convites / hora por usuário
    when 'invite_accept' then v_limit := 20; v_window := 3600; -- 20 aceites / hora por usuário
    else
      raise exception 'invalid_rate_limit_scope' using errcode = 'P0001';
  end case;

  if p_scope in ('invite_create', 'invite_accept') then
    if auth.uid() is null then
      raise exception 'not_authenticated' using errcode = '42501';
    end if;
    v_subject := auth.uid()::text;
  else
    v_subject := coalesce(p_subject, '');
    if v_subject !~ '^[a-f0-9]{64}$' then
      raise exception 'invalid_rate_limit_subject' using errcode = 'P0001';
    end if;
  end if;

  v_start := to_timestamp(floor(extract(epoch from clock_timestamp()) / v_window) * v_window);

  insert into public.rate_limit_buckets as b (scope, subject, window_start, hits)
  values (p_scope, v_subject, v_start, 1)
  on conflict (scope, subject, window_start) do update set hits = b.hits + 1
  returning b.hits into v_hits;

  -- Limpeza oportunista de janelas antigas.
  if random() < 0.02 then
    delete from public.rate_limit_buckets where window_start < clock_timestamp() - interval '1 day';
  end if;

  return query select
    v_hits <= v_limit,
    greatest(v_limit - v_hits, 0),
    case
      when v_hits <= v_limit then 0
      else greatest(1, ceil(extract(epoch from (v_start + make_interval(secs => v_window) - clock_timestamp())))::integer)
    end;
end;
$$;

revoke all on function public.rate_limit_consume(text, text) from public;
grant execute on function public.rate_limit_consume(text, text) to anon, authenticated;
