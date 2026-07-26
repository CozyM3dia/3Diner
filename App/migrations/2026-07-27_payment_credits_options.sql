-- 3Diner — sinkronisasi pembayaran, metering credit AI, dan varian menu.
--
-- Tiga hal digabung dalam satu migrasi karena create_order_with_inventory harus
-- ditulis ulang untuk varian, dan menulis ulangnya dua kali di dua migrasi
-- terpisah lebih berisiko daripada sekali.

begin;

-- ─────────────────────────────────────────────────────────────
-- 1. Metering credit AI + gerbang bayar
-- ─────────────────────────────────────────────────────────────

alter table public."Cafes"
  add column if not exists ai_credits_quota integer not null default 5,
  add column if not exists ai_credits_used integer not null default 0,
  add column if not exists ai_credits_period_start date not null default date_trunc('month', now())::date;

-- Kuota awal mengikuti tier di STRATEGY.md §5. Hanya diterapkan pada baris yang
-- masih memakai default, supaya kuota yang sudah disetel manual tidak tertimpa.
update public."Cafes"
set ai_credits_quota = case subscription_type
  when 'Tier 100k' then 15
  when 'Tier 150k' then 30
  else 5
end
where ai_credits_quota = 5
  and subscription_type in ('Tier 100k', 'Tier 150k');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'Cafes_ai_credits_nonnegative'
      and conrelid = 'public."Cafes"'::regclass
  ) then
    alter table public."Cafes"
      add constraint "Cafes_ai_credits_nonnegative"
      check (ai_credits_quota >= 0 and ai_credits_used >= 0);
  end if;
end $$;

/** Mengklaim satu credit AI untuk sebuah kafe.
 *
 *  Jendela kuota bergulir per bulan kalender: kalau ai_credits_period_start
 *  sudah lewat bulan berjalan, pemakaian direset lebih dulu. Reset dilakukan
 *  saat klaim (bukan lewat cron) supaya tidak ada jadwal terpisah yang bisa
 *  gagal diam-diam.
 *
 *  Gerbang bayar ikut ditegakkan di sini: kafe dengan status_lunas = false
 *  tidak bisa membakar biaya API sama sekali. */
