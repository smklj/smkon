-- SMKON S15: audiência e CRM com consentimento (LGPD).
-- - contacts: dados mínimos por workspace (nome opcional, e-mail e/ou telefone), origem, finalidade e base legal.
-- - consent_events: só inclusão (opt_in / opt_out), com finalidade, canal, evidência e data do fato.
-- - contact_consent_state: estado atual derivado do histórico (último evento por finalidade × canal).
-- - data_subject_requests: pedidos do titular (acesso, correção, exclusão) com prazo de 15 dias.
-- - Exclusão = anonimização: os dados pessoais saem; histórico e auditoria ficam sem dado pessoal.
-- - Leitura para membros; escrita só por funções security definer (owner/admin).
-- - Auditoria própria que não grava dado pessoal no audit_log.
-- Nenhuma função envia mensagem: o módulo só registra.

-- ---------------------------------------------------------------------------
-- 1. Auditoria sem dado pessoal
-- ---------------------------------------------------------------------------
create or replace function public.audience_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pii text[] := array['display_name', 'email', 'phone', 'source_detail', 'evidence_ref', 'details', 'resolution_note'];
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_changed text[];
begin
  select coalesce(array_agg(k order by k), '{}') into v_changed
  from unnest(v_pii) as k
  where v_row ? k and (v_old -> k) is distinct from (v_new -> k);

  insert into public.audit_log (organization_id, actor_id, action, table_name, record_id, old_data, new_data)
  values (
    (v_row ->> 'organization_id')::uuid, auth.uid(), tg_op, tg_table_name, v_row ->> 'id',
    case when v_old is not null then v_old - v_pii end,
    case when v_new is not null then (v_new - v_pii) || jsonb_build_object('pii_fields_changed', to_jsonb(v_changed)) end
  );
  return null;
end;
$$;

revoke all on function public.audience_audit() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. contacts
-- ---------------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 120),
  email text check (email is null or (char_length(email) <= 254 and email = lower(email)
                                      and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  source text not null check (source in ('manual', 'form', 'event', 'purchase', 'social', 'import')),
  source_detail text check (source_detail is null or char_length(source_detail) between 1 and 200),
  purpose text not null check (purpose in ('marketing', 'newsletter', 'customer_service', 'order_fulfillment', 'research')),
  legal_basis text not null check (legal_basis in ('consent', 'legitimate_interest', 'contract')),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete restrict,
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  anonymized_at timestamptz,
  anonymized_by uuid references auth.users (id) on delete restrict,
  unique (id, organization_id),
  constraint contacts_identifier_required check (anonymized_at is not null or email is not null or phone is not null),
  constraint contacts_anonymized_clean check (
    anonymized_at is null or (display_name is null and email is null and phone is null and source_detail is null)
  ),
  constraint contacts_anonymized_coherent check ((anonymized_at is null) = (anonymized_by is null)),
  constraint contacts_basis_purpose check (
    (purpose <> 'order_fulfillment' or legal_basis = 'contract')
    and (purpose <> 'research' or legal_basis = 'consent')
    and (legal_basis <> 'contract' or purpose in ('order_fulfillment', 'customer_service'))
  )
);

create unique index contacts_org_email_key on public.contacts (organization_id, email) where email is not null;
create unique index contacts_org_phone_key on public.contacts (organization_id, phone) where phone is not null;
create index contacts_org_created_idx on public.contacts (organization_id, created_at desc);
create index contacts_created_by_idx on public.contacts (created_by);
create index contacts_updated_by_idx on public.contacts (updated_by);
create index contacts_anonymized_by_idx on public.contacts (anonymized_by);

alter table public.contacts enable row level security;
revoke all on public.contacts from anon, authenticated;
grant select on public.contacts to authenticated;

create policy "members read contacts" on public.contacts
  for select to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = contacts.organization_id and m.user_id = (select auth.uid())
  ));

