begin;

-- Keep the read-only quote contract aligned with the active create_order
-- function. In particular, create_order requires the configured min_select
-- without clamping it and does not evaluate menu scheduling predicates.
create or replace function public.quote_order(
  p_cafe_id uuid,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requested jsonb;
  v_order_items jsonb;
  v_subtotal integer := 0;
  v_tax_amount integer := 0;
  v_service_amount integer := 0;
  v_total integer := 0;
  v_bad_group text;
  v_option_count integer := 0;
  v_canonical_count integer := 0;
  v_has_negative_price boolean := false;
  v_tax jsonb;
  v_tax_pct numeric(5,2);
  v_service_pct numeric(5,2);
  v_include boolean;
begin
  if p_cafe_id is null then
    raise exception 'invalid_order_request' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as raw(item)
    where jsonb_typeof(item) <> 'object'
      or not (item ? 'id_menu') or not (item ? 'qty')
      or jsonb_typeof(item->'id_menu') <> 'string'
      or jsonb_typeof(item->'qty') <> 'number'
      or (item->>'id_menu') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or (item->>'qty') !~ '^[0-9]+$' or length(item->>'qty') > 2
      or (item ? 'options' and jsonb_typeof(item->'options') <> 'array')
      or (item ? 'options' and jsonb_array_length(item->'options') > 20)
  ) then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as raw(item)
    cross join lateral jsonb_array_elements(coalesce(item->'options', '[]'::jsonb)) as opt(value)
    where jsonb_typeof(value) <> 'string'
      or (value #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('id_menu', id_menu, 'qty', qty, 'options', to_jsonb(option_ids))
      order by line_key
    ),
    '[]'::jsonb
  ) into v_requested
  from (
    select normalized.id_menu::text || ':' || array_to_string(normalized.option_ids, ',') as line_key,
           normalized.id_menu,
           normalized.option_ids,
           sum(normalized.qty)::integer as qty
    from (
      select (raw.item->>'id_menu')::uuid as id_menu,
             coalesce((
               select array_agg(distinct option_id.value::uuid order by option_id.value::uuid)
               from jsonb_array_elements_text(coalesce(raw.item->'options', '[]'::jsonb)) as option_id(value)
             ), array[]::uuid[]) as option_ids,
             (raw.item->>'qty')::integer as qty
      from jsonb_array_elements(p_items) as raw(item)
    ) normalized
    group by normalized.id_menu, normalized.option_ids
  ) requested;

  if exists (
    select 1
    from jsonb_array_elements(v_requested) as line(item)
    where (item->>'qty')::integer < 1 or (item->>'qty')::integer > 50
  ) then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  with requested as (
    select item->>'id_menu' as id_menu_text,
           (item->>'id_menu')::uuid as id_menu,
           item->'options' as options
    from jsonb_array_elements(v_requested) as line(item)
  )
  select count(*)::integer into v_option_count
  from requested line
  cross join lateral jsonb_array_elements_text(line.options) as option_id(value)
  join public."Menu_Option_Values" ov
    on ov.id_option_value = option_id.value::uuid
   and ov.cafe_id = p_cafe_id
   and ov.is_active = true
  join public."Menu_Option_Groups" og
    on og.id_option_group = ov.option_group_id
   and og.menu_id = line.id_menu
   and og.cafe_id = p_cafe_id;

  if v_option_count <> (
    select coalesce(sum(jsonb_array_length(item->'options')), 0)::integer
    from jsonb_array_elements(v_requested) as line(item)
  ) then
    raise exception 'menu_unavailable' using errcode = 'P0001';
  end if;

  with requested as (
    select (item->>'id_menu')::uuid as id_menu,
           (item->>'id_menu') || ':' || array_to_string(
             array(select option_id.value from jsonb_array_elements_text(item->'options') as option_id(value)), ','
           ) as line_key,
           item->'options' as options
    from jsonb_array_elements(v_requested) as line(item)
  ), line_options as (
    select line.line_key, ov.id_option_value, og.id_option_group
    from requested line
    cross join lateral jsonb_array_elements_text(line.options) as option_id(value)
    join public."Menu_Option_Values" ov
      on ov.id_option_value = option_id.value::uuid and ov.cafe_id = p_cafe_id and ov.is_active = true
    join public."Menu_Option_Groups" og
      on og.id_option_group = ov.option_group_id and og.menu_id = line.id_menu and og.cafe_id = p_cafe_id
  )
  select og.name into v_bad_group
  from requested line
  join public."Menu_Option_Groups" og
    on og.menu_id = line.id_menu and og.cafe_id = p_cafe_id
  left join line_options selected
    on selected.line_key = line.line_key and selected.id_option_group = og.id_option_group
  group by line.line_key, og.id_option_group, og.name, og.min_select, og.max_select
  having count(selected.id_option_value) < og.min_select
      or count(selected.id_option_value) > og.max_select
  limit 1;
  if v_bad_group is not null then
    raise exception 'menu_unavailable' using errcode = 'P0001';
  end if;

  with requested as (
    select (item->>'id_menu')::uuid as id_menu,
           (item->>'id_menu') || ':' || array_to_string(
             array(select option_id.value from jsonb_array_elements_text(item->'options') as option_id(value)), ','
           ) as line_key,
           (item->>'qty')::integer as qty,
           item->'options' as options
    from jsonb_array_elements(v_requested) as line(item)
  ), line_options as (
    select line.line_key, ov.id_option_value, ov.name as option_name, ov.price_delta,
           og.id_option_group, og.name as group_name
    from requested line
    cross join lateral jsonb_array_elements_text(line.options) as option_id(value)
    join public."Menu_Option_Values" ov
      on ov.id_option_value = option_id.value::uuid and ov.cafe_id = p_cafe_id and ov.is_active = true
    join public."Menu_Option_Groups" og
      on og.id_option_group = ov.option_group_id and og.menu_id = line.id_menu and og.cafe_id = p_cafe_id
  ), canonical as (
    select line.line_key, m.id_menu, m.nama_menu,
      round(m.harga_menu * (1 - least(greatest(coalesce(m.discount_pct, 0), 0), 100) / 100.0))::integer
        + coalesce((select sum(selected.price_delta)::integer from line_options selected where selected.line_key = line.line_key), 0) as harga_menu,
      line.qty,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id_option_value', selected.id_option_value,
          'group_name', selected.group_name,
          'name', selected.option_name,
          'price_delta', selected.price_delta
        ) order by selected.group_name, selected.option_name)
        from line_options selected where selected.line_key = line.line_key
      ), '[]'::jsonb) as options
    from requested line
    join public."Menus" m
      on m.id_menu = line.id_menu
     and m.cafe_id = p_cafe_id
     and coalesce(m.is_active, true) = true
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id_menu', id_menu, 'nama_menu', nama_menu, 'harga_menu', harga_menu,
           'qty', qty, 'options', options
         ) order by nama_menu, line_key), '[]'::jsonb),
         coalesce(sum(harga_menu * qty), 0)::integer,
         count(*)::integer,
         coalesce(bool_or(harga_menu < 0), false)
    into v_order_items, v_subtotal, v_canonical_count, v_has_negative_price
  from canonical;

  if v_canonical_count <> jsonb_array_length(v_requested) then
    raise exception 'menu_unavailable' using errcode = 'P0001';
  end if;
  if v_has_negative_price then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  v_tax := public.effective_tax_settings(p_cafe_id);
  v_tax_pct := coalesce((v_tax->>'tax_pct')::numeric, 0);
  v_service_pct := coalesce((v_tax->>'service_pct')::numeric, 0);
  v_include := coalesce((v_tax->>'include')::boolean, false);
  v_service_amount := round(v_subtotal * v_service_pct / 100.0)::integer;
  if v_include then
    v_tax_amount := round(
      (v_subtotal + v_service_amount)
      - (v_subtotal + v_service_amount) / (1 + v_tax_pct / 100.0)
    )::integer;
    v_total := v_subtotal + v_service_amount;
  else
    v_tax_amount := round((v_subtotal + v_service_amount) * v_tax_pct / 100.0)::integer;
    v_total := v_subtotal + v_service_amount + v_tax_amount;
  end if;

  return jsonb_build_object(
    'items', v_order_items,
    'subtotal', v_subtotal,
    'tax_pct', v_tax_pct,
    'tax_amount', v_tax_amount,
    'service_pct', v_service_pct,
    'service_amount', v_service_amount,
    'prices_include_tax', v_include,
    'total', v_total
  );
