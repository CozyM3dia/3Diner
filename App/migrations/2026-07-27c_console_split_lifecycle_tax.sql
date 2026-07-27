-- 3Diner — fondasi skema untuk dua konsol (Kasir & Owner).
--
-- Menutup empat lubang yang dicatat wireframe v3 sebagai pemblokir, plus tabel
-- Staff yang memisahkan kedua konsol. Digabung dalam satu migrasi karena
-- create_order_with_inventory harus ditulis ulang untuk catatan per item dan
-- untuk pajak — menulis ulangnya dua kali di dua migrasi lebih berisiko
-- daripada sekali.
--
--   1. Staff + peran            -> menentukan login dibawa ke /kasir atau /dashboard
--   2. Siklus hidup pesanan     -> status terminal 'completed' + 'cancelled'
--   3. Pembatalan               -> mengembalikan stok, alasan wajib, berjejak
--   4. Pajak & service charge   -> tarif di kafe, nilainya dipotret di pesanan
--   5. Catatan per item         -> "tanpa gula" tidak lagi menempel ke pesanan
--
-- Aman diulang. Semua langkah idempoten.

begin;

-- ─────────────────────────────────────────────────────────────
-- 1. Staff & peran
-- ─────────────────────────────────────────────────────────────

-- Hari ini kepemilikan kafe hanya lewat Cafes.owner_id — satu orang, satu peran,
-- tidak ada gagasan "kasir". Dua konsol terpisah butuh jawaban atas pertanyaan
-- "orang ini dibawa ke mana setelah login", dan itu tidak bisa dijawab kolom itu.

create table if not exists public."Staff" (
  id_staff uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public."Cafes" (id_cafe) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('owner', 'cashier')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (cafe_id, user_id)
);

-- Satu orang hanya melayani satu kafe untuk sekarang (K6: satu outlet). Unique
-- di user_id menegakkan itu di database, bukan cuma di UI — dan kalau nanti
-- multi-outlet dibuka, yang dilepas cukup indeks ini.
create unique index if not exists "Staff_user_single_cafe_idx"
  on public."Staff" (user_id);

create index if not exists "Staff_cafe_role_idx"
  on public."Staff" (cafe_id, role) where is_active;

alter table public."Staff" enable row level security;

-- Pemilik yang sudah ada jadi baris Staff berperan owner. Tanpa backfill ini,
-- pemilik yang login besok pagi tidak punya peran dan tidak dibawa ke mana pun.
insert into public."Staff" (cafe_id, user_id, full_name, role)
select
  c.id_cafe,
  c.owner_id,
  coalesce(nullif(trim(c.nama_cafe), ''), 'Pemilik'),
  'owner'
from public."Cafes" c
where c.owner_id is not null
on conflict (cafe_id, user_id) do nothing;

/** Peran dan kafe untuk satu user auth.
 *
 *  Dipakai tepat setelah login untuk memutuskan tujuan: 'owner' ke /dashboard,
 *  'cashier' ke /kasir. Mengembalikan null-role kalau user tidak terdaftar di
 *  kafe mana pun, supaya pemanggil bisa membedakan "bukan staf" dari "gagal". */
create or replace function public.get_staff_context(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'cafe_id', s.cafe_id,
        'cafe_name', c.nama_cafe,
        'cafe_slug', c.slug_url,
        'user_id', s.user_id,
        'full_name', s.full_name,
        'role', s.role,
        'is_active', s.is_active
      )
      from public."Staff" s
      join public."Cafes" c on c.id_cafe = s.cafe_id
      where s.user_id = p_user_id
        and s.is_active
      limit 1
    ),
    jsonb_build_object('role', null)
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. Siklus hidup pesanan
-- ─────────────────────────────────────────────────────────────

