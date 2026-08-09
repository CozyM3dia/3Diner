-- App/supabase/migrations/20260809120000_payment_lifecycle_split.sql
-- 3Diner — pisahkan pembuatan pesanan dari potong stok, tambah check-in kasir.
begin;

create extension if not exists pgcrypto;

-- ── Kolom baru ──────────────────────────────────────────────
alter table public."Orders"
  add column if not exists checkin_code text;

-- Kode 8-char unik per kafe selama pesanan belum di-check-in. Partial index:
-- setelah check-in kode boleh dilepas/berulang tanpa melanggar keunikan.
create unique index if not exists "Orders_checkin_code_unique"
  on public."Orders" (cafe_id, checkin_code)
  where checkin_code is not null;

-- Perluas nilai payment_method yang sah. Longgar dulu terhadap baris lama.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'Orders_payment_method_valid'
      and conrelid = 'public."Orders"'::regclass
  ) then
    alter table public."Orders"
      add constraint "Orders_payment_method_valid"
      check (payment_method is null or payment_method in
        ('cash','qris','gopay','shopeepay','bank_transfer'));
  end if;
end $$;

-- ── create_order: validasi + persist, TANPA potong stok ──────
create or replace function public.create_order(
  p_cafe_id uuid,
  p_table_number text,
  p_items jsonb,
  p_notes text default null,
  p_channel text default 'online'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id text := gen_random_uuid()::text;
  v_customer_token uuid := gen_random_uuid();
  v_total integer := 0;
  v_order_items jsonb;
  v_now timestamptz := now();
  v_bad_group text;
  v_checkin_code text;
  v_payment_status text;
  v_payment_method text;
  v_code_bytes bytea;
  v_i integer;
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
    option_ids uuid[] not null, qty integer not null
  ) on commit drop;

  insert into tmp_requested_lines (line_key, id_menu, option_ids, qty)
  select normalized.id_menu::text || ':' || array_to_string(normalized.option_ids, ','),
         normalized.id_menu, normalized.option_ids, sum(normalized.qty)::integer
  from (
    select (r.item->>'id_menu')::uuid as id_menu,
      coalesce((
        select array_agg(distinct (opt #>> '{}')::uuid order by (opt #>> '{}')::uuid)
        from jsonb_array_elements(coalesce(r.item->'options', '[]'::jsonb)) as opt
      ), array[]::uuid[]) as option_ids,
      (r.item->>'qty')::integer as qty
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
    'qty', qty, 'options', options) order by nama_menu, line_key)
    into v_order_items from tmp_canonical_lines;
  select coalesce(sum(harga_menu * qty), 0)::integer into v_total from tmp_canonical_lines;

  if p_channel = 'cashier' then
    v_payment_status := 'awaiting_checkin';
    v_payment_method := 'cash';
    -- Crockford base32, 8 char, hindari huruf ambigu. Ulang jika bentrok.
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
    id_order, cafe_id, table_number, items, total, status,
    payment_method, payment_status, notes, customer_token, checkin_code, created_at
  ) values (
    v_order_id, p_cafe_id, left(trim(p_table_number), 30), v_order_items, v_total, 'awaiting',
    v_payment_method, v_payment_status,
    nullif(left(coalesce(trim(p_notes), ''), 500), ''), v_customer_token, v_checkin_code, v_now
  );

  return jsonb_build_object(
    'order', jsonb_build_object(
      'id_order', v_order_id, 'cafe_id', p_cafe_id,
      'table_number', left(trim(p_table_number), 30), 'items', v_order_items,
      'total', v_total, 'status', 'awaiting',
      'payment_method', v_payment_method, 'payment_status', v_payment_status,
      'notes', nullif(left(coalesce(trim(p_notes), ''), 500), ''), 'created_at', v_now),
    'orderToken', v_customer_token,
    'checkinCode', v_checkin_code
  );
end;
$$;

