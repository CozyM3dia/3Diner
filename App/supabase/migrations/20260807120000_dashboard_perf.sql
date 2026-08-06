-- 3Diner — optimisasi backend dashboard.
--
-- Menutup tiga titik lambat yang ditemukan saat audit backend:
--
--   1. Indeks komposit Orders(cafe_id, created_at desc) — tidak ada indeks yang
--      melayani kueri riwayat yang memfilter cafe_id lalu mengurutkan created_at.
--      Semua layar pesanan/report (getOrdersPage, getRevenueData, getHomeData,
--      getSalesExport, getReportPage) mejadi seq-scan + sort tanpa indeks ini.
--      (Orders_cafe_open_idx hanya parsial untuk status berjalan.)
--
--   2. Indeks Inventory_Items(cafe_id) dan Menu_Recipes(cafe_id) — dua tabel ini
--      selalu difilter per cafe di dashboard stok dan di create_order RPC.
--
--   3. RPC reorder_menus — reorder sebelumnya menerbitkan N UPDATE terpisah lewat
--      Promise.all (N roundtrip, tidak atomik). RPC ini atomik: satu statement,
--      satu roundtrip, dan tidak bisa mengubah sort_order menu milik kafe lain.
--
--   4. prune_rate_limits dijadwalkan lewat pg_cron — tabel penghitung rate limit
--      tidak boleh tumbuh tanpa batas. Idempoten seperti migrasi retention.
--
-- Aman diulang. Semua langkah idempoten.

begin;

-- ─────────────────────────────────────────────────────────────
-- 1. Indeks untuk kueri dashboard
-- ─────────────────────────────────────────────────────────────

create index if not exists "Orders_cafe_id_created_at_idx"
  on public."Orders" (cafe_id, created_at desc);

create index if not exists "Inventory_Items_cafe_id_idx"
  on public."Inventory_Items" (cafe_id);

create index if not exists "Menu_Recipes_cafe_id_idx"
  on public."Menu_Recipes" (cafe_id);

-- ─────────────────────────────────────────────────────────────
-- 2. RPC reorder menu yang atomik
-- ─────────────────────────────────────────────────────────────

/** Menulis ulang sort_order untuk daftar id menu dalam satu transaksi.
 *
 *  Menggantikan N update individual dari server action. Atomik, satu roundtrip,
 *  dan cuma menyentuh baris milik p_cafe_id — id asing diam-diam dilewati.
 */
create or replace function public.reorder_menus(
  p_cafe_id uuid,
  p_menu_ids uuid[]
) returns void
language sql
security definer
set search_path = public
as $$
  update public."Menus" m
  set sort_order = o.ord
  from unnest(p_menu_ids) with ordinality as o(id, ord)
  where m.id_menu = o.id
    and m.cafe_id = p_cafe_id;
$$;

revoke all on function public.reorder_menus(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_menus(uuid, uuid[]) to service_role;

-- ─────────────────────────────────────────────────────────────
-- 3. Pemangkasan tabel rate limit terjadwal
-- ─────────────────────────────────────────────────────────────

-- Pola sama dengan migrasi retention: pg_cron wajib aktif (Supabase Dashboard →
-- Database → Extensions → pg_cron).
create extension if not exists pg_cron;

select cron.unschedule('prune-rate-limits')
where exists (select 1 from cron.job where jobname = 'prune-rate-limits');

select cron.schedule(
  'prune-rate-limits',
  '0 4 * * *',
  $$ select public.prune_rate_limits(86400); $$
);

commit;