end;
$$;

-- Preserve the existing inventory-confirmation implementation behind a new
-- private name, then place the terminal-state check under the public lock.
alter function public.confirm_order(text)
  rename to confirm_order_checkout_final_review_v1;

create function public.confirm_order(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status
  from public."Orders"
  where id_order = p_order_id
  for update;

  if not found then
    return jsonb_build_object('error', 'order_not_found');
  end if;
  if v_status = 'cancelled' then
    return jsonb_build_object('error', 'order_not_active');
  end if;

  return public.confirm_order_checkout_final_review_v1(p_order_id);
end;
$$;

-- A pending or paid payment has an external money movement. Until a refund
-- path exists, staff must not cancel it and turn a settlement callback into an
-- inventory-restoring race. This repeats the established restoration logic so
-- clean replay does not depend on an out-of-band predecessor function.
create or replace function public.cancel_order(
  p_cafe_id uuid,
  p_order_id text,
  p_reason text,
  p_actor uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_payment_status text;
  v_now timestamptz := now();
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 300), '');
  v_restored integer := 0;
begin
  if v_reason is null then
    raise exception 'cancel_reason_required' using errcode = '22023';
  end if;

  select status, payment_status into v_status, v_payment_status
  from public."Orders"
  where id_order = p_order_id and cafe_id = p_cafe_id
  for update;

  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if v_payment_status in ('pending', 'paid') then
    raise exception 'payment_refund_required' using errcode = 'P0001';
  end if;

  if v_status = 'cancelled' then
    return jsonb_build_object('status', 'cancelled', 'already', true);
  end if;
  if v_status = 'completed' then
    raise exception 'order_already_completed' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public."Inventory_Movements"
    where reference_type = 'order'
      and reference_id = p_order_id
      and movement_type = 'order_cancellation'
  ) then
    with deducted as (
      select im.inventory_item_id, sum(-im.delta_qty)::numeric(12,3) as qty
      from public."Inventory_Movements" im
      where im.reference_type = 'order'
        and im.reference_id = p_order_id
        and im.movement_type = 'order_deduction'
        and im.cafe_id = p_cafe_id
      group by im.inventory_item_id
      having sum(-im.delta_qty) > 0
    ), logged as (
      insert into public."Inventory_Movements" (
        cafe_id, inventory_item_id, movement_type, delta_qty,
        qty_before, qty_after, unit, unit_cost,
        reference_type, reference_id, note, created_at
      )
      select ii.cafe_id, ii.id_inventory_item, 'order_cancellation', d.qty,
        ii.current_qty, ii.current_qty + d.qty, ii.unit, ii.estimated_unit_cost,
        'order', p_order_id,
        'Dikembalikan, pesanan #' || right(p_order_id, 8) || ' dibatalkan',
        v_now
      from deducted d
      join public."Inventory_Items" ii
        on ii.id_inventory_item = d.inventory_item_id
       and ii.cafe_id = p_cafe_id
      returning inventory_item_id, delta_qty
    )
    update public."Inventory_Items" ii
    set current_qty = ii.current_qty + l.delta_qty,
        updated_at = v_now
    from logged l
    where ii.id_inventory_item = l.inventory_item_id
      and ii.cafe_id = p_cafe_id;

    get diagnostics v_restored = row_count;
  end if;

  update public."Orders"
  set status = 'cancelled',
      cancelled_at = v_now,
      cancelled_reason = v_reason,
      cancelled_by = p_actor
  where id_order = p_order_id and cafe_id = p_cafe_id;

  return jsonb_build_object(
    'status', 'cancelled',
    'already', false,
    'restored_items', v_restored,
    'cancelled_at', v_now
  );
