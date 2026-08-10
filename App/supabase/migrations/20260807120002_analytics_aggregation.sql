-- 3Diner — agregasi dashboard dipindah ke Postgres.
--
-- getDashboardData & getRevenueData sebelumnya menarik SEMUA baris
-- Analytics_Logs / Orders dalam window ke Node lalu meng-agregasi manual di JS
-- (anti-pola "bring data to code"). Dua RPC di bawah melakukan agregasi di
-- Postgres dan mengembalikan rangkuman padat — transfer hampir nol, satu
-- roundtrip, dan scan memakai indeks cafe_id+created_at.
--
-- Konvensi waktu mengikuti pemanggil lama: WIB (Asia/Jakarta) untuk bucket
-- harian/jam/hari-minggu. Minggu berjalan dihitung relatif terhadap now()
-- (usia 0-7 hari vs 7-14 hari), persis seperti logika TS sebelumnya.
--
-- Pemanggil (analytics.ts) tetap menghitung nilai turunan (konversi, delta,
-- insight, top dish) dari rangkuman ini. Aman diulang.

begin;

-- ─────────────────────────────────────────────────────────────
-- 1. dashboard_analytics — peristiwa tamu (Analytics_Logs)
-- ─────────────────────────────────────────────────────────────

create or replace function public.dashboard_analytics(
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
  v_totals jsonb;
  v_this_week jsonb;
  v_last_week jsonb;
  v_daily jsonb;
  v_hourly jsonb;
  v_weekday jsonb;
  v_per_dish jsonb;
  v_recent jsonb;
begin
  select jsonb_object_agg(coalesce(event_type, ''), cnt)
    into v_totals
  from (
    select event_type, count(*) cnt
    from "Analytics_Logs"
    where cafe_id = p_cafe_id
      and (p_start is null or created_at >= p_start)
      and (p_end is null or created_at <= p_end)
    group by event_type
  ) t;

  select jsonb_object_agg(coalesce(event_type, ''), cnt)
    into v_this_week
  from (
    select event_type, count(*) cnt
    from "Analytics_Logs"
    where cafe_id = p_cafe_id
      and created_at > now() - interval '7 days'
    group by event_type
  ) t;

  select jsonb_object_agg(coalesce(event_type, ''), cnt)
    into v_last_week
  from (
    select event_type, count(*) cnt
    from "Analytics_Logs"
    where cafe_id = p_cafe_id
      and created_at > now() - interval '14 days'
      and created_at <= now() - interval '7 days'
    group by event_type
  ) t;

  -- Harian (WIB) — hanya hari yang punya data; pemanggil mengisi hari kosong.
  select jsonb_agg(jsonb_build_object('day', d, 'count', c))
    into v_daily
  from (
    select ((created_at AT TIME ZONE 'Asia/Jakarta')::date)::text d, count(*) c
    from "Analytics_Logs"
    where cafe_id = p_cafe_id
      and (p_start is null or created_at >= p_start)
      and (p_end is null or created_at <= p_end)
    group by ((created_at AT TIME ZONE 'Asia/Jakarta')::date)::text
  ) t;

  -- Per jam (WIB), 24 slot — generate_series menjamin array penuh dengan nol.
  select jsonb_agg(v order by h) into v_hourly
  from (
    select gs.h,
           coalesce(t.c, 0) v
    from generate_series(0, 23) gs(h)
    left join (
      select extract(hour from (created_at AT TIME ZONE 'Asia/Jakarta'))::int h, count(*) c
      from "Analytics_Logs"
      where cafe_id = p_cafe_id
        and (p_start is null or created_at >= p_start)
        and (p_end is null or created_at <= p_end)
      group by h
    ) t on t.h = gs.h
  ) s;

  -- Per hari-minggu (WIB), Mon=0..Sun=6 — generate_series menjamin array penuh.
  select jsonb_agg(v order by wd) into v_weekday
  from (
    select gs.wd,
           coalesce(t.c, 0) v
    from generate_series(0, 6) gs(wd)
    left join (
      select ((extract(dow from (created_at AT TIME ZONE 'Asia/Jakarta'))::int + 6) % 7) wd, count(*) c
      from "Analytics_Logs"
      where cafe_id = p_cafe_id
        and (p_start is null or created_at >= p_start)
        and (p_end is null or created_at <= p_end)
      group by wd
    ) t on t.wd = gs.wd
  ) s;

  -- Per hidangan: klik / lihat 3D / pesan.
  select jsonb_agg(jsonb_build_object('menu_id', menu_id, 'clicks', clicks, 'views', views, 'orders', orders))
    into v_per_dish
  from (
    select menu_id,
           count(*) filter (where event_type = 'click_menu') as clicks,
           count(*) filter (where event_type = 'view_3d') as views,
           count(*) filter (where event_type = 'click_order') as orders
    from "Analytics_Logs"
    where cafe_id = p_cafe_id
      and (p_start is null or created_at >= p_start)
      and (p_end is null or created_at <= p_end)
    group by menu_id
  ) t;

  -- Kejadian terbaru (untuk panel "recent").
  select jsonb_agg(row_to_json(r) order by r.created_at desc) into v_recent
  from (
    select created_at, menu_id, event_type
    from "Analytics_Logs"
    where cafe_id = p_cafe_id
      and (p_start is null or created_at >= p_start)
      and (p_end is null or created_at <= p_end)
    order by created_at desc
    limit 8
  ) r;

  return jsonb_build_object(
    'totals', coalesce(v_totals, '{}'::jsonb),
    'this_week', coalesce(v_this_week, '{}'::jsonb),
    'last_week', coalesce(v_last_week, '{}'::jsonb),
    'daily', coalesce(v_daily, '[]'::jsonb),
    'hourly', coalesce(v_hourly, '[]'::jsonb),
    'weekday', coalesce(v_weekday, '[]'::jsonb),
    'per_dish', coalesce(v_per_dish, '[]'::jsonb),
    'recent', coalesce(v_recent, '[]'::jsonb)
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. revenue_analytics — penjualan (Orders)
-- ─────────────────────────────────────────────────────────────

create or replace function public.revenue_analytics(
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
  v_total integer := 0;
  v_order_count integer := 0;
  v_items_sold integer := 0;
  v_this_week integer := 0;
  v_last_week integer := 0;
  v_status jsonb;
  v_payment jsonb;
  v_daily jsonb;
  v_per_item jsonb;
  v_recent jsonb;
begin
  select coalesce(sum(total), 0)::integer, count(*)
    into v_total, v_order_count
  from "Orders"
  where cafe_id = p_cafe_id
    and (p_start is null or created_at >= p_start)
    and (p_end is null or created_at <= p_end);

  select coalesce(sum((it->>'qty')::int), 0)::integer
    into v_items_sold
  from "Orders" o, jsonb_array_elements(o.items) it
  where o.cafe_id = p_cafe_id
    and (p_start is null or o.created_at >= p_start)
    and (p_end is null or o.created_at <= p_end);

  select jsonb_object_agg(coalesce(status, ''), cnt)
    into v_status
  from (
    select status, count(*) cnt
    from "Orders"
    where cafe_id = p_cafe_id
      and (p_start is null or created_at >= p_start)
      and (p_end is null or created_at <= p_end)
    group by status
  ) t;

  select jsonb_build_object(
    'cash', count(*) filter (where payment_status = 'paid' and payment_method = 'cash'),
    'qris', count(*) filter (where payment_status = 'paid' and payment_method = 'qris'),
    'gopay', count(*) filter (where payment_status = 'paid' and payment_method = 'gopay'),
    'shopeepay', count(*) filter (where payment_status = 'paid' and payment_method = 'shopeepay'),
    'bank_transfer', count(*) filter (where payment_status = 'paid' and payment_method = 'bank_transfer'),
    'unpaid', count(*) filter (where payment_status <> 'paid')
  ) into v_payment
  from "Orders"
  where cafe_id = p_cafe_id
    and (p_start is null or created_at >= p_start)
    and (p_end is null or created_at <= p_end);

  select jsonb_agg(jsonb_build_object('day', d, 'value', v) order by d)
    into v_daily
  from (
    select ((created_at AT TIME ZONE 'Asia/Jakarta')::date)::text d, sum(total) v
    from "Orders"
    where cafe_id = p_cafe_id
      and (p_start is null or created_at >= p_start)
      and (p_end is null or created_at <= p_end)
    group by ((created_at AT TIME ZONE 'Asia/Jakarta')::date)::text
  ) t;

  select jsonb_agg(jsonb_build_object('name', name, 'qty', qty, 'revenue', revenue) order by revenue desc)
    into v_per_item
  from (
    select it->>'nama_menu' as name,
           sum((it->>'qty')::int) qty,
           sum((it->>'harga_menu')::int * (it->>'qty')::int) revenue
    from "Orders" o, jsonb_array_elements(o.items) it
    where o.cafe_id = p_cafe_id
      and (p_start is null or o.created_at >= p_start)
      and (p_end is null or o.created_at <= p_end)
    group by it->>'nama_menu'
  ) t;

  select coalesce(sum(total), 0)::integer into v_this_week
  from "Orders"
  where cafe_id = p_cafe_id and created_at > now() - interval '7 days';

  select coalesce(sum(total), 0)::integer into v_last_week
  from "Orders"
  where cafe_id = p_cafe_id
    and created_at > now() - interval '14 days'
    and created_at <= now() - interval '7 days';

  select jsonb_agg(row_to_json(r) order by r.created_at desc) into v_recent
  from (
    select id_order, table_number, total, status, created_at
    from "Orders"
    where cafe_id = p_cafe_id
      and (p_start is null or created_at >= p_start)
      and (p_end is null or created_at <= p_end)
    order by created_at desc
    limit 8
  ) r;

  return jsonb_build_object(
    'total_revenue', v_total,
    'order_count', v_order_count,
    'items_sold', v_items_sold,
    'status_counts', coalesce(v_status, '{}'::jsonb),
    'payment_counts', coalesce(v_payment, '{}'::jsonb),
    'daily_revenue', coalesce(v_daily, '[]'::jsonb),
    'per_item', coalesce(v_per_item, '[]'::jsonb),
    'this_week_rev', v_this_week,
    'last_week_rev', v_last_week,
    'recent_orders', coalesce(v_recent, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.dashboard_analytics(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.revenue_analytics(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.dashboard_analytics(uuid, timestamptz, timestamptz) to service_role;
grant execute on function public.revenue_analytics(uuid, timestamptz, timestamptz) to service_role;

commit;
