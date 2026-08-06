-- 3Diner — ringkasan pesanan hari ini dalam satu agregat Postgres.
--
-- Konsol Kasir dan getTodayOps sebelumnya menarik SEMUA baris Orders hari ini
-- (total,status,payment_method,payment_status) ke Node hanya untuk menjumlahkan
-- omzet dan menghitung status. RPC ini mengembalikan tujuh angka dalam satu
-- roundtrip. Aman diulang.

begin;

create or replace function public.today_orders_summary(
  p_cafe_id uuid,
  p_today_start timestamptz
) returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    -- Omzet SEMUA pesanan hari ini (termasuk belum lunas) — dipakai getTodayOps.
    'total_revenue', coalesce(sum(total) filter (where created_at >= p_today_start), 0),
    'orders_today', count(*) filter (where created_at >= p_today_start),
    -- Antrean berjalan TANPA filter hari (pesanan semalam yang belum selesai tetap ada).
    'active_orders', count(*) filter (where status in ('received', 'preparing')),
    -- Angka kasir: yang selesai hari ini + yang sudah lunas hari ini.
    'completed_count', count(*) filter (where created_at >= p_today_start and status = 'completed'),
    'received_amount', coalesce(sum(total) filter (where created_at >= p_today_start and payment_status = 'paid'), 0),
    'cash_amount', coalesce(sum(total) filter (where created_at >= p_today_start and payment_status = 'paid' and payment_method = 'cash'), 0),
    'qris_amount', coalesce(sum(total) filter (where created_at >= p_today_start and payment_status = 'paid' and payment_method = 'qris'), 0)
  )
  from "Orders"
  where cafe_id = p_cafe_id;
$$;

revoke all on function public.today_orders_summary(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.today_orders_summary(uuid, timestamptz) to service_role;

commit;