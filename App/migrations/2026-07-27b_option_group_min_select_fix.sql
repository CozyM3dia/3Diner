-- 3Diner — grup varian wajib tidak boleh membuat menu mustahil dipesan.
--
-- `getMenuOptionsForCustomer` menyembunyikan grup yang seluruh pilihannya
-- nonaktif, jadi tamu tidak pernah melihatnya dan tidak mengirim apa pun untuk
-- grup itu. Tapi create_order_with_inventory tetap menuntut `min_select`, maka
-- setiap pesanan untuk menu tersebut ditolak `menu_unavailable` — menunya mati
-- diam-diam dan pemilik tidak punya petunjuk kenapa.
--
-- Batas bawah sekarang dijepit ke jumlah pilihan yang benar-benar bisa dipilih:
--   effective_min = least(min_select, jumlah pilihan aktif di grup)
-- Grup tanpa pilihan aktif jadi tidak wajib; grup dengan min_select 2 yang
-- tinggal satu pilihan aktif cukup dipenuhi satu. Ini menyamakan yang dituntut
-- server dengan yang bisa ditawarkan UI.
--
-- Hanya klausa `having` yang berubah dari versi 2026-07-27; sisanya identik
-- karena `create or replace function` menuntut badan fungsi yang utuh.

begin;

