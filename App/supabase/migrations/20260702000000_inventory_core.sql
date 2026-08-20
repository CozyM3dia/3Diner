begin;

create table if not exists public."Inventory_Items" (
  id_inventory_item uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public."Cafes"(id_cafe) on delete cascade,
  name text not null,
  unit text not null check (unit in ('gram', 'kg', 'ml', 'liter', 'pcs', 'pack', 'botol')),
  current_qty numeric(12,3) not null default 0 check (current_qty >= 0),
  minimum_qty numeric(12,3) not null default 0 check (minimum_qty >= 0),
  estimated_unit_cost integer not null default 0 check (estimated_unit_cost >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists "Inventory_Items_cafe_lower_name_key"
  on public."Inventory_Items" (cafe_id, lower(name));

create index if not exists "Inventory_Items_cafe_name_idx"
  on public."Inventory_Items" (cafe_id, name);

create index if not exists "Inventory_Items_cafe_qty_idx"
  on public."Inventory_Items" (cafe_id, current_qty);

create table if not exists public."Menu_Recipes" (
  id_menu_recipe uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public."Cafes"(id_cafe) on delete cascade,
  menu_id uuid not null references public."Menus"(id_menu) on delete cascade,
  inventory_item_id uuid not null references public."Inventory_Items"(id_inventory_item) on delete restrict,
  qty_per_menu numeric(12,3) not null check (qty_per_menu > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (menu_id, inventory_item_id)
);

create index if not exists "Menu_Recipes_cafe_menu_idx"
  on public."Menu_Recipes" (cafe_id, menu_id);

create index if not exists "Menu_Recipes_cafe_item_idx"
  on public."Menu_Recipes" (cafe_id, inventory_item_id);

create table if not exists public."Inventory_Movements" (
  id_inventory_movement uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public."Cafes"(id_cafe) on delete cascade,
  inventory_item_id uuid not null references public."Inventory_Items"(id_inventory_item) on delete restrict,
  movement_type text not null check (movement_type in ('manual_add', 'manual_subtract', 'manual_set', 'order_deduction')),
  delta_qty numeric(12,3) not null,
  qty_before numeric(12,3) not null check (qty_before >= 0),
  qty_after numeric(12,3) not null check (qty_after >= 0),
  unit text not null,
  unit_cost integer,
  reference_type text,
  reference_id text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists "Inventory_Movements_cafe_created_idx"
  on public."Inventory_Movements" (cafe_id, created_at desc);

create index if not exists "Inventory_Movements_cafe_item_created_idx"
  on public."Inventory_Movements" (cafe_id, inventory_item_id, created_at desc);

create index if not exists "Inventory_Movements_reference_idx"
  on public."Inventory_Movements" (reference_type, reference_id);

alter table public."Inventory_Items" enable row level security;
alter table public."Menu_Recipes" enable row level security;
alter table public."Inventory_Movements" enable row level security;

revoke all on table
  public."Inventory_Items",
  public."Menu_Recipes",
  public."Inventory_Movements"
from public, anon, authenticated;

alter table public."Orders"
  add column if not exists notes text;

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
  drop table if exists pg_temp.tmp_requested_items;
  drop table if exists pg_temp.tmp_canonical_items;
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
  ) then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  create temporary table tmp_requested_items (
    id_menu uuid primary key,
    qty integer not null
  ) on commit drop;

  insert into tmp_requested_items (id_menu, qty)
  select
    (item->>'id_menu')::uuid as id_menu,
    sum((item->>'qty')::integer)::integer as qty
  from tmp_raw_requested_items
  group by (item->>'id_menu')::uuid;

  if exists (select 1 from tmp_requested_items where qty < 1 or qty > 50) then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  create temporary table tmp_canonical_items on commit drop as
  select
    m.id_menu,
    m.nama_menu,
    round(m.harga_menu * (1 - least(greatest(coalesce(m.discount_pct, 0), 0), 100) / 100.0))::integer as harga_menu,
    r.qty
  from tmp_requested_items r
  join public."Menus" m
    on m.id_menu = r.id_menu
   and m.cafe_id = p_cafe_id
   and coalesce(m.is_active, true) = true;

  if (select count(*) from tmp_canonical_items) <> (select count(*) from tmp_requested_items) then
    raise exception 'menu_unavailable' using errcode = 'P0001';
  end if;

  create temporary table tmp_required_inventory on commit drop as
  select
    mr.inventory_item_id,
    sum(mr.qty_per_menu * ci.qty)::numeric(12,3) as required_qty
  from tmp_canonical_items ci
  join public."Menu_Recipes" mr
    on mr.menu_id = ci.id_menu
   and mr.cafe_id = p_cafe_id
  group by mr.inventory_item_id;

  perform 1
  from public."Inventory_Items" ii
  join tmp_required_inventory req on req.inventory_item_id = ii.id_inventory_item
  where ii.cafe_id = p_cafe_id
  for update of ii;

  select array_agg(distinct ci.nama_menu)
    into v_unavailable
  from tmp_canonical_items ci
  join public."Menu_Recipes" mr
    on mr.menu_id = ci.id_menu
   and mr.cafe_id = p_cafe_id
  join public."Inventory_Items" ii
    on ii.id_inventory_item = mr.inventory_item_id
   and ii.cafe_id = p_cafe_id
  join tmp_required_inventory req
    on req.inventory_item_id = ii.id_inventory_item
  where ii.current_qty < req.required_qty;

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
      'qty', qty
    )
    order by nama_menu, id_menu
  )
    into v_order_items
  from tmp_canonical_items;

  select coalesce(sum(harga_menu * qty), 0)::integer
    into v_total
  from tmp_canonical_items;

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

create or replace function public.adjust_inventory_stock(
  p_cafe_id uuid,
  p_inventory_item_id uuid,
  p_mode text,
  p_quantity numeric,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before numeric(12,3);
  v_after numeric(12,3);
  v_delta numeric(12,3);
  v_unit text;
  v_unit_cost integer;
  v_movement_type text;
  v_now timestamptz := now();
begin
  if p_cafe_id is null
    or p_inventory_item_id is null
    or p_mode is null
    or p_mode not in ('add', 'subtract', 'set')
    or p_quantity is null
    or p_quantity < 0 then
    return jsonb_build_object('error', 'invalid_adjustment');
  end if;

  select current_qty, unit, estimated_unit_cost
    into v_before, v_unit, v_unit_cost
  from public."Inventory_Items"
  where id_inventory_item = p_inventory_item_id
    and cafe_id = p_cafe_id
  for update;
  if not found then
    return jsonb_build_object('error', 'inventory_not_found');
  end if;

  v_after := case p_mode
    when 'add' then v_before + p_quantity
    when 'subtract' then v_before - p_quantity
    else p_quantity
  end;
  if v_after < 0 then
    return jsonb_build_object('error', 'negative_stock');
  end if;
  v_delta := v_after - v_before;
  if v_delta = 0 then
    return jsonb_build_object('error', 'invalid_adjustment');
  end if;

  v_movement_type := case p_mode
    when 'add' then 'manual_add'
    when 'subtract' then 'manual_subtract'
    else 'manual_set'
  end;

  update public."Inventory_Items"
  set current_qty = v_after,
      updated_at = v_now
  where id_inventory_item = p_inventory_item_id
    and cafe_id = p_cafe_id;

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
    note,
    created_at
  ) values (
    p_cafe_id,
    p_inventory_item_id,
    v_movement_type,
    v_delta,
    v_before,
    v_after,
    v_unit,
    v_unit_cost,
    'manual',
    nullif(trim(p_note), ''),
    v_now
  );

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.replace_menu_recipes(
  p_cafe_id uuid,
  p_menu_id uuid,
  p_rows jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_cafe_id is null or p_menu_id is null then
    return jsonb_build_object('error', 'menu_not_found');
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return jsonb_build_object('error', 'invalid_recipe_rows');
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) as entry
    where jsonb_typeof(entry) <> 'object'
      or jsonb_typeof(entry->'inventory_item_id') <> 'string'
      or (entry->>'inventory_item_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or jsonb_typeof(entry->'qty_per_menu') <> 'number'
  ) then
    return jsonb_build_object('error', 'invalid_recipe_rows');
  end if;

  perform 1
  from public."Menus"
  where id_menu = p_menu_id
    and cafe_id = p_cafe_id
  for update;
  if not found then
    return jsonb_build_object('error', 'menu_not_found');
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as row(inventory_item_id uuid, qty_per_menu numeric)
    where row.qty_per_menu is null or row.qty_per_menu <= 0
  ) then
    return jsonb_build_object('error', 'invalid_recipe_rows');
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as row(inventory_item_id uuid, qty_per_menu numeric)
    group by row.inventory_item_id
    having count(*) > 1
  ) then
    return jsonb_build_object('error', 'duplicate_recipe_item');
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as row(inventory_item_id uuid, qty_per_menu numeric)
    left join public."Inventory_Items" ii
      on ii.id_inventory_item = row.inventory_item_id
     and ii.cafe_id = p_cafe_id
    where ii.id_inventory_item is null
  ) then
    return jsonb_build_object('error', 'inventory_item_not_found');
  end if;

  delete from public."Menu_Recipes"
  where menu_id = p_menu_id
    and cafe_id = p_cafe_id;

  insert into public."Menu_Recipes" (
    cafe_id,
    menu_id,
    inventory_item_id,
    qty_per_menu
  )
  select
    p_cafe_id,
    p_menu_id,
    row.inventory_item_id,
    row.qty_per_menu
  from jsonb_to_recordset(p_rows) as row(inventory_item_id uuid, qty_per_menu numeric);

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.create_order_with_inventory(uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_order_with_inventory(uuid, text, jsonb, text) to service_role;
revoke all on function public.adjust_inventory_stock(uuid, uuid, text, numeric, text) from public, anon, authenticated;
revoke all on function public.replace_menu_recipes(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.adjust_inventory_stock(uuid, uuid, text, numeric, text) to service_role;
grant execute on function public.replace_menu_recipes(uuid, uuid, jsonb) to service_role;

commit;