-- Contato anonimizado não volta a ter dado pessoal nem muda de workspace.
create or replace function public.contacts_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'contact_immutable' using errcode = '42501';
  end if;
  if old.anonymized_at is not null then
    raise exception 'contact_anonymized' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.contacts_guard() from public, anon, authenticated;

create trigger contacts_guard before update on public.contacts
for each row execute function public.contacts_guard();
create trigger contacts_no_delete before delete on public.contacts
for each row execute function public.reject_mutation();
create trigger audit_contacts after insert or update on public.contacts
for each row execute function public.audience_audit();

-- ---------------------------------------------------------------------------
-- 3. consent_events (só inclusão)
-- ---------------------------------------------------------------------------
create table public.consent_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  contact_id uuid not null,
  action text not null check (action in ('opt_in', 'opt_out')),
  purpose text not null check (purpose in ('marketing', 'newsletter', 'customer_service', 'order_fulfillment', 'research')),
  channel text not null check (channel in ('email', 'whatsapp', 'sms', 'phone', 'social_dm')),
  evidence_type text not null check (evidence_type in (
    'form_checkbox', 'double_opt_in', 'written', 'recorded_call', 'unsubscribe_link', 'titular_request', 'import'
  )),
  evidence_ref text check (evidence_ref is null or char_length(evidence_ref) between 3 and 500),
  occurred_at timestamptz not null,
  recorded_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (contact_id, organization_id) references public.contacts (id, organization_id) on delete restrict
);

create index consent_events_contact_idx on public.consent_events (contact_id, purpose, channel, occurred_at desc, created_at desc);
create index consent_events_org_idx on public.consent_events (organization_id, created_at desc);
create index consent_events_recorded_by_idx on public.consent_events (recorded_by);

alter table public.consent_events enable row level security;
revoke all on public.consent_events from anon, authenticated;
grant select on public.consent_events to authenticated;

create policy "members read consent events" on public.consent_events
  for select to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = consent_events.organization_id and m.user_id = (select auth.uid())
  ));

-- Única alteração possível: apagar a referência da evidência na anonimização.
create or replace function public.consent_events_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'consent_events is append-only' using errcode = '42501';
  end if;
  if new.evidence_ref is not null
     or (new.id, new.organization_id, new.contact_id, new.action, new.purpose, new.channel, new.evidence_type,
         new.occurred_at, new.recorded_by, new.created_at)
        is distinct from
        (old.id, old.organization_id, old.contact_id, old.action, old.purpose, old.channel, old.evidence_type,
         old.occurred_at, old.recorded_by, old.created_at) then
    raise exception 'consent_events is append-only' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.consent_events_guard() from public, anon, authenticated;

create trigger consent_events_guard before update or delete on public.consent_events
for each row execute function public.consent_events_guard();
create trigger audit_consent_events after insert or update on public.consent_events
for each row execute function public.audience_audit();

-- Estado atual: último evento por contato × finalidade × canal (pela data do fato).
-- Empate (mesmo instante): a revogação prevalece.
create view public.contact_consent_state
with (security_invoker = true)
as
select distinct on (e.contact_id, e.purpose, e.channel)
  e.organization_id,
  e.contact_id,
  e.purpose,
  e.channel,
  e.action = 'opt_in' as granted,
  e.occurred_at,
  e.id as event_id
from public.consent_events e
order by e.contact_id, e.purpose, e.channel, e.occurred_at desc, e.created_at desc, (e.action = 'opt_out') desc, e.id desc;

revoke all on public.contact_consent_state from anon, authenticated;
grant select on public.contact_consent_state to authenticated;

-- ---------------------------------------------------------------------------
-- 4. data_subject_requests
-- ---------------------------------------------------------------------------
create table public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  contact_id uuid not null,
  kind text not null check (kind in ('access', 'correction', 'deletion')),
  received_via text not null check (received_via in ('email', 'form', 'phone', 'in_person', 'internal')),
  details text check (details is null or char_length(details) between 1 and 1000),
  received_at timestamptz not null,
  due_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'completed', 'rejected')),
  resolution_note text check (resolution_note is null or char_length(resolution_note) between 3 and 1000),
  resolved_by uuid references auth.users (id) on delete restrict,
  resolved_at timestamptz,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (contact_id, organization_id) references public.contacts (id, organization_id) on delete restrict,
  constraint dsr_due check (due_at > received_at),
  constraint dsr_resolution_coherent check ((status = 'open') = (resolved_at is null) and (resolved_at is null) = (resolved_by is null))
);

