-- 3Diner — takings breakdown now covers every non-cash method, not just QRIS.
--
-- today_orders_summary previously bucketed paid amounts into cash_amount and
-- qris_amount only. Since multi-method payment shipped, paid orders can also
-- settle via gopay/shopeepay/bank_transfer — those amounts summed into
-- received_amount but vanished from the kasir footer's breakdown because
-- qris_amount didn't include them. This replaces the qris-only bucket with a
-- non-cash bucket (qris + gopay + shopeepay + bank_transfer), so cash_amount +
-- noncash_amount == received_amount again. Function signature and all other
-- returned fields are unchanged. Aman diulang.

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
    -- Semua metode non-tunai: qris, gopay, shopeepay, bank_transfer.
    'noncash_amount', coalesce(sum(total) filter (where created_at >= p_today_start and payment_status = 'paid' and payment_method <> 'cash'), 0)
  )
  from "Orders"
  where cafe_id = p_cafe_id;
$$;

revoke all on function public.today_orders_summary(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.today_orders_summary(uuid, timestamptz) to service_role;

commit;