-- ── confirm_order: re-validasi + potong stok atomic ─────────
create or replace function public.confirm_order(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cafe_id uuid;
  v_status text;
  v_items jsonb;
  v_now timestamptz := now();
  v_unavailable text[];
  v_unavailable_options text[];
begin
  if p_order_id is null then
    return jsonb_build_object('error', 'order_not_found');
  end if;

  select cafe_id, status, items into v_cafe_id, v_status, v_items
  from public."Orders" where id_order = p_order_id for update;
  if not found then
    return jsonb_build_object('error', 'order_not_found');
  end if;
  if v_status <> 'awaiting' then
    -- Sudah dikonfirmasi (webhook dobel / balapan check-in). Idempoten.
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  drop table if exists pg_temp.tmp_confirm_lines;
  drop table if exists pg_temp.tmp_confirm_req;

  create temporary table tmp_confirm_lines on commit drop as
  select (line->>'id_menu')::uuid as id_menu,
         (line->>'qty')::integer as qty,
         line->'options' as options
  from jsonb_array_elements(v_items) as line;

  create temporary table tmp_confirm_req on commit drop as
  select src.inventory_item_id, sum(src.required_qty)::numeric(12,3) as required_qty
  from (
    select mr.inventory_item_id, mr.qty_per_menu * cl.qty as required_qty
    from tmp_confirm_lines cl
    join public."Menu_Recipes" mr on mr.menu_id = cl.id_menu and mr.cafe_id = v_cafe_id
    union all
    select mor.inventory_item_id, mor.qty_per_menu * cl.qty as required_qty
    from tmp_confirm_lines cl
    cross join lateral jsonb_array_elements(coalesce(cl.options, '[]'::jsonb)) as opt
    join public."Menu_Option_Recipes" mor
      on mor.option_value_id = (opt->>'id_option_value')::uuid and mor.cafe_id = v_cafe_id
  ) src
  group by src.inventory_item_id;

  perform 1 from public."Inventory_Items" ii
  join tmp_confirm_req req on req.inventory_item_id = ii.id_inventory_item
  where ii.cafe_id = v_cafe_id for update of ii;

  select array_agg(distinct m.nama_menu) into v_unavailable
  from tmp_confirm_lines cl
  join public."Menus" m on m.id_menu = cl.id_menu and m.cafe_id = v_cafe_id
  join public."Menu_Recipes" mr on mr.menu_id = cl.id_menu and mr.cafe_id = v_cafe_id
  join public."Inventory_Items" ii on ii.id_inventory_item = mr.inventory_item_id and ii.cafe_id = v_cafe_id
  join tmp_confirm_req req on req.inventory_item_id = ii.id_inventory_item
  where ii.current_qty < req.required_qty;

  select array_agg(distinct m.nama_menu) into v_unavailable_options
  from tmp_confirm_lines cl
  join public."Menus" m on m.id_menu = cl.id_menu and m.cafe_id = v_cafe_id
  cross join lateral jsonb_array_elements(coalesce(cl.options, '[]'::jsonb)) as opt
  join public."Menu_Option_Recipes" mor
    on mor.option_value_id = (opt->>'id_option_value')::uuid and mor.cafe_id = v_cafe_id
  join public."Inventory_Items" ii on ii.id_inventory_item = mor.inventory_item_id and ii.cafe_id = v_cafe_id
  join tmp_confirm_req req on req.inventory_item_id = ii.id_inventory_item
  where ii.current_qty < req.required_qty;

  select array_agg(distinct nama) into v_unavailable
  from unnest(coalesce(v_unavailable, array[]::text[]) || coalesce(v_unavailable_options, array[]::text[])) as nama;

  if coalesce(array_length(v_unavailable, 1), 0) > 0 then
    return jsonb_build_object('error', 'insufficient_inventory',
      'unavailableMenus', to_jsonb(v_unavailable));
  end if;

  insert into public."Inventory_Movements" (
    cafe_id, inventory_item_id, movement_type, delta_qty, qty_before, qty_after,
    unit, unit_cost, reference_type, reference_id, note, created_at)
  select ii.cafe_id, ii.id_inventory_item, 'order_deduction', -req.required_qty,
    ii.current_qty, ii.current_qty - req.required_qty, ii.unit, ii.estimated_unit_cost,
    'order', p_order_id, 'Dipakai untuk pesanan #' || right(p_order_id, 8), v_now
  from public."Inventory_Items" ii
  join tmp_confirm_req req on req.inventory_item_id = ii.id_inventory_item
  where ii.cafe_id = v_cafe_id and req.required_qty > 0;

  update public."Inventory_Items" ii
  set current_qty = ii.current_qty - req.required_qty, updated_at = v_now
  from tmp_confirm_req req
  where ii.id_inventory_item = req.inventory_item_id
    and ii.cafe_id = v_cafe_id and req.required_qty > 0;

  update public."Orders"
  set status = 'received'
  where id_order = p_order_id and status = 'awaiting';

  return jsonb_build_object('ok', true);
end;
$$;

-- ── checkin_order: resolusi kode (cafe-scoped) → confirm ────
-- Kode 8-char unik per kafe (lihat "Orders_checkin_code_unique") jadi
-- cukup untuk temukan tepat satu pesanan — tak perlu order id manual.
create or replace function public.checkin_order(
  p_cafe_id uuid, p_checkin_code text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id text;
begin
  if p_cafe_id is null or nullif(trim(p_checkin_code), '') is null
     or upper(trim(p_checkin_code)) !~ '^[A-Z0-9]{8}$' then
    return jsonb_build_object('error', 'checkin_invalid');
  end if;

  select id_order into v_order_id
  from public."Orders"
  where cafe_id = p_cafe_id
    and checkin_code = upper(trim(p_checkin_code))
    and payment_method = 'cash'
    and status = 'awaiting';
  if not found then
    return jsonb_build_object('error', 'checkin_invalid');
  end if;

  return public.confirm_order(v_order_id);
end;
$$;

-- ── get_order_for_customer: sertakan checkin_code ───────────
-- Layar pelanggan bayar-di-kasir butuh kode ini untuk merender QR + 8 digit
-- saat halaman dibuka ulang (server, bukan localStorage, sumber kebenarannya).
create or replace function public.get_order_for_customer(
  p_order_id text,
  p_token uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_cafe record;
begin
  if p_order_id is null or p_token is null then
    return jsonb_build_object('error', 'order_not_found');
  end if;

  select o.id_order, o.cafe_id, o.table_number, o.items, o.total, o.status,
         o.payment_method, o.payment_status, o.notes, o.created_at, o.checkin_code
    into v_order
  from public."Orders" o
  where o.id_order = p_order_id
    and o.customer_token = p_token;

  if not found then
    return jsonb_build_object('error', 'order_not_found');
  end if;

  select c.nama_cafe, c.slug_url, c.google_maps_review_url
    into v_cafe
  from public."Cafes" c
  where c.id_cafe = v_order.cafe_id;

  return jsonb_build_object(
    'order', jsonb_build_object(
      'id_order', v_order.id_order,
      'cafe_id', v_order.cafe_id,
      'cafe_name', v_cafe.nama_cafe,
      'cafe_slug', v_cafe.slug_url,
      'table_number', v_order.table_number,
      'items', v_order.items,
      'total', v_order.total,
      'status', v_order.status,
      'payment_method', v_order.payment_method,
      'payment_status', v_order.payment_status,
      'notes', v_order.notes,
      'created_at', v_order.created_at,
      -- Hanya relevan selama menunggu check-in; jangan bocorkan kode setelahnya.
      'checkin_code', case when v_order.payment_status = 'awaiting_checkin'
                          then v_order.checkin_code else null end
    ),
    'reviewUrl', v_cafe.google_maps_review_url
  );
end;
$$;

-- ── Hak akses ───────────────────────────────────────────────
revoke all on function public.create_order(uuid, text, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.confirm_order(text) from public, anon, authenticated;
revoke all on function public.checkin_order(uuid, text) from public, anon, authenticated;
grant execute on function public.create_order(uuid, text, jsonb, text, text) to service_role;
grant execute on function public.confirm_order(text) to service_role;
grant execute on function public.checkin_order(uuid, text) to service_role;

commit;