create index dsr_org_status_idx on public.data_subject_requests (organization_id, status, due_at);
create index dsr_contact_idx on public.data_subject_requests (contact_id, received_at desc);
create index dsr_created_by_idx on public.data_subject_requests (created_by);
create index dsr_resolved_by_idx on public.data_subject_requests (resolved_by);

alter table public.data_subject_requests enable row level security;
revoke all on public.data_subject_requests from anon, authenticated;
grant select on public.data_subject_requests to authenticated;

create policy "members read data subject requests" on public.data_subject_requests
  for select to authenticated using (exists (
    select 1 from public.organization_members m
    where m.organization_id = data_subject_requests.organization_id and m.user_id = (select auth.uid())
  ));

-- Pedido resolvido não muda, exceto a remoção de texto pessoal na anonimização.
create or replace function public.data_subject_requests_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'data_subject_requests is append-only' using errcode = '42501';
  end if;
  if (new.id, new.organization_id, new.contact_id, new.kind, new.received_via, new.received_at, new.due_at,
      new.created_by, new.created_at)
     is distinct from
     (old.id, old.organization_id, old.contact_id, old.kind, old.received_via, old.received_at, old.due_at,
      old.created_by, old.created_at) then
    raise exception 'request_immutable' using errcode = '42501';
  end if;
  if old.status <> 'open' and (
       (new.status, new.resolved_by, new.resolved_at) is distinct from (old.status, old.resolved_by, old.resolved_at)
       or (new.details is distinct from old.details and new.details is not null)
       or (new.resolution_note is distinct from old.resolution_note and new.resolution_note is not null)) then
    raise exception 'request_already_resolved' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.data_subject_requests_guard() from public, anon, authenticated;

create trigger data_subject_requests_guard before update or delete on public.data_subject_requests
for each row execute function public.data_subject_requests_guard();
create trigger audit_data_subject_requests after insert or update on public.data_subject_requests
for each row execute function public.audience_audit();