create or replace function public.create_order_with_inventory(
  p_cafe_id uuid,
  p_table_number text,
  p_items jsonb,
  p_notes text default null
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
  v_unavailable text[];
  v_now timestamptz := now();
  v_bad_group text;
  v_unavailable_options text[];
begin
  if p_cafe_id is null or nullif(trim(p_table_number), '') is null then
    raise exception 'invalid_order_request' using errcode = '22023';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  if jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  drop table if exists pg_temp.tmp_raw_requested_items;
  drop table if exists pg_temp.tmp_requested_lines;
  drop table if exists pg_temp.tmp_line_options;
  drop table if exists pg_temp.tmp_canonical_lines;
  drop table if exists pg_temp.tmp_required_inventory;

  create temporary table tmp_raw_requested_items (
    item jsonb not null
  ) on commit drop;

  insert into tmp_raw_requested_items (item)
  select item
  from jsonb_array_elements(p_items) as item;

  if exists (
    select 1
    from tmp_raw_requested_items
    where jsonb_typeof(item) <> 'object'
      or not (item ? 'id_menu')
      or not (item ? 'qty')
      or jsonb_typeof(item->'id_menu') <> 'string'
      or jsonb_typeof(item->'qty') <> 'number'
      or (item->>'id_menu') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or (item->>'qty') !~ '^[0-9]+$'
      or length(item->>'qty') > 2
      or (item ? 'options' and jsonb_typeof(item->'options') <> 'array')
      or (item ? 'options' and jsonb_array_length(item->'options') > 20)
  ) then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  -- Setiap id varian harus berbentuk uuid sebelum dicast.
  if exists (
    select 1
    from tmp_raw_requested_items r
    cross join lateral jsonb_array_elements(coalesce(r.item->'options', '[]'::jsonb)) as opt
    where jsonb_typeof(opt) <> 'string'
      or (opt #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  -- Kunci baris = menu + himpunan varian terurut. Urutan pilihan pelanggan tidak
  -- boleh membuat dua baris identik dihitung terpisah.
  create temporary table tmp_requested_lines (
    line_key text primary key,
    id_menu uuid not null,
    option_ids uuid[] not null,
    qty integer not null
  ) on commit drop;

  insert into tmp_requested_lines (line_key, id_menu, option_ids, qty)
  select
    normalized.id_menu::text || ':' || array_to_string(normalized.option_ids, ','),
    normalized.id_menu,
    normalized.option_ids,
    sum(normalized.qty)::integer
  from (
    select
      (r.item->>'id_menu')::uuid as id_menu,
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
  select
    l.line_key,
    l.id_menu,
    l.qty,
    ov.id_option_value,
    ov.name as option_name,
    ov.price_delta,
    og.id_option_group,
    og.name as group_name
  from tmp_requested_lines l
  cross join lateral unnest(l.option_ids) as opt(option_id)
  join public."Menu_Option_Values" ov
    on ov.id_option_value = opt.option_id
   and ov.cafe_id = p_cafe_id
   and ov.is_active = true
  join public."Menu_Option_Groups" og
    on og.id_option_group = ov.option_group_id
   and og.menu_id = l.id_menu;

  -- Varian yang tidak dikenal, nonaktif, atau milik menu lain akan hilang di
  -- join di atas. Selisih jumlah = ada yang tidak sah.
  if (select count(*) from tmp_line_options)
     <> (select coalesce(sum(cardinality(option_ids)), 0) from tmp_requested_lines) then
    raise exception 'menu_unavailable' using errcode = 'P0001';
  end if;

  -- Batas min/max per grup ditegakkan di server; UI klien tidak dipercaya.
  --
  -- Batas bawah dijepit ke jumlah pilihan yang aktif: server tidak boleh
  -- menuntut lebih banyak daripada yang bisa ditawarkan UI kepada tamu.
  select og.name
    into v_bad_group
  from tmp_requested_lines l
  join public."Menu_Option_Groups" og
    on og.menu_id = l.id_menu
   and og.cafe_id = p_cafe_id
  left join tmp_line_options lo
    on lo.line_key = l.line_key
   and lo.id_option_group = og.id_option_group
  group by l.line_key, og.id_option_group, og.name, og.min_select, og.max_select
  having count(lo.id_option_value) < least(
           og.min_select,
           (
             select count(*)
             from public."Menu_Option_Values" ov2
             where ov2.option_group_id = og.id_option_group
               and ov2.is_active = true
           )
         )
      or count(lo.id_option_value) > og.max_select
  limit 1;

  if v_bad_group is not null then
    raise exception 'menu_unavailable' using errcode = 'P0001';
  end if;

  create temporary table tmp_canonical_lines on commit drop as
  select
    l.line_key,
    m.id_menu,
    m.nama_menu,
    round(m.harga_menu * (1 - least(greatest(coalesce(m.discount_pct, 0), 0), 100) / 100.0))::integer
      + coalesce((
          select sum(lo.price_delta)::integer
          from tmp_line_options lo
          where lo.line_key = l.line_key
        ), 0) as harga_menu,
    l.qty,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id_option_value', lo.id_option_value,
          'group_name', lo.group_name,
          'name', lo.option_name,
          'price_delta', lo.price_delta
        )
        order by lo.group_name, lo.option_name
      )
      from tmp_line_options lo
      where lo.line_key = l.line_key
    ), '[]'::jsonb) as options
  from tmp_requested_lines l
  join public."Menus" m
    on m.id_menu = l.id_menu
   and m.cafe_id = p_cafe_id
   and coalesce(m.is_active, true) = true;

  if (select count(*) from tmp_canonical_lines) <> (select count(*) from tmp_requested_lines) then
    raise exception 'menu_unavailable' using errcode = 'P0001';
  end if;

  -- Harga varian boleh negatif (diskon ukuran kecil), tapi harga akhir tidak.
  if exists (select 1 from tmp_canonical_lines where harga_menu < 0) then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  create temporary table tmp_required_inventory on commit drop as
  select
    src.inventory_item_id,
    sum(src.required_qty)::numeric(12,3) as required_qty
  from (
    select
      mr.inventory_item_id,
      mr.qty_per_menu * cl.qty as required_qty
    from tmp_canonical_lines cl
    join public."Menu_Recipes" mr
      on mr.menu_id = cl.id_menu
     and mr.cafe_id = p_cafe_id
    union all
    select
      mor.inventory_item_id,
      mor.qty_per_menu * lo.qty as required_qty
    from tmp_line_options lo
    join public."Menu_Option_Recipes" mor
      on mor.option_value_id = lo.id_option_value
     and mor.cafe_id = p_cafe_id
  ) src
  group by src.inventory_item_id;

  perform 1
  from public."Inventory_Items" ii
  join tmp_required_inventory req on req.inventory_item_id = ii.id_inventory_item
  where ii.cafe_id = p_cafe_id
  for update of ii;

  select array_agg(distinct cl.nama_menu)
    into v_unavailable
  from tmp_canonical_lines cl
  join public."Menu_Recipes" mr
    on mr.menu_id = cl.id_menu
   and mr.cafe_id = p_cafe_id
  join public."Inventory_Items" ii
    on ii.id_inventory_item = mr.inventory_item_id
   and ii.cafe_id = p_cafe_id
  join tmp_required_inventory req
    on req.inventory_item_id = ii.id_inventory_item
  where ii.current_qty < req.required_qty;

  -- Kekurangan stok bisa juga berasal dari bahan yang hanya dipakai varian.
  select array_agg(distinct cl.nama_menu)
    into v_unavailable_options
  from tmp_line_options lo
  join tmp_canonical_lines cl on cl.line_key = lo.line_key
  join public."Menu_Option_Recipes" mor
    on mor.option_value_id = lo.id_option_value
   and mor.cafe_id = p_cafe_id
  join public."Inventory_Items" ii
    on ii.id_inventory_item = mor.inventory_item_id
   and ii.cafe_id = p_cafe_id
  join tmp_required_inventory req
    on req.inventory_item_id = ii.id_inventory_item
  where ii.current_qty < req.required_qty;

  select array_agg(distinct nama)
    into v_unavailable
  from unnest(
    coalesce(v_unavailable, array[]::text[])
    || coalesce(v_unavailable_options, array[]::text[])
  ) as nama;

  if coalesce(array_length(v_unavailable, 1), 0) > 0 then
    return jsonb_build_object(
      'error', 'insufficient_inventory',
      'unavailableMenus', to_jsonb(v_unavailable)
    );
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id_menu', id_menu,
      'nama_menu', nama_menu,
      'harga_menu', harga_menu,
      'qty', qty,
      'options', options
    )
    order by nama_menu, line_key
  )
    into v_order_items
  from tmp_canonical_lines;

  select coalesce(sum(harga_menu * qty), 0)::integer
    into v_total
  from tmp_canonical_lines;

  insert into public."Orders" (
    id_order,
    cafe_id,
    table_number,
    items,
    total,
    status,
    payment_method,
    payment_status,
    notes,
    customer_token,
    created_at
  ) values (
    v_order_id,
    p_cafe_id,
    left(trim(p_table_number), 30),
    v_order_items,
    v_total,
    'received',
    null,
    'unpaid',
    nullif(left(coalesce(trim(p_notes), ''), 500), ''),
    v_customer_token,
    v_now
  );

  insert into public."Inventory_Movements" (
    cafe_id,
    inventory_item_id,
    movement_type,
    delta_qty,
    qty_before,
    qty_after,
    unit,
    unit_cost,
    reference_type,
    reference_id,
    note,
    created_at
  )
  select
    ii.cafe_id,
    ii.id_inventory_item,
    'order_deduction',
    -req.required_qty,
    ii.current_qty,
    ii.current_qty - req.required_qty,
    ii.unit,
    ii.estimated_unit_cost,
    'order',
    v_order_id,
    'Dipakai untuk pesanan #' || right(v_order_id, 8),
    v_now
  from public."Inventory_Items" ii
  join tmp_required_inventory req on req.inventory_item_id = ii.id_inventory_item
  where ii.cafe_id = p_cafe_id
    and req.required_qty > 0;

  update public."Inventory_Items" ii
  set current_qty = ii.current_qty - req.required_qty,
      updated_at = v_now
  from tmp_required_inventory req
  where ii.id_inventory_item = req.inventory_item_id
    and ii.cafe_id = p_cafe_id
    and req.required_qty > 0;

  return jsonb_build_object(
    'order',
    jsonb_build_object(
      'id_order', v_order_id,
      'cafe_id', p_cafe_id,
      'table_number', left(trim(p_table_number), 30),
      'items', v_order_items,
      'total', v_total,
      'status', 'received',
      'payment_method', null,
      'payment_status', 'unpaid',
      'notes', nullif(left(coalesce(trim(p_notes), ''), 500), ''),
      'customer_token', v_customer_token,
      'created_at', v_now
    ),
    'orderToken', v_customer_token
  );
end;
$$;

revoke all on function public.create_order_with_inventory(uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_order_with_inventory(uuid, text, jsonb, text) to service_role;

commit;