end;
$$;

create or replace function public.settle_payment_order(
  p_order_id text,
  p_transaction_id text,
  p_payment_type text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_result jsonb;
  v_confirm_error text;
  v_payment_method text;
  v_rows integer;
  v_status text;
begin
  if nullif(trim(p_order_id), '') is null
     or nullif(trim(p_transaction_id), '') is null
     or nullif(trim(p_payment_type), '') is null then
    return jsonb_build_object('error', 'payment_identity_missing');
  end if;

  select payment_status, status, payment_transaction_id
    into v_order
  from public."Orders"
  where id_order = p_order_id
  for update;

  if not found then
    return jsonb_build_object('error', 'order_not_found');
  end if;
  if v_order.status not in ('awaiting', 'received', 'preparing') then
    if v_order.payment_status = 'paid' then
      return jsonb_build_object('ok', true, 'already', true);
    end if;
    return jsonb_build_object('error', 'order_not_active');
  end if;
  if v_order.payment_status = 'paid' then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  if v_order.payment_transaction_id is distinct from p_transaction_id then
    return jsonb_build_object('ok', true, 'stale', true);
  end if;

  v_payment_method := case p_payment_type
    when 'gopay' then 'gopay'
    when 'shopeepay' then 'shopeepay'
    when 'bank_transfer' then 'bank_transfer'
    when 'echannel' then 'bank_transfer'
    when 'qris' then 'qris'
    else 'qris'
  end;

  v_result := public.confirm_order(p_order_id);
  v_confirm_error := v_result->>'error';
  if v_confirm_error is not null and v_confirm_error <> 'insufficient_inventory' then
    return v_result;
  end if;

  update public."Orders"
  set payment_status = 'paid',
      payment_method = v_payment_method,
      payment_qr_url = null,
      payment_transaction_id = null,
      payment_idempotency_key = null
  where id_order = p_order_id
    and status in ('awaiting', 'received', 'preparing')
    and payment_status <> 'paid'
    and payment_transaction_id = p_transaction_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    return jsonb_build_object('error', 'payment_identity_race');
  end if;

  if v_confirm_error = 'insufficient_inventory' then
    update public."Orders"
    set status = 'received'
    where id_order = p_order_id
      and status = 'awaiting';
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      select status into v_status
      from public."Orders"
      where id_order = p_order_id;
      if v_status is distinct from 'received' then
        return jsonb_build_object('error', 'order_reconciliation_failed');
      end if;
    elsif v_rows <> 1 then
      return jsonb_build_object('error', 'order_reconciliation_failed');
    end if;
  end if;

  return v_result;
end;
$$;

revoke all on function public.quote_order(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.confirm_order_checkout_final_review_v1(text) from public, anon, authenticated, service_role;
revoke all on function public.confirm_order(text) from public, anon, authenticated;
revoke all on function public.cancel_order(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.settle_payment_order(text, text, text) from public, anon, authenticated;
grant execute on function public.quote_order(uuid, jsonb) to service_role;
grant execute on function public.confirm_order(text) to service_role;
grant execute on function public.cancel_order(uuid, text, text, uuid) to service_role;
grant execute on function public.settle_payment_order(text, text, text) to service_role;

commit;
