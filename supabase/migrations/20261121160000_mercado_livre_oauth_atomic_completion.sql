-- Complete OAuth credential persistence and connection activation in one transaction.
-- This avoids leaving encrypted credentials behind when source_connections metadata fails.
create or replace function public.mercado_livre_complete_oauth_connection(
  p_connection_id uuid,
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_external_account_id text,
  p_display_name text,
  p_granted_scopes text[],
  p_encrypted_tokens jsonb,
  p_token_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection_id uuid;
  v_existing_external_account_id text;
  v_key_count integer;
  v_saved_connection_id uuid;
begin
  if p_connection_id is null or p_organization_id is null or p_actor_user_id is null then
    raise exception 'invalid_oauth_connection_context' using errcode = '22023';
  end if;
  if p_external_account_id is null or p_external_account_id !~ '^[0-9]{1,40}$' then
    raise exception 'invalid_external_account_id' using errcode = '22023';
  end if;
  if p_display_name is null or length(btrim(p_display_name)) = 0 or length(p_display_name) > 160 then
    raise exception 'invalid_connection_display_name' using errcode = '22023';
  end if;
  if p_token_expires_at is null or p_token_expires_at <= now() then
    raise exception 'invalid_token_expiry' using errcode = '22023';
  end if;
  if p_granted_scopes is null or cardinality(p_granted_scopes) > 50
     or exists (select 1 from unnest(p_granted_scopes) as scope where length(scope) > 120) then
    raise exception 'invalid_granted_scopes' using errcode = '22023';
  end if;

  if p_encrypted_tokens is null or jsonb_typeof(p_encrypted_tokens) <> 'object' then
    raise exception 'invalid_token_envelope' using errcode = '22023';
  end if;
  select count(*) into v_key_count from jsonb_object_keys(p_encrypted_tokens);
  if v_key_count <> 6
     or exists (
       select 1 from jsonb_object_keys(p_encrypted_tokens) as item_key(key)
       where item_key.key not in ('v','alg','kid','iv','tag','ciphertext')
     )
     or not (p_encrypted_tokens ?& array['v','alg','kid','iv','tag','ciphertext']) then
    raise exception 'invalid_token_envelope' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = p_actor_user_id
      and om.role in ('owner','admin')
  ) then
    raise exception 'workspace_admin_required' using errcode = '42501';
  end if;

  select sc.id, sc.external_account_id
    into v_connection_id, v_existing_external_account_id
  from public.source_connections sc
  where sc.id = p_connection_id
    and sc.organization_id = p_organization_id
    and sc.provider = 'mercado_livre'
    and sc.domain = 'owned_sales'
    and sc.status in ('pending','error','connected')
  for update;

  if v_connection_id is null then
    raise exception 'marketplace_connection_not_found' using errcode = '42501';
  end if;
  if v_existing_external_account_id is not null
     and v_existing_external_account_id <> p_external_account_id then
    raise exception 'external_account_mismatch' using errcode = '23505';
  end if;

  update public.source_connections
  set external_account_id = p_external_account_id,
      display_name = p_display_name,
      status = 'connected',
      granted_scopes = p_granted_scopes,
      last_error_code = null,
      updated_at = now()
  where id = p_connection_id
    and organization_id = p_organization_id
    and provider = 'mercado_livre'
    and domain = 'owned_sales';

  insert into public.mercado_livre_credentials (
    connection_id, organization_id, domain, encrypted_tokens, token_expires_at,
    token_version, refresh_lease_until, refresh_lease_id, updated_at
  ) values (
    p_connection_id, p_organization_id, 'owned_sales', p_encrypted_tokens,
    p_token_expires_at, 1, null, null, now()
  )
  on conflict (connection_id)
  do update set
    encrypted_tokens = excluded.encrypted_tokens,
    token_expires_at = excluded.token_expires_at,
    token_version = public.mercado_livre_credentials.token_version + 1,
    refresh_lease_until = null,
    refresh_lease_id = null,
    updated_at = now()
  where public.mercado_livre_credentials.organization_id = excluded.organization_id
    and public.mercado_livre_credentials.domain = excluded.domain
    and (
      public.mercado_livre_credentials.refresh_lease_until is null
      or public.mercado_livre_credentials.refresh_lease_until < now()
    )
  returning connection_id into v_saved_connection_id;

  if v_saved_connection_id is null then
    raise exception 'credential_refresh_lease_active_or_tenant_mismatch' using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.mercado_livre_complete_oauth_connection(uuid, uuid, uuid, text, text, text[], jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.mercado_livre_complete_oauth_connection(uuid, uuid, uuid, text, text, text[], jsonb, timestamptz)
  to service_role;
