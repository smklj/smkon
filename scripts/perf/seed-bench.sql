-- S16 · Dados sintéticos de volume para medir as consultas das telas (EXPLAIN ANALYZE).
-- SOMENTE em banco descartável local (ver scripts/perf/bench-db.sh). Nunca no Supabase hospedado.
--
-- Volume: 20 workspaces; o workspace "alvo" concentra a maior parte das linhas para
-- representar um cliente grande, e os demais criam a distribuição multi-tenant.
--   products ~50 mil · content_items ~50 mil · media_assets ~30 mil · media_licenses ~45 mil
--   agent_runs 30 mil · agent_steps 150 mil
--   contacts 50 mil · consent_events 100 mil · data_subject_requests ~400
--
-- Os gatilhos (auditoria, guards, snapshots) ficam desligados durante a carga
-- (session_replication_role = replica): medem-se leituras, não as regras de escrita,
-- que já são cobertas pelos testes SQL.

\set ON_ERROR_STOP on
set session_replication_role = replica;
select setseed(0.16);

-- Usuário de leitura do workspace alvo (uid fixo para o EXPLAIN) e um usuário por workspace.
insert into auth.users (id, email, created_at, updated_at)
select ('00000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'bench' || g || '@example.test', now(), now()
from generate_series(1, 20) g;

insert into public.organizations (id, name, slug, created_by)
select ('10000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'Bench ' || g, 'bench-' || g,
       ('00000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid
from generate_series(1, 20) g;

insert into public.organization_members (organization_id, user_id, role)
select ('10000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
       ('00000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'owner'
from generate_series(1, 20) g;

-- Workspace 1 = alvo (60% das linhas); os outros 19 dividem o restante.
create temporary table bench_org_pick as
select g as n,
       case when g % 10 < 6 then 1 else 2 + (g % 19) end as org_n
from generate_series(1, 50000) g;

insert into public.products (organization_id, created_by, name, source, type, status, revenue_domain,
                             price_cents, commission_percent, score, score_reasons, created_at, updated_at)
select ('10000000-0000-4000-8000-' || lpad(p.org_n::text, 12, '0'))::uuid,
       ('00000000-0000-4000-8000-' || lpad(p.org_n::text, 12, '0'))::uuid,
       'Produto ' || p.n,
       (array['kiwify','hotmart','shopify','amazon','manual','other'])[1 + (p.n % 6)],
       (array['digital','info','physical','service','unknown'])[1 + (p.n % 5)],
       (array['discovered','selected','active','archived'])[1 + (p.n % 4)],
       (array['owned_sales','affiliate','paid_media'])[1 + (p.n % 3)]::smkon_revenue_domain,
       (random() * 50000)::int,
       round((random() * 60)::numeric, 2),
       -- 30% sem score (sem evidência verificada) e muitos empates de score.
       case when random() < 0.3 then null else round((random() * 20)::numeric) * 5 end,
       '[]'::jsonb,
       now() - (random() * interval '365 days'),
       -- empates de updated_at de propósito: o desempate por id precisa ser estável.
       date_trunc('minute', now() - (random() * interval '180 days'))
from bench_org_pick p;

insert into public.media_assets (organization_id, storage_path, kind, mime_type, size_bytes, original_name,
                                 uploaded_by, created_at, archived_at, archived_by)
select o.id, o.id::text || '/' || gen_random_uuid()::text || '.mp4',
       case when p.n % 3 = 0 then 'image' else 'video' end,
       case when p.n % 3 = 0 then 'image/png' else 'video/mp4' end,
       (random() * 50000000)::bigint + 1, 'arquivo-' || p.n || '.mp4', o.created_by,
       date_trunc('minute', now() - (random() * interval '365 days')),
       case when p.n % 7 = 0 then now() else null end,
       case when p.n % 7 = 0 then o.created_by else null end
from bench_org_pick p
join public.organizations o on o.id = ('10000000-0000-4000-8000-' || lpad(p.org_n::text, 12, '0'))::uuid
where p.n <= 30000;

insert into public.media_licenses (organization_id, media_asset_id, license_type, licensor, allows_commercial_use,
                                   allows_modification, valid_from, recorded_by, created_at)
select m.organization_id, m.id, 'own_production', 'Licenciante ' || k, true, true,
       current_date - 30, m.uploaded_by, m.created_at + k * interval '1 minute'
from public.media_assets m
cross join generate_series(1, 2) k
where k = 1 or (hashtext(m.id::text) % 2 = 0);

insert into public.content_items (organization_id, created_by, title, product, caption, channels, status,
                                  version, content_hash, created_at, updated_at)
select ('10000000-0000-4000-8000-' || lpad(p.org_n::text, 12, '0'))::uuid,
       ('00000000-0000-4000-8000-' || lpad(p.org_n::text, 12, '0'))::uuid,
       'Peça ' || p.n, 'Produto ' || p.n, repeat('legenda ', 20), array['YouTube','Instagram'],
       (array['draft','approved','archived'])[1 + (p.n % 3)], 1, md5(p.n::text) || md5(p.n::text),
       now() - (random() * interval '365 days'),
       date_trunc('minute', now() - (random() * interval '180 days'))
from bench_org_pick p;

-- Execuções de agentes (lista de /agentes): 30 mil execuções, 5 passos cada (150 mil passos).
insert into public.agent_runs (organization_id, agent, goal, status, max_steps, step_count, created_by,
                               created_at, started_at, finished_at)
select ('10000000-0000-4000-8000-' || lpad(p.org_n::text, 12, '0'))::uuid,
       (array['product_research','content_drafting','operations_review'])[1 + (p.n % 3)],
       'Objetivo de benchmark ' || p.n,
       (array['succeeded','failed','cancelled','killed'])[1 + (p.n % 4)],
       12, 5,
       ('00000000-0000-4000-8000-' || lpad(p.org_n::text, 12, '0'))::uuid,
       t.at, t.at, t.at + interval '30 seconds'
from bench_org_pick p
-- Um instante por linha (a expressão depende de p.n; random() num lateral sem correlação
-- seria avaliado uma vez só). Granularidade de minuto em 365 dias: há empates.
cross join lateral (
  select date_trunc('minute', now()) - ((hashtext('run' || p.n)::bigint & 2147483647) % 525600) * interval '1 minute' as at
) t
where p.n <= 30000;

insert into public.agent_steps (organization_id, run_id, seq, phase, tool, status, detail, created_at)
select r.organization_id, r.id, s,
       case when s = 1 then 'plan' when s = 5 then 'verify' else 'execute' end,
       case when s in (1, 5) then null else 'read_products' end,
       'ok', 'passo ' || s, r.created_at + s * interval '1 second'
from public.agent_runs r
cross join generate_series(1, 5) s;

-- Audiência (/audiencia, S15): 50 mil contatos, ~2 eventos de consentimento por contato e
-- ~1% com pedido do titular. 5% anonimizados (sem dado pessoal, como a anonimização deixa).
-- created_at com granularidade de minuto: há empates, como nas demais listas.
insert into public.contacts (organization_id, display_name, email, phone, source, purpose, legal_basis,
                             created_by, created_at, updated_at, last_activity_at, anonymized_at, anonymized_by)
select ('10000000-0000-4000-8000-' || lpad(p.org_n::text, 12, '0'))::uuid,
       case when anon then null else 'Contato ' || p.n end,
       case when anon then null else 'contato' || p.n || '@example.test' end,
       case when anon or p.n % 3 <> 0 then null else '+55119' || lpad(p.n::text, 8, '0') end,
       (array['manual','form','event','purchase','social','import'])[1 + (p.n % 6)],
       'newsletter', 'consent',
       ('00000000-0000-4000-8000-' || lpad(p.org_n::text, 12, '0'))::uuid,
       t.at, t.at, t.at,
       case when anon then t.at + interval '1 day' end,
       case when anon then ('00000000-0000-4000-8000-' || lpad(p.org_n::text, 12, '0'))::uuid end
from bench_org_pick p
cross join lateral (
  select date_trunc('minute', now()) - ((hashtext('ct' || p.n)::bigint & 2147483647) % 525600) * interval '1 minute' as at,
         p.n % 20 = 0 as anon
) t;

insert into public.consent_events (organization_id, contact_id, action, purpose, channel, evidence_type,
                                   evidence_ref, occurred_at, recorded_by, created_at)
select c.organization_id, c.id,
       case when s = 2 and (hashtext(c.id::text) & 3) = 0 then 'opt_out' else 'opt_in' end,
       'newsletter', (array['email','whatsapp'])[s], 'form_checkbox', 'formulário bench',
       c.created_at + s * interval '1 minute', c.created_by, c.created_at + s * interval '1 minute'
from public.contacts c
cross join generate_series(1, 2) s;

insert into public.data_subject_requests (organization_id, contact_id, kind, received_via, received_at, due_at,
                                          status, resolved_at, resolved_by, created_by, created_at)
select c.organization_id, c.id, 'access', 'email', c.created_at, c.created_at + interval '15 days',
       case when r.open then 'open' else 'completed' end,
       case when r.open then null else c.created_at + interval '2 days' end,
       case when r.open then null else c.created_by end,
       c.created_by, c.created_at
from public.contacts c
cross join lateral (select (hashtext(c.id::text) & 1) = 0 as open) r
where (hashtext('dsr' || c.id::text) & 127) = 0;

set session_replication_role = origin;
analyze;

select 'products' as tabela, count(*) from public.products
union all select 'content_items', count(*) from public.content_items
union all select 'media_assets', count(*) from public.media_assets
union all select 'media_licenses', count(*) from public.media_licenses
union all select 'agent_runs', count(*) from public.agent_runs
union all select 'agent_steps', count(*) from public.agent_steps
union all select 'contacts', count(*) from public.contacts
union all select 'consent_events', count(*) from public.consent_events
union all select 'data_subject_requests', count(*) from public.data_subject_requests;
