-- 3Diner — agregasi laporan (halaman "Laporan") dipindah ke Postgres.
--
-- getReportPage sebelumnya menarik SEMUA baris Orders (termasuk array items)
-- dalam periode untuk menghitung omzet, jumlah lunas/selesai, deret omzet
-- harian (WIB), kontribusi per menu, dan ringkasan pajak. Untuk periode 90 hari
-- dengan banyak pesanan itu transfer yang besar. RPC ini mengembalikan rangkuman
-- padat dalam satu roundtrip.
--
-- Deret harian & tally per-item tetap dihitung di Postgres; pemanggil
-- (dashboard-v2-reports) merangkai label dan puncak untuk grafik. Aman diulang.

begin;

create or replace function public.report_analytics(
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
  v_paid_count integer := 0;
  v_paid_revenue integer := 0;
  v_completed_count integer := 0;
  v_tax jsonb;
  v_daily jsonb;
  v_per_item jsonb;
begin
  select coalesce(sum(total), 0)::integer,
         count(*),
         count(*) filter (where payment_status = 'paid'),
         coalesce(sum(total) filter (where payment_status = 'paid'), 0)::integer,
         count(*) filter (where status = 'completed')
    into v_total, v_order_count, v_paid_count, v_paid_revenue, v_completed_count
  from "Orders"
  where cafe_id = p_cafe_id
    and (p_start is null or created_at >= p_start)
    and (p_end is null or created_at <= p_end);

  -- Ringkasan pajak dari POTTET tiap pesanan, bukan dari tarif kafe hari ini.
  select jsonb_build_object(
    'subtotal', coalesce(sum(subtotal), 0),
    'service', coalesce(sum(service_amount), 0),
    'tax', coalesce(sum(tax_amount), 0),
    'total', coalesce(sum(total), 0),
    'untaxed_orders', count(*) filter (where coalesce(tax_pct, 0) <= 0)
  ) into v_tax
  from "Orders"
  where cafe_id = p_cafe_id
    and (p_start is null or created_at >= p_start)
    and (p_end is null or created_at <= p_end);

  -- Omzet harian (WIB) — HANYA pesanan lunas, konsisten dengan definisi omzet.
  select jsonb_agg(jsonb_build_object('day', d, 'value', v) order by d)
    into v_daily
  from (
    select ((created_at AT TIME ZONE 'Asia/Jakarta')::date)::text d, sum(total) v
    from "Orders"
    where cafe_id = p_cafe_id
      and payment_status = 'paid'
      and (p_start is null or created_at >= p_start)
      and (p_end is null or created_at <= p_end)
    group by ((created_at AT TIME ZONE 'Asia/Jakarta')::date)::text
  ) t;

  -- Kontribusi per menu dari isi pesanan (harga dari baris, bukan dari katalog).
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

  return jsonb_build_object(
    'total_revenue', v_total,
    'order_count', v_order_count,
    'paid_count', v_paid_count,
    'paid_revenue', v_paid_revenue,
    'completed_count', v_completed_count,
    'tax', coalesce(v_tax, '{}'::jsonb),
    'daily_revenue', coalesce(v_daily, '[]'::jsonb),
    'per_item', coalesce(v_per_item, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.report_analytics(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.report_analytics(uuid, timestamptz, timestamptz) to service_role;

commit;