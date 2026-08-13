begin;

-- Canonical, read-only preview of the values create_order will persist. It
-- deliberately has no table writes, inventory reads, or row locks: availability
-- is rechecked when the customer actually creates and confirms the order.
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
  v_now timestamptz := now();
  v_jakarta_time time;
begin
  if p_cafe_id is null then
    raise exception 'invalid_order_request' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  -- Keep create_order's guard order: validate JSON before casting JSON strings
  -- to UUIDs or quantities.
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

  -- Normalize option IDs and aggregate only identical menu-plus-option lines,
  -- matching the canonical line identity used by create_order.
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

  -- An option must be active, belong to this cafe, and belong to the requested
  -- menu through its own option group. Count equality rejects all other IDs.
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

  -- Required and maximum selections are checked for every requested menu. The
  -- lower bound is clamped to active choices, just like the repaired order RPC.
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
  having count(selected.id_option_value) < least(
           og.min_select,
           (select count(*) from public."Menu_Option_Values" active_value
            where active_value.option_group_id = og.id_option_group and active_value.is_active = true)
         )
      or count(selected.id_option_value) > og.max_select
  limit 1;
  if v_bad_group is not null then
    raise exception 'menu_unavailable' using errcode = 'P0001';
  end if;

  v_jakarta_time := (v_now at time zone 'Asia/Jakarta')::time;

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
     and (
       nullif(btrim(m.schedule_days::text), '') is null
       or extract(isodow from v_now at time zone 'Asia/Jakarta')::text = any(
         regexp_split_to_array(btrim(m.schedule_days::text), '\\s*,\\s*')
       )
     )
     and (
       nullif(btrim(m.schedule_start::text), '') is null
       or nullif(btrim(m.schedule_end::text), '') is null
       or (
         btrim(m.schedule_start::text)::time <= btrim(m.schedule_end::text)::time
         and v_jakarta_time between btrim(m.schedule_start::text)::time and btrim(m.schedule_end::text)::time
       )
       or (
         btrim(m.schedule_start::text)::time > btrim(m.schedule_end::text)::time
         and (v_jakarta_time >= btrim(m.schedule_start::text)::time or v_jakarta_time <= btrim(m.schedule_end::text)::time)
       )
     )
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

  -- Preserve create_order's integer rounding and included-tax behavior exactly.
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

revoke all on function public.quote_order(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.quote_order(uuid, jsonb) to service_role;

commit;
