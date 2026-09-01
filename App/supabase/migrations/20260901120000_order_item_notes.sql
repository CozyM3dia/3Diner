-- 3Diner — Catatan per-item (POS "Add Note" / "Catatan" di Item Details)
--
-- Sebelumnya catatan per item hanya hidup di UI keranjang POS: field 'note'
-- pada item request dibuang oleh quote_order dan create_order, jadi catatan
-- kasir tidak pernah sampai ke dapur/struk. Migration ini meneruskannya:
--   * quote_order          : validasi 'note' (string opsional, dipotong 140),
--                            membawa 'note' di canonical items (pratinjau).
--   * create_order_payment_lifecycle_v1 : menyimpan 'note' di Orders.items.
-- Konsistensi hash quote->commit aman: request_hash memakai p_items apa
-- adanya di KEDUA sisi, dan field ekstra tidak mengubah harga.
-- Sumber definisi: dump pg_proc live (Temp/notes) supaya tidak menimpa
-- perbaikan environment yang belum tercatat di migration lokal.

begin;

create or replace function public.create_order_payment_lifecycle_v1(
  p_cafe_id uuid,
  p_table_number text,
  p_items jsonb,
  p_notes text default null,
  p_channel text default 'online'
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$

declare
  v_order_id text := gen_random_uuid()::text;
  v_customer_token uuid := gen_random_uuid();
  v_subtotal integer := 0;
  v_tax_amount integer := 0;
  v_service_amount integer := 0;
  v_total integer := 0;
  v_order_items jsonb;
  v_now timestamptz := now();
  v_bad_group text;
  v_checkin_code text;
  v_payment_status text;
  v_payment_method text;
  v_code_bytes bytea;
  v_i integer;
  v_tax jsonb;
  v_tax_pct numeric(5,2);
  v_service_pct numeric(5,2);
  v_include boolean;
begin
  if p_cafe_id is null or nullif(trim(p_table_number), '') is null then
    raise exception 'invalid_order_request' using errcode = '22023';
  end if;
  if p_channel not in ('online','cashier') then
    raise exception 'invalid_order_request' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  drop table if exists pg_temp.tmp_raw_requested_items;
  drop table if exists pg_temp.tmp_requested_lines;
  drop table if exists pg_temp.tmp_line_options;
  drop table if exists pg_temp.tmp_canonical_lines;

  create temporary table tmp_raw_requested_items (item jsonb not null) on commit drop;
  insert into tmp_raw_requested_items (item)
  select item from jsonb_array_elements(p_items) as item;

  if exists (
    select 1 from tmp_raw_requested_items
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
    select 1 from tmp_raw_requested_items r
    cross join lateral jsonb_array_elements(coalesce(r.item->'options', '[]'::jsonb)) as opt
    where jsonb_typeof(opt) <> 'string'
      or (opt #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  create temporary table tmp_requested_lines (
    line_key text primary key, id_menu uuid not null,
    option_ids uuid[] not null, qty integer not null, note text
  ) on commit drop;

  insert into tmp_requested_lines (line_key, id_menu, option_ids, qty, note)
  select normalized.id_menu::text || ':' || array_to_string(normalized.option_ids, ','),
         normalized.id_menu, normalized.option_ids, sum(normalized.qty)::integer,
         min(coalesce(nullif(btrim(normalized.item_note), ''), null))
  from (
    select (r.item->>'id_menu')::uuid as id_menu,
      coalesce((
        select array_agg(distinct (opt #>> '{}')::uuid order by (opt #>> '{}')::uuid)
        from jsonb_array_elements(coalesce(r.item->'options', '[]'::jsonb)) as opt
      ), array[]::uuid[]) as option_ids,
      (r.item->>'qty')::integer as qty,
      left(r.item->>'note', 140) as item_note
    from tmp_raw_requested_items r
  ) normalized
  group by normalized.id_menu, normalized.option_ids;

  if exists (select 1 from tmp_requested_lines where qty < 1 or qty > 50) then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  create temporary table tmp_line_options on commit drop as
  select l.line_key, l.id_menu, l.qty, ov.id_option_value, ov.name as option_name,
         ov.price_delta, og.id_option_group, og.name as group_name
  from tmp_requested_lines l
  cross join lateral unnest(l.option_ids) as opt(option_id)
  join public."Menu_Option_Values" ov
    on ov.id_option_value = opt.option_id and ov.cafe_id = p_cafe_id and ov.is_active = true
  join public."Menu_Option_Groups" og
    on og.id_option_group = ov.option_group_id and og.menu_id = l.id_menu;

  if (select count(*) from tmp_line_options)
     <> (select coalesce(sum(cardinality(option_ids)), 0) from tmp_requested_lines) then
    raise exception 'menu_unavailable' using errcode = 'P0001';
  end if;

  select og.name into v_bad_group
  from tmp_requested_lines l
  join public."Menu_Option_Groups" og on og.menu_id = l.id_menu and og.cafe_id = p_cafe_id
  left join tmp_line_options lo on lo.line_key = l.line_key and lo.id_option_group = og.id_option_group
  group by l.line_key, og.id_option_group, og.name, og.min_select, og.max_select
  having count(lo.id_option_value) < og.min_select or count(lo.id_option_value) > og.max_select
  limit 1;
  if v_bad_group is not null then
    raise exception 'menu_unavailable' using errcode = 'P0001';
  end if;

  create temporary table tmp_canonical_lines on commit drop as
  select l.line_key, m.id_menu, m.nama_menu,
    round(m.harga_menu * (1 - least(greatest(coalesce(m.discount_pct, 0), 0), 100) / 100.0))::integer
      + coalesce((select sum(lo.price_delta)::integer from tmp_line_options lo where lo.line_key = l.line_key), 0) as harga_menu,
    l.qty,
    l.note,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_option_value', lo.id_option_value, 'group_name', lo.group_name,
        'name', lo.option_name, 'price_delta', lo.price_delta) order by lo.group_name, lo.option_name)
      from tmp_line_options lo where lo.line_key = l.line_key), '[]'::jsonb) as options
  from tmp_requested_lines l
  join public."Menus" m on m.id_menu = l.id_menu and m.cafe_id = p_cafe_id and coalesce(m.is_active, true) = true;

  if (select count(*) from tmp_canonical_lines) <> (select count(*) from tmp_requested_lines) then
    raise exception 'menu_unavailable' using errcode = 'P0001';
  end if;
  if exists (select 1 from tmp_canonical_lines where harga_menu < 0) then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  select jsonb_agg(jsonb_build_object(
    'id_menu', id_menu, 'nama_menu', nama_menu, 'harga_menu', harga_menu,
    'qty', qty, 'options', options, 'notes', note) order by nama_menu, line_key)
    into v_order_items from tmp_canonical_lines;
  select coalesce(sum(harga_menu * qty), 0)::integer into v_subtotal from tmp_canonical_lines;

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

  if p_channel = 'cashier' then
    v_payment_status := 'awaiting_checkin';
    v_payment_method := 'cash';
    loop
      v_checkin_code := '';
      v_code_bytes := gen_random_bytes(8);
      for v_i in 0..7 loop
        v_checkin_code := v_checkin_code
          || substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + (get_byte(v_code_bytes, v_i) % 32), 1);
      end loop;
      exit when not exists (
        select 1 from public."Orders"
        where cafe_id = p_cafe_id and checkin_code = v_checkin_code);
    end loop;
  else
    v_payment_status := 'awaiting_payment';
    v_payment_method := null;
    v_checkin_code := null;
  end if;

  insert into public."Orders" (
    id_order, cafe_id, table_number, items,
    subtotal, tax_pct, tax_amount, service_pct, service_amount, prices_include_tax,
    total, status,
    payment_method, payment_status, notes, customer_token, checkin_code, created_at
  ) values (
    v_order_id, p_cafe_id, left(trim(p_table_number), 30), v_order_items,
    v_subtotal, v_tax_pct, v_tax_amount, v_service_pct, v_service_amount, v_include,
    v_total, 'awaiting',
    v_payment_method, v_payment_status,
    nullif(left(coalesce(trim(p_notes), ''), 500), ''), v_customer_token, v_checkin_code, v_now
  );

  return jsonb_build_object(
    'order', jsonb_build_object(
      'id_order', v_order_id, 'cafe_id', p_cafe_id,
      'table_number', left(trim(p_table_number), 30), 'items', v_order_items,
      'subtotal', v_subtotal, 'tax_pct', v_tax_pct, 'tax_amount', v_tax_amount,
      'service_pct', v_service_pct, 'service_amount', v_service_amount,
      'prices_include_tax', v_include, 'total', v_total, 'status', 'awaiting',
      'payment_method', v_payment_method, 'payment_status', v_payment_status,
      'notes', nullif(left(coalesce(trim(p_notes), ''), 500), ''), 'created_at', v_now),
    'orderToken', v_customer_token,
    'checkinCode', v_checkin_code
  );
