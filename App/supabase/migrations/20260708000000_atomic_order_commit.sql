begin;

create or replace function public.issue_order_quote(
  p_cafe_id uuid,
  p_table_number text,
  p_items jsonb,
  p_notes text,
  p_channel text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote jsonb;
  v_quote_id uuid := gen_random_uuid();
  v_hash text;
  v_expires timestamptz := now() + interval '5 minutes';
begin
  if nullif(trim(p_table_number), '') is null or p_channel not in ('online', 'cashier') then
    raise exception 'invalid_order_commit' using errcode = '22023';
  end if;

  v_quote := public.quote_order(p_cafe_id, p_items);
  v_hash := encode(digest(convert_to(jsonb_build_object(
    'cafe_id', p_cafe_id,
    'table_number', left(trim(p_table_number), 30),
    'items', p_items,
    'notes', nullif(left(coalesce(trim(p_notes), ''), 500), ''),
    'channel', p_channel,
    'quote_id', p_quote_id
  )::text, 'utf8'), 'sha256'), 'hex');

  insert into public."Order_Quotes" (
    quote_id, cafe_id, request_hash, canonical_payload, pricing_snapshot, expires_at
  ) values (
    v_quote_id, p_cafe_id, v_hash, p_items, v_quote, v_expires
  );

  return jsonb_build_object(
    'quote_id', v_quote_id,
    'request_hash', v_hash,
    'expires_at', v_expires,
    'quote', v_quote
  );
end;
$$;

create or replace function public.commit_order_atomic(
  p_cafe_id uuid,
  p_table_number text,
  p_items jsonb,
  p_notes text,
  p_channel text,
  p_quote_id uuid,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_now timestamptz := now();
  v_quote public."Order_Quotes"%rowtype;
  v_idempotency public."Order_Idempotency_Keys"%rowtype;
  v_result jsonb;
  v_order jsonb;
  v_order_id text;
  v_required record;
  v_available numeric;
  v_reserved numeric;
  v_quote_total integer;
  v_expiry timestamptz := v_now + interval '15 minutes';
begin
  if p_cafe_id is null or p_quote_id is null or p_idempotency_key is null
     or length(trim(p_idempotency_key)) < 16 then
    raise exception 'invalid_order_commit' using errcode = '22023';
  end if;

  v_hash := encode(digest(convert_to(p_items::text, 'utf8'), 'sha256'), 'hex');

  insert into public."Order_Idempotency_Keys" (
    cafe_id, idempotency_key, request_hash, quote_id, expires_at
  ) values (
    p_cafe_id, p_idempotency_key, v_hash, p_quote_id, v_now + interval '72 hours'
  ) on conflict (cafe_id, idempotency_key) do nothing;

  select * into v_idempotency
  from public."Order_Idempotency_Keys"
  where cafe_id = p_cafe_id and idempotency_key = p_idempotency_key
  for update;

  if v_idempotency.request_hash <> v_hash then
    raise exception 'idempotency_key_reused' using errcode = 'P0001';
  end if;
  if v_idempotency.order_id is not null then
    return coalesce(v_idempotency.response_payload, jsonb_build_object('error', 'order_not_recoverable'));
  end if;

  select * into v_quote
  from public."Order_Quotes"
  where quote_id = p_quote_id and cafe_id = p_cafe_id
  for update;

  if not found or v_quote.request_hash <> v_hash then
    raise exception 'quote_mismatch' using errcode = 'P0001';
  end if;
  if v_quote.status <> 'issued' or v_quote.expires_at <= v_now then
    raise exception 'quote_already_consumed' using errcode = 'P0001';
  end if;

  v_result := public.create_order(p_cafe_id, p_table_number, p_items, p_notes, p_channel);
  if v_result ? 'error' then
    raise exception '%', v_result->>'error' using errcode = 'P0001';
  end if;
  v_order := v_result->'order';
  v_order_id := v_order->>'id_order';
  v_quote_total := (v_quote.pricing_snapshot->>'total')::integer;
  if (v_order->>'total')::integer is distinct from v_quote_total then
    raise exception 'quote_changed' using errcode = 'P0001';
  end if;

  create temporary table tmp_atomic_required_inventory (
    inventory_item_id uuid primary key,
    required_qty numeric(12,3) not null
  ) on commit drop;

  insert into tmp_atomic_required_inventory (inventory_item_id, required_qty)
  select source.inventory_item_id, sum(source.required_qty)::numeric(12,3)
  from (
    select mr.inventory_item_id, mr.qty_per_menu * (line->>'qty')::numeric as required_qty
    from jsonb_array_elements(v_order->'items') line
    join public."Menu_Recipes" mr
      on mr.menu_id = (line->>'id_menu')::uuid and mr.cafe_id = p_cafe_id
    union all
    select mor.inventory_item_id, mor.qty_per_menu * (line->>'qty')::numeric as required_qty
    from jsonb_array_elements(v_order->'items') line
    cross join lateral jsonb_array_elements(coalesce(line->'options', '[]'::jsonb)) option_row
    join public."Menu_Option_Recipes" mor
      on mor.option_value_id = (option_row->>'id_option_value')::uuid
     and mor.cafe_id = p_cafe_id
  ) source
  group by source.inventory_item_id;

  perform 1
  from public."Inventory_Items" ii
  join tmp_atomic_required_inventory required
    on required.inventory_item_id = ii.id_inventory_item
  where ii.cafe_id = p_cafe_id
  order by ii.id_inventory_item
  for update of ii;

  for v_required in
    select required.inventory_item_id, required.required_qty, ii.current_qty
    from tmp_atomic_required_inventory required
    join public."Inventory_Items" ii
      on ii.id_inventory_item = required.inventory_item_id
     and ii.cafe_id = p_cafe_id
    order by required.inventory_item_id
  loop
    select coalesce(sum(reserved_qty), 0)
      into v_reserved
    from public."Order_Reservations"
    where inventory_item_id = v_required.inventory_item_id
      and cafe_id = p_cafe_id
      and status = 'reserved'
      and expires_at > v_now;

    v_available := v_required.current_qty - v_reserved;
    if v_available < v_required.required_qty then
      raise exception 'insufficient_inventory' using errcode = 'P0001';
    end if;

    insert into public."Order_Reservations" (
      order_id, cafe_id, inventory_item_id, requested_qty, reserved_qty, expires_at
    ) values (
      v_order_id, p_cafe_id, v_required.inventory_item_id,
      v_required.required_qty, v_required.required_qty, v_expiry
    );
  end loop;

  update public."Order_Quotes"
  set status = 'consumed', consumed_at = v_now
  where quote_id = p_quote_id and status = 'issued';

  v_result := v_result || jsonb_build_object(
    'quote_id', p_quote_id,
    'idempotency_key', p_idempotency_key,
    'reservation_expires_at', v_expiry
  );

  update public."Order_Idempotency_Keys"
  set order_id = v_order_id, response_payload = v_result
  where cafe_id = p_cafe_id and idempotency_key = p_idempotency_key;

  return v_result;
end;
$$;

create or replace function public.consume_order_reservations(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public."Order_Reservations"
  set status = 'consumed', consumed_at = now()
  where order_id = p_order_id and status = 'reserved';
  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'changed', v_count);
end;
$$;

create or replace function public.release_order_reservations(p_order_id text, p_status text default 'released')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_status not in ('released', 'expired') then
    raise exception 'invalid_reservation_status' using errcode = '22023';
  end if;
  update public."Order_Reservations"
  set status = p_status, released_at = now()
  where order_id = p_order_id and status = 'reserved';
  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'changed', v_count);
end;
$$;

revoke all on function public.issue_order_quote(uuid, text, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.commit_order_atomic(uuid, text, jsonb, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.consume_order_reservations(text) from public, anon, authenticated;
revoke all on function public.release_order_reservations(text, text) from public, anon, authenticated;
grant execute on function public.issue_order_quote(uuid, text, jsonb, text, text) to service_role;
grant execute on function public.commit_order_atomic(uuid, text, jsonb, text, text, uuid, text) to service_role;
grant execute on function public.consume_order_reservations(text) to service_role;
grant execute on function public.release_order_reservations(text, text) to service_role;

commit;