create or replace function public.consume_ai_credit(
  p_cafe_id uuid,
  p_amount integer default 1
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quota integer;
  v_used integer;
  v_period date;
  v_lunas boolean;
  v_current_period date := date_trunc('month', now())::date;
begin
  if p_cafe_id is null or p_amount is null or p_amount < 1 or p_amount > 100 then
    return jsonb_build_object('error', 'invalid_request');
  end if;

  select ai_credits_quota, ai_credits_used, ai_credits_period_start, status_lunas
    into v_quota, v_used, v_period, v_lunas
  from public."Cafes"
  where id_cafe = p_cafe_id
  for update;

  if not found then
    return jsonb_build_object('error', 'cafe_not_found');
  end if;

  if coalesce(v_lunas, false) = false then
    return jsonb_build_object('error', 'subscription_inactive');
  end if;

  if v_period < v_current_period then
    v_used := 0;
    v_period := v_current_period;
  end if;

  if v_used + p_amount > v_quota then
    return jsonb_build_object(
      'error', 'quota_exceeded',
      'quota', v_quota,
      'used', v_used,
      'remaining', greatest(v_quota - v_used, 0)
    );
  end if;

  update public."Cafes"
  set ai_credits_used = v_used + p_amount,
      ai_credits_period_start = v_period
  where id_cafe = p_cafe_id;

  return jsonb_build_object(
    'ok', true,
    'quota', v_quota,
    'used', v_used + p_amount,
    'remaining', v_quota - v_used - p_amount
  );
end;
$$;

/** Mengembalikan credit saat panggilan API pihak ketiga gagal.
 *  Tanpa ini, kegagalan Tripo/Gemini tetap memakan jatah cafe. */
create or replace function public.refund_ai_credit(
  p_cafe_id uuid,
  p_amount integer default 1
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_cafe_id is null or p_amount is null or p_amount < 1 then
    return jsonb_build_object('error', 'invalid_request');
  end if;

  update public."Cafes"
  set ai_credits_used = greatest(ai_credits_used - p_amount, 0)
  where id_cafe = p_cafe_id;

  return jsonb_build_object('ok', true);
end;
$$;

/** Ringkasan kuota untuk ditampilkan di dashboard. Read-only, dan menerapkan
 *  reset bulanan secara virtual supaya angka yang tampil tidak basi sebelum
 *  klaim pertama di bulan baru. */
create or replace function public.get_ai_credit_status(p_cafe_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quota integer;
  v_used integer;
  v_period date;
  v_lunas boolean;
  v_current_period date := date_trunc('month', now())::date;
begin
  select ai_credits_quota, ai_credits_used, ai_credits_period_start, status_lunas
    into v_quota, v_used, v_period, v_lunas
  from public."Cafes"
  where id_cafe = p_cafe_id;

  if not found then
    return jsonb_build_object('error', 'cafe_not_found');
  end if;

  if v_period < v_current_period then
    v_used := 0;
  end if;

  return jsonb_build_object(
    'quota', v_quota,
    'used', v_used,
    'remaining', greatest(v_quota - v_used, 0),
    'periodStart', v_current_period,
    'subscriptionActive', coalesce(v_lunas, false)
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. Varian & add-on menu
-- ─────────────────────────────────────────────────────────────

create table if not exists public."Menu_Option_Groups" (
  id_option_group uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public."Cafes"(id_cafe) on delete cascade,
  menu_id uuid not null references public."Menus"(id_menu) on delete cascade,
  name text not null,
  min_select integer not null default 1,
  max_select integer not null default 1,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint "Menu_Option_Groups_select_range"
    check (min_select >= 0 and max_select >= 1 and min_select <= max_select and max_select <= 20)
);

create table if not exists public."Menu_Option_Values" (
  id_option_value uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public."Cafes"(id_cafe) on delete cascade,
  option_group_id uuid not null references public."Menu_Option_Groups"(id_option_group) on delete cascade,
  name text not null,
  price_delta integer not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Resep per pilihan varian. Tanpa tabel ini, "Large" dan "Small" memotong stok
-- dengan jumlah yang sama — potongan otomatis jadi salah begitu varian ada.
create table if not exists public."Menu_Option_Recipes" (
  id_option_recipe uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public."Cafes"(id_cafe) on delete cascade,
  option_value_id uuid not null references public."Menu_Option_Values"(id_option_value) on delete cascade,
  inventory_item_id uuid not null references public."Inventory_Items"(id_inventory_item) on delete cascade,
  qty_per_menu numeric(12,3) not null check (qty_per_menu > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (option_value_id, inventory_item_id)
);

create index if not exists "Menu_Option_Groups_menu_idx"
  on public."Menu_Option_Groups" (menu_id, sort_order);
create index if not exists "Menu_Option_Values_group_idx"
  on public."Menu_Option_Values" (option_group_id, sort_order);
create index if not exists "Menu_Option_Recipes_value_idx"
  on public."Menu_Option_Recipes" (option_value_id);

alter table public."Menu_Option_Groups" enable row level security;
alter table public."Menu_Option_Values" enable row level security;
alter table public."Menu_Option_Recipes" enable row level security;

revoke all on table
  public."Menu_Option_Groups",
  public."Menu_Option_Values",
  public."Menu_Option_Recipes"
from public, anon, authenticated;

/** Mengganti seluruh definisi varian sebuah menu dalam satu transaksi.
 *
 *  Mengikuti pola replace_menu_recipes: validasi penuh dulu, baru hapus-dan-tulis.
 *  Struktur p_groups:
 *    [{ name, min_select, max_select, values: [{ name, price_delta, is_active,
 *       recipes: [{ inventory_item_id, qty_per_menu }] }] }] */
create or replace function public.replace_menu_options(
  p_cafe_id uuid,
  p_menu_id uuid,
  p_groups jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group jsonb;
  v_value jsonb;
  v_recipe jsonb;
  v_group_id uuid;
  v_value_id uuid;
  v_group_idx integer := 0;
  v_value_idx integer := 0;
  v_min integer;
  v_max integer;
begin
  if p_cafe_id is null or p_menu_id is null then
    return jsonb_build_object('error', 'menu_not_found');
  end if;
  if p_groups is null or jsonb_typeof(p_groups) <> 'array' then
    return jsonb_build_object('error', 'invalid_options');
  end if;
  if jsonb_array_length(p_groups) > 10 then
    return jsonb_build_object('error', 'too_many_groups');
  end if;

  perform 1
  from public."Menus"
  where id_menu = p_menu_id
    and cafe_id = p_cafe_id
  for update;
  if not found then
    return jsonb_build_object('error', 'menu_not_found');
  end if;

  -- Cascade menghapus values dan recipes yang menempel.
  delete from public."Menu_Option_Groups"
  where menu_id = p_menu_id
    and cafe_id = p_cafe_id;

  for v_group in select * from jsonb_array_elements(p_groups)
  loop
    if jsonb_typeof(v_group) <> 'object'
      or jsonb_typeof(v_group->'name') <> 'string'
      or nullif(trim(v_group->>'name'), '') is null
      or jsonb_typeof(v_group->'values') <> 'array' then
      return jsonb_build_object('error', 'invalid_options');
    end if;

    if jsonb_array_length(v_group->'values') = 0
      or jsonb_array_length(v_group->'values') > 20 then
      return jsonb_build_object('error', 'invalid_options');
    end if;

    v_min := coalesce((v_group->>'min_select')::integer, 1);
    v_max := coalesce((v_group->>'max_select')::integer, 1);
    if v_min < 0 or v_max < 1 or v_min > v_max or v_max > 20 then
      return jsonb_build_object('error', 'invalid_options');
    end if;
    if v_max > jsonb_array_length(v_group->'values') then
      v_max := jsonb_array_length(v_group->'values');
    end if;

    insert into public."Menu_Option_Groups" (
      cafe_id, menu_id, name, min_select, max_select, sort_order
    ) values (
      p_cafe_id,
      p_menu_id,
      left(trim(v_group->>'name'), 60),
      v_min,
      v_max,
      v_group_idx
    )
    returning id_option_group into v_group_id;

    v_value_idx := 0;
    for v_value in select * from jsonb_array_elements(v_group->'values')
    loop
      if jsonb_typeof(v_value) <> 'object'
        or jsonb_typeof(v_value->'name') <> 'string'
        or nullif(trim(v_value->>'name'), '') is null then
        return jsonb_build_object('error', 'invalid_options');
      end if;

      insert into public."Menu_Option_Values" (
        cafe_id, option_group_id, name, price_delta, is_active, sort_order
      ) values (
        p_cafe_id,
        v_group_id,
        left(trim(v_value->>'name'), 60),
        coalesce((v_value->>'price_delta')::integer, 0),
        coalesce((v_value->>'is_active')::boolean, true),
        v_value_idx
      )
      returning id_option_value into v_value_id;

      if jsonb_typeof(v_value->'recipes') = 'array' then
        for v_recipe in select * from jsonb_array_elements(v_value->'recipes')
        loop
          if jsonb_typeof(v_recipe) <> 'object'
            or jsonb_typeof(v_recipe->'inventory_item_id') <> 'string'
            or (v_recipe->>'inventory_item_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            or jsonb_typeof(v_recipe->'qty_per_menu') <> 'number'
            or (v_recipe->>'qty_per_menu')::numeric <= 0 then
            return jsonb_build_object('error', 'invalid_option_recipe');
          end if;

          if not exists (
            select 1 from public."Inventory_Items"
            where id_inventory_item = (v_recipe->>'inventory_item_id')::uuid
              and cafe_id = p_cafe_id
          ) then
            return jsonb_build_object('error', 'inventory_item_not_found');
          end if;

          insert into public."Menu_Option_Recipes" (
            cafe_id, option_value_id, inventory_item_id, qty_per_menu
          ) values (
            p_cafe_id,
            v_value_id,
            (v_recipe->>'inventory_item_id')::uuid,
            (v_recipe->>'qty_per_menu')::numeric
          )
          on conflict (option_value_id, inventory_item_id) do update
            set qty_per_menu = excluded.qty_per_menu,
                updated_at = now();
        end loop;
      end if;

      v_value_idx := v_value_idx + 1;
    end loop;

    v_group_idx := v_group_idx + 1;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. Pembuatan pesanan — sadar varian
-- ─────────────────────────────────────────────────────────────

/** Versi baru: tiap baris keranjang boleh membawa `options` berisi daftar
 *  id_option_value. Dua baris menu yang sama dengan varian berbeda dihitung
 *  sebagai baris terpisah, dan potongan stok menjumlahkan resep menu + resep
 *  tiap varian yang dipilih.
 *
 *  Bentuk p_items: [{ id_menu: uuid, qty: int, options?: [uuid, ...] }] */
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
  having count(lo.id_option_value) < og.min_select
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

-- ─────────────────────────────────────────────────────────────
-- 4. Status pesanan sisi pelanggan
-- ─────────────────────────────────────────────────────────────

/** Membaca pesanan memakai customer_token sebagai kredensial.
 *
 *  Ini menggantikan localStorage sebagai sumber kebenaran: pesanan tetap bisa
 *  dibuka setelah cache dibersihkan, di perangkat lain, atau di tab incognito,
 *  selama tautannya membawa token. */
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
         o.payment_method, o.payment_status, o.notes, o.created_at
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
      'created_at', v_order.created_at
    ),
    'reviewUrl', v_cafe.google_maps_review_url
  );
end;
$$;

/** Mencatat pilihan bayar tunai ke database.
 *
 *  Hanya menyetel metode, bukan status lunas — pelanggan tidak boleh menyatakan
 *  dirinya sudah bayar. Kasir yang menandai lunas lewat mark_order_cash_paid. */
create or replace function public.set_order_payment_method(
  p_order_id text,
  p_token uuid,
  p_method text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if p_order_id is null or p_token is null or p_method is null then
    return jsonb_build_object('error', 'order_not_found');
  end if;

  -- QRIS diatur oleh alur charge/webhook Midtrans, bukan lewat fungsi ini.
  if p_method <> 'cash' then
    return jsonb_build_object('error', 'invalid_method');
  end if;

  select payment_status
    into v_status
  from public."Orders"
  where id_order = p_order_id
    and customer_token = p_token
  for update;

  if not found then
    return jsonb_build_object('error', 'order_not_found');
  end if;

  if v_status <> 'unpaid' then
    return jsonb_build_object('error', 'payment_locked');
  end if;

  update public."Orders"
  set payment_method = 'cash'
  where id_order = p_order_id
    and customer_token = p_token
    and payment_status = 'unpaid';

  return jsonb_build_object('ok', true);
end;
$$;

/** Kasir menandai pesanan tunai sudah dibayar. Dibatasi ke kafe pemilik dan ke
 *  pesanan tunai — pesanan QRIS hanya boleh dilunasi oleh webhook Midtrans. */
create or replace function public.mark_order_cash_paid(
  p_cafe_id uuid,
  p_order_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_method text;
  v_status text;
begin
  if p_cafe_id is null or p_order_id is null then
    return jsonb_build_object('error', 'order_not_found');
  end if;

  select payment_method, payment_status
    into v_method, v_status
  from public."Orders"
  where id_order = p_order_id
    and cafe_id = p_cafe_id
  for update;

  if not found then
    return jsonb_build_object('error', 'order_not_found');
  end if;

  if v_status = 'paid' then
    return jsonb_build_object('ok', true, 'alreadyPaid', true);
  end if;

  if v_method = 'qris' then
    return jsonb_build_object('error', 'qris_settled_by_webhook');
  end if;

  update public."Orders"
  set payment_status = 'paid',
      payment_method = 'cash'
  where id_order = p_order_id
    and cafe_id = p_cafe_id
    and payment_status <> 'paid';

  return jsonb_build_object('ok', true);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. Hak akses
-- ─────────────────────────────────────────────────────────────

revoke all on function public.consume_ai_credit(uuid, integer) from public, anon, authenticated;
revoke all on function public.refund_ai_credit(uuid, integer) from public, anon, authenticated;
revoke all on function public.get_ai_credit_status(uuid) from public, anon, authenticated;
revoke all on function public.replace_menu_options(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.get_order_for_customer(text, uuid) from public, anon, authenticated;
revoke all on function public.set_order_payment_method(text, uuid, text) from public, anon, authenticated;
revoke all on function public.mark_order_cash_paid(uuid, text) from public, anon, authenticated;

grant execute on function public.consume_ai_credit(uuid, integer) to service_role;
grant execute on function public.refund_ai_credit(uuid, integer) to service_role;
grant execute on function public.get_ai_credit_status(uuid) to service_role;
grant execute on function public.replace_menu_options(uuid, uuid, jsonb) to service_role;
grant execute on function public.get_order_for_customer(text, uuid) to service_role;
grant execute on function public.set_order_payment_method(text, uuid, text) to service_role;
grant execute on function public.mark_order_cash_paid(uuid, text) to service_role;

commit;
