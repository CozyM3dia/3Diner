-- 3Diner — agregasi analitik & angka beranda dipindah ke Postgres, plus
-- pembenahan index.
--
-- Masalah yang diperbaiki:
-- 1. getReportPage menarik sampai EVENT_ROW_CAP (5000) timestamp click_menu ke
--    Node hanya untuk mem-bucket grafik harian — sementara funnel counts
--    dihitung exact. Grafik jadi dibangun dari cuplikan yang bisa berbeda
--    dengan funnel di atasnya, dan transfernya tumbuh seiring trafik tamu.
-- 2. getHomeData menarik SEMUA baris Orders hari ini + minggu lalu (unbounded)
--    lalu menjumlahkannya di Node; padahal pola RPC agregasi sudah ada.
-- 3. Analytics_Logs ditanya (cafe_id, event_type, created_at) di banyak tempat
--    tapi tidak ada index gabungannya — tabel ini tumbuh setiap menu dibuka.
-- 4. "Orders_cafe_id_created_at_idx" duplikat persis dengan orders_cafe_created_idx
--    (write amplification pada setiap insert/update pesanan).
-- 5. Stok: mencari movement manual terbaru harus memindai semua order_deduction
--    karena tidak ada index parsial.

begin;

-- ── 1 & 2. Satu roundtrip untuk corong + deret harian klik menu ─────────────

create or replace function public.analytics_event_summary(
  p_cafe_id uuid,
  p_start timestamptz default null,
  p_end timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_open integer;
  v_view3d integer;
  v_order integer;
  v_daily jsonb;
begin
  select count(*) filter (where event_type = 'click_menu'),
         count(*) filter (where event_type = 'view_3d'),
         count(*) filter (where event_type = 'click_order')
    into v_open, v_view3d, v_order
  from "Analytics_Logs"
  where cafe_id = p_cafe_id
    and (p_start is null or created_at >= p_start)
    and (p_end is null or created_at <= p_end);

  -- Deret harian digrouping di Postgres (WIB): <=90 baris kembali ke Node,
  -- bukan ribuan timestamp — dan cacahnya exact, konsisten dengan funnel.
  select jsonb_agg(jsonb_build_object('day', d, 'value', v) order by d)
    into v_daily
  from (
    select ((created_at AT TIME ZONE 'Asia/Jakarta')::date)::text d, count(*) v
    from "Analytics_Logs"
    where cafe_id = p_cafe_id
      and event_type = 'click_menu'
      and (p_start is null or created_at >= p_start)
      and (p_end is null or created_at <= p_end)
    group by ((created_at AT TIME ZONE 'Asia/Jakarta')::date)::text
  ) t;

  return jsonb_build_object(
    'open', coalesce(v_open, 0),
    'view3d', coalesce(v_view3d, 0),
    'order', coalesce(v_order, 0),
    'open_daily', coalesce(v_daily, '[]'::jsonb)
  );
end;
$$;

-- ── Angka beranda: 5 query → 1 roundtrip ────────────────────────────────────

create or replace function public.home_figures(
  p_cafe_id uuid,
  p_today_start timestamptz,
  p_compare_start timestamptz,
  p_compare_end timestamptz
) returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'today_paid_revenue', coalesce((
      select sum(total) from "Orders"
      where cafe_id = p_cafe_id and payment_status = 'paid' and created_at >= p_today_start
    ), 0),
    'today_completed', (
      select count(*) from "Orders"
      where cafe_id = p_cafe_id and status = 'completed' and created_at >= p_today_start
    ),
    'compare_paid_revenue', coalesce((
      select sum(total) from "Orders"
      where cafe_id = p_cafe_id and payment_status = 'paid'
        and created_at >= p_compare_start and created_at < p_compare_end
    ), 0),
    'compare_completed', (
      select count(*) from "Orders"
      where cafe_id = p_cafe_id and status = 'completed'
        and created_at >= p_compare_start and created_at < p_compare_end
    ),
    'views_today', (
      select count(*) from "Analytics_Logs"
      where cafe_id = p_cafe_id and event_type = 'click_menu' and created_at >= p_today_start
    ),
    'views_compare', (
      select count(*) from "Analytics_Logs"
      where cafe_id = p_cafe_id and event_type = 'click_menu'
        and created_at >= p_compare_start and created_at < p_compare_end
    ),
    'ever_orders', (
      select count(*) from "Orders" where cafe_id = p_cafe_id
    )
  );
$$;

revoke all on function public.analytics_event_summary(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.analytics_event_summary(uuid, timestamptz, timestamptz) to service_role;

revoke all on function public.home_figures(uuid, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.home_figures(uuid, timestamptz, timestamptz, timestamptz) to service_role;

-- ── 3. Index gabungan untuk Analytics_Logs ──────────────────────────────────

create index if not exists analytics_logs_cafe_type_created_idx
  on public."Analytics_Logs" (cafe_id, event_type, created_at desc);

-- ── 4. Hapus index duplikat pada tabel terpanas ─────────────────────────────

drop index if exists public."Orders_cafe_id_created_at_idx";

-- ── 5. Index parsial: gerakan manual terjadi jarang, deduksi pesanan banyak ─

create index if not exists inventory_movements_manual_recent_idx
  on public."Inventory_Movements" (cafe_id, inventory_item_id, created_at desc)
  where movement_type in ('manual_add', 'manual_subtract', 'manual_set');

commit;