-- Sebelum ini 'ready' adalah akhir: pesanan selesai tidak pernah keluar dari
-- daftar, jadi antrean tidak akan pernah bisa nol. Antrean yang tidak bisa
-- dikosongkan mengajari mata bahwa memindai daftar tidak mengubah apa pun —
-- lalu pemindaian berhenti dan daftar jadi wallpaper. Seluruh konsep Konsol
-- Kasir bergantung pada adanya status terminal.

alter table public."Orders"
  add column if not exists completed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_reason text,
  add column if not exists cancelled_by uuid references auth.users (id) on delete set null;

-- Semua baris 'ready' yang ada memang sudah selesai — UI lama tidak punya
-- langkah setelahnya, jadi 'ready' di data lama berarti terminal. Memindahkannya
-- ke 'completed' mempertahankan artinya, bukan mengubahnya.
update public."Orders"
set status = 'completed',
    completed_at = coalesce(completed_at, created_at)
where status = 'ready';

-- 'ready' tetap sah ke depan: K1 menyimpannya sebagai tahap opsional untuk kafe
-- yang punya runner terpisah. Yang tidak dibangun adalah UI-nya, bukan statusnya.
-- Constraint lama dicari lewat kolom yang dirujuknya, bukan lewat pencocokan
-- teks: pola '%status%' juga cocok dengan payment_status, dan menjatuhkan
-- constraint itu akan membuka lubang tanpa ada yang menyadarinya. Semua
-- constraint yang menyentuh kolom status ditinjau, bukan hanya yang pertama.
do $$
declare
  v_attnum smallint;
  v_con record;
begin
  select attnum into v_attnum
  from pg_attribute
  where attrelid = 'public."Orders"'::regclass
    and attname = 'status'
    and not attisdropped;

  for v_con in
    select conname
    from pg_constraint
    where conrelid = 'public."Orders"'::regclass
      and contype = 'c'
      and conkey = array[v_attnum]::smallint[]
  loop
    execute format('alter table public."Orders" drop constraint %I', v_con.conname);
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conname = 'Orders_status_valid'
      and conrelid = 'public."Orders"'::regclass
  ) then
    alter table public."Orders"
      add constraint "Orders_status_valid"
      check (status in ('received', 'preparing', 'ready', 'completed', 'cancelled'));
  end if;
end $$;

-- Pembatalan tanpa alasan tidak bisa diaudit, dan selisih kas yang tidak bisa
-- ditelusuri adalah lubang paling klasik di kafe. Ditegakkan di database supaya
-- rute mana pun yang menulis tetap terikat.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'Orders_cancel_requires_reason'
      and conrelid = 'public."Orders"'::regclass
  ) then
    alter table public."Orders"
      add constraint "Orders_cancel_requires_reason"
      check (
        status <> 'cancelled'
        or (cancelled_at is not null and nullif(trim(cancelled_reason), '') is not null)
      );
  end if;
end $$;

create index if not exists "Orders_cafe_open_idx"
  on public."Orders" (cafe_id, created_at desc)
  where status in ('received', 'preparing', 'ready');

-- ─────────────────────────────────────────────────────────────
-- 3. Pajak & service charge
-- ─────────────────────────────────────────────────────────────

-- Struk hari ini mencetak "Pajak & Layanan Rp0" yang di-hardcode, pada transaksi
-- yang terutang PBJT 10% (Perda Bandar Lampung 1/2024 Ps.27 ayat 1). Itu cacat
-- produksi, bukan fitur yang belum ada.
--
-- tax_configured_at null = pemilik belum pernah memutuskan. Nol yang dipilih dan
-- nol yang kebetulan harus bisa dibedakan; hanya yang pertama boleh dicetak diam.