-- ---------------------------------------------------------------------------
-- 5. Funções auxiliares (internas)
-- ---------------------------------------------------------------------------
-- Contato do workspace do usuário, com o papel dele (erro se não for membro).
create or replace function public.audience_contact_for_write(p_contact_id uuid)
returns public.contacts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contact public.contacts%rowtype;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_contact from public.contacts c where c.id = p_contact_id for update;
  v_role := case when v_contact.id is null then null else public.publication_member_role(v_contact.organization_id) end;
  if v_role is null then
    raise exception 'contact_not_found' using errcode = 'P0001';
  end if;
  if v_role not in ('owner', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return v_contact;
end;
$$;

revoke all on function public.audience_contact_for_write(uuid) from public, anon, authenticated;

create or replace function public.audience_normalize_email(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(lower(btrim(coalesce(p_email, ''))), '');
$$;

create or replace function public.audience_check_identifiers(p_email text, p_phone text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_email is not null and (char_length(p_email) > 254 or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'invalid_email' using errcode = 'P0001';
  end if;
  if p_phone is not null and p_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'invalid_phone' using errcode = 'P0001';
  end if;
  if p_email is null and p_phone is null then
    raise exception 'contact_identifier_required' using errcode = 'P0001';
  end if;
end;
$$;

-- Data do fato: não no futuro (tolerância de 5 min) e até 5 anos para trás.
create or replace function public.audience_check_occurred_at(p_at timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v_at timestamptz := coalesce(p_at, now());
begin
  if v_at > now() + interval '5 minutes' or v_at < now() - interval '5 years' then
    raise exception 'invalid_occurred_at' using errcode = 'P0001';
  end if;
  return v_at;
end;
$$;

revoke all on function public.audience_normalize_email(text) from public, anon, authenticated;
revoke all on function public.audience_check_identifiers(text, text) from public, anon, authenticated;
revoke all on function public.audience_check_occurred_at(timestamptz) from public, anon, authenticated;

-- Inserção de um evento já autorizado (sem checagem de papel: só chamada por funções públicas).
create or replace function public.audience_insert_consent(
  p_contact public.contacts,
  p_action text,
  p_purpose text,
  p_channel text,
  p_evidence_type text,
  p_evidence_ref text,
  p_occurred_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref text := nullif(btrim(coalesce(p_evidence_ref, '')), '');
  v_at timestamptz := public.audience_check_occurred_at(p_occurred_at);
  v_id uuid;
begin
  if p_contact.anonymized_at is not null then
    raise exception 'contact_anonymized' using errcode = 'P0001';
  end if;
  if p_action is null or p_action not in ('opt_in', 'opt_out') then
    raise exception 'invalid_consent_action' using errcode = 'P0001';
  end if;
  if p_purpose is null or p_purpose not in ('marketing', 'newsletter', 'customer_service', 'order_fulfillment', 'research') then
    raise exception 'invalid_purpose' using errcode = 'P0001';
  end if;
  if p_channel is null or p_channel not in ('email', 'whatsapp', 'sms', 'phone', 'social_dm') then
    raise exception 'invalid_channel_consent' using errcode = 'P0001';
  end if;
  if p_evidence_type is null or p_evidence_type not in (
       'form_checkbox', 'double_opt_in', 'written', 'recorded_call', 'unsubscribe_link', 'titular_request', 'import') then
    raise exception 'invalid_evidence_type' using errcode = 'P0001';
  end if;
  if p_action = 'opt_in' and (v_ref is null or char_length(v_ref) < 3) then
    raise exception 'consent_evidence_required' using errcode = 'P0001';
  end if;
  if v_ref is not null and (char_length(v_ref) < 3 or char_length(v_ref) > 500) then
    raise exception 'consent_evidence_required' using errcode = 'P0001';
  end if;
  if p_action = 'opt_in' and p_evidence_type = 'unsubscribe_link' then
    raise exception 'invalid_evidence_type' using errcode = 'P0001';
  end if;

  insert into public.consent_events (organization_id, contact_id, action, purpose, channel, evidence_type, evidence_ref,
                                     occurred_at, recorded_by)
  values (p_contact.organization_id, p_contact.id, p_action, p_purpose, p_channel, p_evidence_type, v_ref, v_at, auth.uid())
  returning id into v_id;

  update public.contacts c set last_activity_at = greatest(c.last_activity_at, now()) where c.id = p_contact.id;
  return v_id;
end;
$$;

revoke all on function public.audience_insert_consent(public.contacts, text, text, text, text, text, timestamptz)
  from public, anon, authenticated;

-- Exclusão: revoga o que estiver ativo, remove os dados pessoais do contato, das evidências
-- e do texto dos pedidos. Notas de resolução ficam (devem ser escritas sem dado pessoal).
create or replace function public.audience_anonymize(p_contact_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.consent_events (organization_id, contact_id, action, purpose, channel, evidence_type, evidence_ref,
                                     occurred_at, recorded_by)
  select s.organization_id, s.contact_id, 'opt_out', s.purpose, s.channel, 'titular_request', null, now(), auth.uid()
  from public.contact_consent_state s
  where s.contact_id = p_contact_id and s.granted;
  update public.consent_events e set evidence_ref = null
  where e.contact_id = p_contact_id and e.evidence_ref is not null;
  update public.data_subject_requests r set details = null
  where r.contact_id = p_contact_id and r.details is not null;
  update public.contacts c
  set display_name = null, email = null, phone = null, source_detail = null,
      anonymized_at = now(), anonymized_by = auth.uid(), updated_at = now(), updated_by = auth.uid()
  where c.id = p_contact_id and c.anonymized_at is null;
end;
$$;

revoke all on function public.audience_anonymize(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Funções públicas (owner/admin escrevem; membros só leem)
-- ---------------------------------------------------------------------------
create or replace function public.create_contact(
  p_organization_id uuid,
  p_display_name text,
  p_email text,
  p_phone text,
  p_source text,
  p_source_detail text,
  p_purpose text,
  p_legal_basis text,
  p_consent_channel text default null,
  p_evidence_type text default null,
  p_evidence_ref text default null,
  p_consent_occurred_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_email text := public.audience_normalize_email(p_email);
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_name text := nullif(btrim(coalesce(p_display_name, '')), '');
  v_detail text := nullif(btrim(coalesce(p_source_detail, '')), '');
  v_contact public.contacts%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  v_role := public.publication_member_role(p_organization_id);
  if v_role is null then
    raise exception 'workspace_not_found' using errcode = 'P0001';
  end if;
  if v_role not in ('owner', 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform public.audience_check_identifiers(v_email, v_phone);
  if p_legal_basis = 'consent' and (p_consent_channel is null or p_evidence_type is null) then
    raise exception 'consent_evidence_required' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.contacts c where c.organization_id = p_organization_id
             and (c.email = v_email or c.phone = v_phone)) then
    raise exception 'contact_already_exists' using errcode = 'P0001';
  end if;

  insert into public.contacts (organization_id, display_name, email, phone, source, source_detail, purpose, legal_basis,
                               created_by, updated_by)
  values (p_organization_id, left(v_name, 120), v_email, v_phone, p_source, left(v_detail, 200), p_purpose, p_legal_basis,
          v_uid, v_uid)
  returning * into v_contact;

  if p_consent_channel is not null then
    perform public.audience_insert_consent(v_contact, 'opt_in', p_purpose, p_consent_channel, p_evidence_type,
                                           p_evidence_ref, p_consent_occurred_at);
  end if;
  return v_contact.id;
end;
$$;

-- Correção (art. 18, III). Não altera o histórico de consentimento.
create or replace function public.update_contact(
  p_contact_id uuid,
  p_display_name text,
  p_email text,
  p_phone text,
  p_purpose text,
  p_legal_basis text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contact public.contacts%rowtype := public.audience_contact_for_write(p_contact_id);
  v_email text := public.audience_normalize_email(p_email);
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_name text := nullif(btrim(coalesce(p_display_name, '')), '');
begin
  if v_contact.anonymized_at is not null then
    raise exception 'contact_anonymized' using errcode = 'P0001';
  end if;
  perform public.audience_check_identifiers(v_email, v_phone);
  if exists (select 1 from public.contacts c where c.organization_id = v_contact.organization_id and c.id <> v_contact.id
             and (c.email = v_email or c.phone = v_phone)) then
    raise exception 'contact_already_exists' using errcode = 'P0001';
  end if;
  update public.contacts c
  set display_name = left(v_name, 120), email = v_email, phone = v_phone,
      purpose = p_purpose, legal_basis = p_legal_basis,
      updated_at = now(), updated_by = auth.uid(), last_activity_at = now()
  where c.id = v_contact.id;
end;
$$;

create or replace function public.record_consent(
  p_contact_id uuid,
  p_action text,
  p_purpose text,
  p_channel text,
  p_evidence_type text,
  p_evidence_ref text default null,
  p_occurred_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contact public.contacts%rowtype := public.audience_contact_for_write(p_contact_id);
begin
  return public.audience_insert_consent(v_contact, p_action, p_purpose, p_channel, p_evidence_type, p_evidence_ref, p_occurred_at);
end;
$$;

-- Revogação total: opt_out em toda finalidade × canal com consentimento ativo.
create or replace function public.revoke_all_consents(p_contact_id uuid, p_evidence_type text, p_evidence_ref text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contact public.contacts%rowtype := public.audience_contact_for_write(p_contact_id);
  v_state record;
  v_count integer := 0;
begin
  for v_state in
    select s.purpose, s.channel from public.contact_consent_state s
    where s.contact_id = v_contact.id and s.granted
  loop
    perform public.audience_insert_consent(v_contact, 'opt_out', v_state.purpose, v_state.channel, p_evidence_type,
                                           p_evidence_ref, now());
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.register_data_subject_request(
  p_contact_id uuid,
  p_kind text,
  p_received_via text,
  p_details text default null,
  p_received_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contact public.contacts%rowtype := public.audience_contact_for_write(p_contact_id);
  v_at timestamptz := coalesce(p_received_at, now());
  v_details text := nullif(btrim(coalesce(p_details, '')), '');
  v_id uuid;
begin
  if v_contact.anonymized_at is not null then
    raise exception 'contact_anonymized' using errcode = 'P0001';
  end if;
  if p_kind is null or p_kind not in ('access', 'correction', 'deletion') then
    raise exception 'invalid_request_kind' using errcode = 'P0001';
  end if;
  if p_received_via is null or p_received_via not in ('email', 'form', 'phone', 'in_person', 'internal') then
    raise exception 'invalid_request_channel' using errcode = 'P0001';
  end if;
  if v_at > now() + interval '5 minutes' or v_at < now() - interval '1 year' then
    raise exception 'invalid_received_at' using errcode = 'P0001';
  end if;
  if v_details is not null and char_length(v_details) > 1000 then
    raise exception 'request_details_too_long' using errcode = 'P0001';
  end if;
  insert into public.data_subject_requests (organization_id, contact_id, kind, received_via, details, received_at, due_at, created_by)
  values (v_contact.organization_id, v_contact.id, p_kind, p_received_via, v_details, v_at, v_at + interval '15 days', auth.uid())
  returning id into v_id;
  update public.contacts c set last_activity_at = now() where c.id = v_contact.id;
  return v_id;
end;
$$;

-- Conclui ou recusa um pedido. Concluir uma exclusão anonimiza o contato na mesma transação.
create or replace function public.resolve_data_subject_request(p_request_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.data_subject_requests%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_request from public.data_subject_requests r where r.id = p_request_id for update;
  if v_request.id is null or public.publication_member_role(v_request.organization_id) is null then
    raise exception 'request_not_found' using errcode = 'P0001';
  end if;
  perform public.audience_contact_for_write(v_request.contact_id);
  if v_request.status <> 'open' then
    raise exception 'request_already_resolved' using errcode = 'P0001';
  end if;
  if p_status is null or p_status not in ('completed', 'rejected') then
    raise exception 'invalid_request_status' using errcode = 'P0001';
  end if;
  if p_status = 'rejected' and (v_note is null or char_length(v_note) < 3) then
    raise exception 'resolution_note_required' using errcode = 'P0001';
  end if;
  if v_note is not null and (char_length(v_note) < 3 or char_length(v_note) > 1000) then
    raise exception 'resolution_note_required' using errcode = 'P0001';
  end if;

  update public.data_subject_requests r
  set status = p_status, resolution_note = v_note, resolved_by = auth.uid(), resolved_at = now()
  where r.id = v_request.id;

  if p_status = 'completed' and v_request.kind = 'deletion' then
    perform public.audience_anonymize(v_request.contact_id);
  end if;
end;
$$;

-- Exclusão direta (com confirmação na UI): registra um pedido interno de exclusão e o conclui.
create or replace function public.anonymize_contact(p_contact_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contact public.contacts%rowtype := public.audience_contact_for_write(p_contact_id);
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_request uuid;
begin
  if v_contact.anonymized_at is not null then
    raise exception 'contact_anonymized' using errcode = 'P0001';
  end if;
  if v_reason is null or char_length(v_reason) < 3 or char_length(v_reason) > 1000 then
    raise exception 'resolution_note_required' using errcode = 'P0001';
  end if;
  v_request := public.register_data_subject_request(v_contact.id, 'deletion', 'internal', null, now());
  perform public.resolve_data_subject_request(v_request, 'completed', v_reason);
  return v_request;
end;
$$;

-- Exportação de tudo o que o workspace guarda sobre um titular (art. 18, II e V). Fica no audit_log.
create or replace function public.export_contact_data(p_contact_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contact public.contacts%rowtype := public.audience_contact_for_write(p_contact_id);
  v_result jsonb;
begin
  v_result := jsonb_build_object(
    'format', 'smkon.contact_export.v1',
    'exported_at', now(),
    'workspace_id', v_contact.organization_id,
    'contact', jsonb_build_object(
      'id', v_contact.id, 'display_name', v_contact.display_name, 'email', v_contact.email, 'phone', v_contact.phone,
      'source', v_contact.source, 'source_detail', v_contact.source_detail, 'purpose', v_contact.purpose,
      'legal_basis', v_contact.legal_basis, 'created_at', v_contact.created_at, 'updated_at', v_contact.updated_at,
      'anonymized_at', v_contact.anonymized_at
    ),
    'consent_state', coalesce((
      select jsonb_agg(jsonb_build_object('purpose', s.purpose, 'channel', s.channel, 'granted', s.granted,
                                          'since', s.occurred_at) order by s.purpose, s.channel)
      from public.contact_consent_state s where s.contact_id = v_contact.id), '[]'::jsonb),
    'consent_events', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'action', e.action, 'purpose', e.purpose, 'channel', e.channel,
                                          'evidence_type', e.evidence_type, 'evidence_ref', e.evidence_ref,
                                          'occurred_at', e.occurred_at, 'recorded_at', e.created_at)
                       order by e.occurred_at, e.created_at)
      from public.consent_events e where e.contact_id = v_contact.id), '[]'::jsonb),
    'data_subject_requests', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'received_via', r.received_via, 'details', r.details,
                                          'received_at', r.received_at, 'due_at', r.due_at, 'status', r.status,
                                          'resolution_note', r.resolution_note, 'resolved_at', r.resolved_at)
                       order by r.received_at)
      from public.data_subject_requests r where r.contact_id = v_contact.id), '[]'::jsonb)
  );

  insert into public.audit_log (organization_id, actor_id, action, table_name, record_id, old_data, new_data)
  values (v_contact.organization_id, auth.uid(), 'INSERT', 'contact_exports', v_contact.id::text, null,
          jsonb_build_object('contact_id', v_contact.id, 'format', 'smkon.contact_export.v1'));
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Permissões das funções
-- ---------------------------------------------------------------------------
revoke all on function public.create_contact(uuid, text, text, text, text, text, text, text, text, text, text, timestamptz) from public, anon;
revoke all on function public.update_contact(uuid, text, text, text, text, text) from public, anon;
revoke all on function public.record_consent(uuid, text, text, text, text, text, timestamptz) from public, anon;
revoke all on function public.revoke_all_consents(uuid, text, text) from public, anon;
revoke all on function public.register_data_subject_request(uuid, text, text, text, timestamptz) from public, anon;
revoke all on function public.resolve_data_subject_request(uuid, text, text) from public, anon;
revoke all on function public.anonymize_contact(uuid, text) from public, anon;
revoke all on function public.export_contact_data(uuid) from public, anon;

grant execute on function public.create_contact(uuid, text, text, text, text, text, text, text, text, text, text, timestamptz) to authenticated;
grant execute on function public.update_contact(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.record_consent(uuid, text, text, text, text, text, timestamptz) to authenticated;
grant execute on function public.revoke_all_consents(uuid, text, text) to authenticated;
grant execute on function public.register_data_subject_request(uuid, text, text, text, timestamptz) to authenticated;
grant execute on function public.resolve_data_subject_request(uuid, text, text) to authenticated;
grant execute on function public.anonymize_contact(uuid, text) to authenticated;
grant execute on function public.export_contact_data(uuid) to authenticated;
