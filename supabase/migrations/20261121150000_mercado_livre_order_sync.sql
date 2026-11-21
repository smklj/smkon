-- S11: persist bounded, normalized Mercado Livre order snapshots atomically.
-- Raw provider payloads and buyer/seller PII are intentionally not accepted or stored.
create or replace function public.mercado_livre_persist_order_snapshots(
  p_connection_id uuid,
  p_organization_id uuid,
  p_orders jsonb,
  p_synced_at timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection_id uuid;
  v_item jsonb;
  v_key_count integer;
  v_external_id text;
  v_status text;
  v_currency text;
  v_gross numeric(18,4);
  v_discount numeric(18,4);
  v_fee numeric(18,4);
  v_shipping numeric(18,4);
  v_refund numeric(18,4);
  v_occurred_at timestamptz;
  v_payload_hash text;
  v_normalization_version integer;
  v_event_id uuid;
  v_order_id uuid;
  v_processed integer := 0;
begin
  if p_connection_id is null or p_organization_id is null then
    raise exception 'invalid_connection_context' using errcode = '22023';
  end if;

  if p_orders is null or jsonb_typeof(p_orders) <> 'array' then
    raise exception 'invalid_order_batch' using errcode = '22023';
  end if;
  if jsonb_array_length(p_orders) > 50 then
    raise exception 'order_batch_limit_exceeded' using errcode = '22023';
  end if;

  if p_synced_at is null or p_synced_at > now() + interval '5 minutes' then
    raise exception 'invalid_sync_timestamp' using errcode = '22023';
  end if;

  select sc.id into v_connection_id
  from public.source_connections sc
  where sc.id = p_connection_id
    and sc.organization_id = p_organization_id
    and sc.provider = 'mercado_livre'
    and sc.domain = 'owned_sales'
    and sc.status = 'connected'
    and sc.external_account_id is not null
  for share;

  if v_connection_id is null then
    raise exception 'connected_marketplace_account_not_found' using errcode = '42501';
  end if;

  for v_item in
    select value from jsonb_array_elements(p_orders)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'invalid_order_snapshot_shape' using errcode = '22023';
    end if;

    -- Strict allowlist: the RPC rejects raw provider payloads and any PII fields.
    select count(*) into v_key_count from jsonb_object_keys(v_item);
    if v_key_count <> 11
       or exists (
         select 1
         from jsonb_object_keys(v_item) as item_key(key)
         where item_key.key not in (
           'external_order_id', 'order_status', 'currency', 'gross_amount',
           'discount_amount', 'fee_amount', 'shipping_amount', 'refund_amount',
           'occurred_at', 'payload_hash', 'normalization_version'
         )
       )
       or not (v_item ?& array[
         'external_order_id', 'order_status', 'currency', 'gross_amount',
         'discount_amount', 'fee_amount', 'shipping_amount', 'refund_amount',
         'occurred_at', 'payload_hash', 'normalization_version'
       ]) then
      raise exception 'invalid_order_snapshot_shape' using errcode = '22023';
    end if;

    v_external_id := v_item->>'external_order_id';
    v_status := v_item->>'order_status';
    v_currency := v_item->>'currency';
    v_gross := (v_item->>'gross_amount')::numeric(18,4);
    v_discount := (v_item->>'discount_amount')::numeric(18,4);
    v_fee := (v_item->>'fee_amount')::numeric(18,4);
    v_shipping := (v_item->>'shipping_amount')::numeric(18,4);
    v_refund := (v_item->>'refund_amount')::numeric(18,4);
    v_occurred_at := (v_item->>'occurred_at')::timestamptz;
    v_payload_hash := v_item->>'payload_hash';
    v_normalization_version := (v_item->>'normalization_version')::integer;

    if v_external_id is null or v_external_id !~ '^[0-9]{1,40}$' then
      raise exception 'invalid_external_order_id' using errcode = '22023';
    end if;
    if v_status is null or v_status not in ('pending', 'paid', 'fulfilled', 'cancelled', 'refunded', 'partially_refunded') then
      raise exception 'invalid_order_status' using errcode = '22023';
    end if;
    if v_currency is null or v_currency !~ '^[A-Z]{3}$' then
      raise exception 'invalid_currency' using errcode = '22023';
    end if;
    if v_gross is null or v_discount is null or v_fee is null or v_shipping is null or v_refund is null
       or v_gross not between 0 and 99999999999999.9999
       or v_discount not between 0 and 99999999999999.9999
       or v_fee not between 0 and 99999999999999.9999
       or v_shipping not between 0 and 99999999999999.9999
       or v_refund not between 0 and 99999999999999.9999 then
      raise exception 'invalid_order_amount' using errcode = '22023';
    end if;
    if v_occurred_at is null then
      raise exception 'invalid_order_occurred_at' using errcode = '22023';
    end if;
    if v_payload_hash is null or v_payload_hash !~ '^[a-f0-9]{64}$' then
      raise exception 'invalid_order_payload_hash' using errcode = '22023';
    end if;
    if v_normalization_version is null or v_normalization_version < 1 then
      raise exception 'invalid_normalization_version' using errcode = '22023';
    end if;

    insert into public.external_events (
      organization_id, connection_id, domain, provider, external_id,
      event_type, occurred_at, payload_hash, normalization_version
    ) values (
      p_organization_id, p_connection_id, 'owned_sales', 'mercado_livre',
      v_external_id, 'order_snapshot', v_occurred_at, v_payload_hash,
      v_normalization_version
    )
    on conflict (organization_id, provider, external_id, event_type)
    do update set
      occurred_at = excluded.occurred_at,
      payload_hash = excluded.payload_hash,
      normalization_version = excluded.normalization_version,
      received_at = now()
    where public.external_events.connection_id = excluded.connection_id
    returning id into v_event_id;

    if v_event_id is null then
      raise exception 'order_event_connection_conflict' using errcode = '23505';
    end if;

    insert into public.sales_orders (
      organization_id, connection_id, domain, external_event_id, provider,
      external_order_id, order_status, currency, gross_amount, discount_amount,
      fee_amount, shipping_amount, refund_amount, occurred_at, settled_at
    ) values (
      p_organization_id, p_connection_id, 'owned_sales', v_event_id, 'mercado_livre',
      v_external_id, v_status, v_currency, v_gross, v_discount,
      v_fee, v_shipping, v_refund, v_occurred_at, null
    )
    on conflict (organization_id, provider, external_order_id)
    do update set
      external_event_id = excluded.external_event_id,
      order_status = excluded.order_status,
      currency = excluded.currency,
      gross_amount = excluded.gross_amount,
      discount_amount = excluded.discount_amount,
      fee_amount = excluded.fee_amount,
      shipping_amount = excluded.shipping_amount,
      refund_amount = excluded.refund_amount,
      occurred_at = excluded.occurred_at
    where public.sales_orders.connection_id = excluded.connection_id
    returning id into v_order_id;

    if v_order_id is null then
      raise exception 'order_connection_conflict' using errcode = '23505';
    end if;

    v_processed := v_processed + 1;
  end loop;

  update public.source_connections
  set last_synced_at = greatest(coalesce(last_synced_at, '-infinity'::timestamptz), p_synced_at),
      updated_at = now()
  where id = p_connection_id
    and organization_id = p_organization_id
    and provider = 'mercado_livre'
    and domain = 'owned_sales';

  return v_processed;
end;
$$;

revoke all on function public.mercado_livre_persist_order_snapshots(uuid, uuid, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.mercado_livre_persist_order_snapshots(uuid, uuid, jsonb, timestamptz)
  to service_role;