alter table public."Cafes"
  add column if not exists tax_rate_pct numeric(5,2) not null default 0,
  add column if not exists service_charge_pct numeric(5,2) not null default 0,
  add column if not exists prices_include_tax boolean not null default false,
  add column if not exists tax_configured_at timestamptz,
  add column if not exists tax_pending_rate_pct numeric(5,2),
  add column if not exists tax_pending_service_pct numeric(5,2),
  add column if not exists tax_pending_include boolean,
  add column if not exists tax_pending_from date;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'Cafes_tax_rate_sane'
      and conrelid = 'public."Cafes"'::regclass
  ) then
    alter table public."Cafes"
      add constraint "Cafes_tax_rate_sane"
      check (
        tax_rate_pct >= 0 and tax_rate_pct <= 100
        and service_charge_pct >= 0 and service_charge_pct <= 100
        and (tax_pending_rate_pct is null or (tax_pending_rate_pct >= 0 and tax_pending_rate_pct <= 100))
        and (tax_pending_service_pct is null or (tax_pending_service_pct >= 0 and tax_pending_service_pct <= 100))
      );
  end if;
end $$;

-- Pesanan memotret tarifnya sendiri. Tanpa potret, mengubah tarif akan menulis
-- ulang sejarah: laporan bulan lalu ikut berubah dan tidak bisa direkonsiliasi.
alter table public."Orders"
  add column if not exists subtotal integer not null default 0,
  add column if not exists tax_pct numeric(5,2) not null default 0,
  add column if not exists tax_amount integer not null default 0,
  add column if not exists service_pct numeric(5,2) not null default 0,
  add column if not exists service_amount integer not null default 0,
  add column if not exists prices_include_tax boolean not null default false;

-- Pesanan lama tidak pernah kena pajak, jadi subtotal = total apa adanya.
update public."Orders"
set subtotal = total
where subtotal = 0 and total > 0;

/** Tarif yang berlaku untuk sebuah kafe hari ini.
 *
 *  Perubahan tarif dijadwalkan, tidak berlaku seketika: dua pesanan di hari yang
 *  sama tidak boleh punya perhitungan berbeda, karena laporan hari itu jadi tidak
 *  bisa direkonsiliasi. Tarif tertunda dipromosikan saat dibaca — bukan lewat
 *  cron — mengikuti pola yang sama dengan reset kuota di consume_ai_credit,
 *  supaya tidak ada jadwal terpisah yang bisa gagal diam-diam. */