end;
$$;

revoke all on function public.create_order_payment_lifecycle_v1(uuid, text, jsonb, text, text) from public, anon, authenticated, service_role;
grant execute on function public.create_order_payment_lifecycle_v1(uuid, text, jsonb, text, text) to service_role;

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
      or (item ? 'note' and jsonb_typeof(item->'note') <> 'string')
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
      jsonb_build_object('id_menu', id_menu, 'qty', qty, 'options', to_jsonb(option_ids), 'note', note)
      order by line_key
    ),
    '[]'::jsonb
  ) into v_requested
  from (
    select normalized.id_menu::text || ':' || array_to_string(normalized.option_ids, ',') as line_key,
           normalized.id_menu,
           normalized.option_ids,
           sum(normalized.qty)::integer as qty,
           min(coalesce(nullif(btrim(normalized.note), ''), null)) as note
    from (
      select (raw.item->>'id_menu')::uuid as id_menu,
             coalesce((
               select array_agg(distinct option_id.value::uuid order by option_id.value::uuid)
               from jsonb_array_elements_text(coalesce(raw.item->'options', '[]'::jsonb)) as option_id(value)
             ), array[]::uuid[]) as option_ids,
             (raw.item->>'qty')::integer as qty,
             left(raw.item->>'note', 140) as note
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
           item->'options' as options,
           item->>'note' as note
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
           item->'options' as options,
           item->>'note' as note
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
      line.note,
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
           'qty', qty, 'options', options, 'notes', note
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

revoke all on function public.quote_order(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.quote_order(uuid, jsonb) to service_role;

commit;