create or replace function public.effective_tax_settings(p_cafe_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select case
    when c.tax_pending_from is not null and current_date >= c.tax_pending_from then
      jsonb_build_object(
        'tax_pct', coalesce(c.tax_pending_rate_pct, c.tax_rate_pct),
        'service_pct', coalesce(c.tax_pending_service_pct, c.service_charge_pct),
        'include', coalesce(c.tax_pending_include, c.prices_include_tax),
        'configured', c.tax_configured_at is not null
      )
    else
      jsonb_build_object(
        'tax_pct', c.tax_rate_pct,
        'service_pct', c.service_charge_pct,
        'include', c.prices_include_tax,
        'configured', c.tax_configured_at is not null
      )
  end
  from public."Cafes" c
  where c.id_cafe = p_cafe_id;
$$;

/** Menyetel pajak, berlaku mulai tanggal yang diminta.
 *
 *  p_effective_from default besok. Menyetel untuk hari ini diizinkan hanya kalau
 *  kafe belum pernah mengonfigurasi apa pun — kafe baru harus bisa langsung
 *  benar tanpa menunggu semalam. */
create or replace function public.set_cafe_tax(
  p_cafe_id uuid,
  p_tax_pct numeric,
  p_service_pct numeric,
  p_include boolean default false,
  p_effective_from date default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_configured boolean;
  v_from date;
begin
  select tax_configured_at is not null into v_configured
  from public."Cafes" where id_cafe = p_cafe_id;

  if v_configured is null then
    raise exception 'cafe_not_found' using errcode = 'P0002';
  end if;

  if p_tax_pct is null or p_service_pct is null
     or p_tax_pct < 0 or p_tax_pct > 100
     or p_service_pct < 0 or p_service_pct > 100 then
    raise exception 'invalid_tax_rate' using errcode = '22023';
  end if;

  v_from := coalesce(p_effective_from, (current_date + 1));

  if not v_configured then
    -- Konfigurasi pertama berlaku seketika; belum ada pesanan hari ini yang
    -- dihitung dengan aturan lain, jadi tidak ada yang bisa jadi tidak konsisten.
    update public."Cafes"
    set tax_rate_pct = p_tax_pct,
        service_charge_pct = p_service_pct,
        prices_include_tax = coalesce(p_include, false),
        tax_configured_at = now(),
        tax_pending_rate_pct = null,
        tax_pending_service_pct = null,
        tax_pending_include = null,
        tax_pending_from = null
    where id_cafe = p_cafe_id;

    return jsonb_build_object('applied', 'immediately', 'tax_pct', p_tax_pct);
  end if;

  update public."Cafes"
  set tax_pending_rate_pct = p_tax_pct,
      tax_pending_service_pct = p_service_pct,
      tax_pending_include = coalesce(p_include, false),
      tax_pending_from = v_from
  where id_cafe = p_cafe_id;

  return jsonb_build_object('applied', 'scheduled', 'effective_from', v_from, 'tax_pct', p_tax_pct);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. Pembatalan yang mengembalikan stok
-- ─────────────────────────────────────────────────────────────

-- Membatalkan tanpa mengembalikan stok merusak inventory diam-diam: bahan
-- tercatat terpakai untuk pesanan yang tidak pernah jadi. Pengembalian dihitung
-- dari mutasi yang tercatat untuk pesanan itu, bukan dari resep — jadi varian,
-- resep yang berubah setelah pesanan masuk, dan penyesuaian manual semuanya ikut
-- benar tanpa perlu menghitung ulang.

do $$
declare
  v_attnum smallint;
  v_con record;
begin
  select attnum into v_attnum
  from pg_attribute
  where attrelid = 'public."Inventory_Movements"'::regclass
    and attname = 'movement_type'
    and not attisdropped;

  for v_con in
    select conname
    from pg_constraint
    where conrelid = 'public."Inventory_Movements"'::regclass
      and contype = 'c'
      and conkey = array[v_attnum]::smallint[]
  loop
    execute format('alter table public."Inventory_Movements" drop constraint %I', v_con.conname);
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conname = 'Inventory_Movements_type_valid'
      and conrelid = 'public."Inventory_Movements"'::regclass
  ) then
    alter table public."Inventory_Movements"
      add constraint "Inventory_Movements_type_valid"
      check (movement_type in (
        'manual_add', 'manual_subtract', 'manual_set',
        'order_deduction', 'order_cancellation'
      ));
  end if;
end $$;

/** Membatalkan pesanan dan mengembalikan bahannya.
 *
 *  Alasan wajib. Pembatalan ganda tidak menambah stok dua kali: pengembalian
 *  hanya dilakukan kalau belum ada mutasi 'order_cancellation' untuk pesanan itu. */
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
  v_now timestamptz := now();
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 300), '');
  v_restored integer := 0;
begin
  if v_reason is null then
    raise exception 'cancel_reason_required' using errcode = '22023';
  end if;

  select status into v_status
  from public."Orders"
  where id_order = p_order_id and cafe_id = p_cafe_id
  for update;

  if v_status is null then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  if v_status = 'cancelled' then
    return jsonb_build_object('status', 'cancelled', 'already', true);
  end if;

  if v_status = 'completed' then
    -- Pesanan yang sudah diserahkan tidak dibatalkan, dikembalikan (refund).
    -- Alurnya berbeda dan belum dibangun; menolaknya di sini lebih jujur
    -- daripada diam-diam mengembalikan stok makanan yang sudah dimakan.
    raise exception 'order_already_completed' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public."Inventory_Movements"
    where reference_type = 'order'
      and reference_id = p_order_id
      and movement_type = 'order_cancellation'
  ) then
    with deducted as (
      select
        im.inventory_item_id,
        sum(-im.delta_qty)::numeric(12,3) as qty
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
      select
        ii.cafe_id, ii.id_inventory_item, 'order_cancellation', d.qty,
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

/** Memajukan status pesanan, dengan transisi yang sah ditegakkan di server.
 *
 *  UI kasir hanya punya dua ketukan (Terima, lalu Selesai), tapi 'ready' tetap
 *  sah untuk kafe ber-runner. Yang dilarang adalah mundur dan menyentuh pesanan
 *  yang sudah terminal. */
create or replace function public.advance_order_status(
  p_cafe_id uuid,
  p_order_id text,
  p_next text,
  p_actor uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_now timestamptz := now();
begin
  if p_next not in ('preparing', 'ready', 'completed') then
    raise exception 'invalid_status_transition' using errcode = '22023';
  end if;

  select status into v_status
  from public."Orders"
  where id_order = p_order_id and cafe_id = p_cafe_id
  for update;

  if v_status is null then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  if v_status in ('completed', 'cancelled') then
    raise exception 'order_already_final' using errcode = 'P0001';
  end if;

  if not (
    (v_status = 'received'  and p_next in ('preparing', 'completed'))
    or (v_status = 'preparing' and p_next in ('ready', 'completed'))
    or (v_status = 'ready'     and p_next = 'completed')
  ) then
    raise exception 'invalid_status_transition' using errcode = '22023';
  end if;

  update public."Orders"
  set status = p_next,
      completed_at = case when p_next = 'completed' then v_now else completed_at end
  where id_order = p_order_id and cafe_id = p_cafe_id;

  return jsonb_build_object('status', p_next, 'actor', p_actor, 'at', v_now);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. Catatan per item + pajak saat pesanan dibuat
-- ─────────────────────────────────────────────────────────────

-- Sebelum ini catatan hanya ada di level pesanan, jadi "burger tanpa cabai tapi
-- kentang extra pedas" tidak bisa diungkapkan sama sekali.
--
-- Konsekuensi yang tidak kelihatan: kunci baris harus ikut memuat catatan.
-- Tanpa itu, "Kopi tanpa gula" dan "Kopi biasa" digabung jadi satu baris qty 2
-- dengan satu catatan — dan salah satu tamu menerima minuman yang salah.

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
  v_subtotal integer := 0;
  v_tax_amount integer := 0;
  v_service_amount integer := 0;
  v_total integer := 0;
  v_order_items jsonb;
  v_unavailable text[];
  v_now timestamptz := now();
  v_bad_group text;
  v_unavailable_options text[];
  v_tax jsonb;
  v_tax_pct numeric(5,2);
  v_service_pct numeric(5,2);
  v_include boolean;
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
      or (item ? 'notes' and jsonb_typeof(item->'notes') not in ('string', 'null'))
  ) then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  if exists (
    select 1
    from tmp_raw_requested_items r
    cross join lateral jsonb_array_elements(coalesce(r.item->'options', '[]'::jsonb)) as opt
    where jsonb_typeof(opt) <> 'string'
      or (opt #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) then
    raise exception 'invalid_order_items' using errcode = '22023';
  end if;

  create temporary table tmp_requested_lines (
    line_key text primary key,
    id_menu uuid not null,
    option_ids uuid[] not null,
    item_notes text,
    qty integer not null
  ) on commit drop;

  insert into tmp_requested_lines (line_key, id_menu, option_ids, item_notes, qty)
  select
    -- Catatan ikut jadi bagian kunci, dan ditaruh paling belakang supaya tanda
    -- baca di dalamnya tidak bisa menabrak batas ruas. Bentuk ini harus tetap
    -- sama persis dengan cartLineKey() di src/types/index.ts.
    normalized.id_menu::text
      || ':' || array_to_string(normalized.option_ids, ',')
      || ':' || coalesce(normalized.item_notes, ''),
    normalized.id_menu,
    normalized.option_ids,
    normalized.item_notes,
    sum(normalized.qty)::integer
  from (
    select
      (r.item->>'id_menu')::uuid as id_menu,
      coalesce((
        select array_agg(distinct (opt #>> '{}')::uuid order by (opt #>> '{}')::uuid)
        from jsonb_array_elements(coalesce(r.item->'options', '[]'::jsonb)) as opt
      ), array[]::uuid[]) as option_ids,
      nullif(left(trim(coalesce(r.item->>'notes', '')), 140), '') as item_notes,
      (r.item->>'qty')::integer as qty
    from tmp_raw_requested_items r
  ) normalized
  group by normalized.id_menu, normalized.option_ids, normalized.item_notes;

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

  if (select count(*) from tmp_line_options)
     <> (select coalesce(sum(cardinality(option_ids)), 0) from tmp_requested_lines) then
    raise exception 'menu_unavailable' using errcode = 'P0001';
  end if;

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
    l.item_notes,
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
      'options', options,
      'notes', item_notes
    )
    order by nama_menu, line_key
  )
    into v_order_items
  from tmp_canonical_lines;

  select coalesce(sum(harga_menu * qty), 0)::integer
    into v_subtotal
  from tmp_canonical_lines;

  -- Pajak dipotret di sini. Kalau harga menu sudah termasuk pajak, pajaknya
  -- diekstrak dari subtotal dan total tidak berubah — kalau belum, ditambahkan.
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

  insert into public."Orders" (
    id_order, cafe_id, table_number, items,
    subtotal, tax_pct, tax_amount, service_pct, service_amount, prices_include_tax,
    total, status, payment_method, payment_status, notes, customer_token, created_at
  ) values (
    v_order_id,
    p_cafe_id,
    left(trim(p_table_number), 30),
    v_order_items,
    v_subtotal, v_tax_pct, v_tax_amount, v_service_pct, v_service_amount, v_include,
    v_total,
    'received',
    null,
    'unpaid',
    nullif(left(coalesce(trim(p_notes), ''), 500), ''),
    v_customer_token,
    v_now
  );

  insert into public."Inventory_Movements" (
    cafe_id, inventory_item_id, movement_type, delta_qty,
    qty_before, qty_after, unit, unit_cost,
    reference_type, reference_id, note, created_at
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
      'subtotal', v_subtotal,
      'tax_pct', v_tax_pct,
      'tax_amount', v_tax_amount,
      'service_pct', v_service_pct,
      'service_amount', v_service_amount,
      'prices_include_tax', v_include,
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
-- 6. Hak akses
-- ─────────────────────────────────────────────────────────────

-- Pola yang sama dengan migrasi sebelumnya: tidak ada satu pun fungsi ini yang
-- boleh dipanggil langsung dari browser. Semua lewat server dengan service role,
-- yang sudah lebih dulu memverifikasi sesi dan kepemilikan kafe.

revoke all on function public.get_staff_context(uuid) from public, anon, authenticated;
revoke all on function public.effective_tax_settings(uuid) from public, anon, authenticated;
revoke all on function public.set_cafe_tax(uuid, numeric, numeric, boolean, date) from public, anon, authenticated;
revoke all on function public.cancel_order(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.advance_order_status(uuid, text, text, uuid) from public, anon, authenticated;

grant execute on function public.get_staff_context(uuid) to service_role;
grant execute on function public.effective_tax_settings(uuid) to service_role;
grant execute on function public.set_cafe_tax(uuid, numeric, numeric, boolean, date) to service_role;
grant execute on function public.cancel_order(uuid, text, text, uuid) to service_role;
grant execute on function public.advance_order_status(uuid, text, text, uuid) to service_role;

commit;
