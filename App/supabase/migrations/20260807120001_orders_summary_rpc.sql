-- 3Diner — RPC ringkasan pesanan untuk halaman riwayat.
--
-- getOrdersPage sebelumnya menarik SEMUA baris Orders (total,status) + SEMUA
-- status ke Node untuk menghitung counts tab dan total terfilter. Itu full scan
-- yang tumbuh seiring umur kafe. RPC ini melakukan agregasi di Postgres dan
-- mengembalikan lima angka — satu roundtrip, hampir nol transfer.
--
-- - filtered_count / filtered_total : untuk tab aktif (memakai p_statuses)
-- - count_all / count_running / count_cancelled : counts tetap untuk ketiga tab
--
-- Aman diulang. Langkah idempoten.

begin;

create or replace function public.orders_dashboard_summary(
  p_cafe_id uuid,
  p_statuses text[] default null
) returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'filtered_count', count(*) filter (where p_statuses is null or status = any (p_statuses)),
    'filtered_total', coalesce(sum(total) filter (where p_statuses is null or status = any (p_statuses)), 0),
    'count_all', count(*),
    'count_running', count(*) filter (where status in ('received', 'preparing', 'ready')),
    'count_cancelled', count(*) filter (where status = 'cancelled')
  )
  from public."Orders"
  where cafe_id = p_cafe_id;
$$;

revoke all on function public.orders_dashboard_summary(uuid, text[]) from public, anon, authenticated;
grant execute on function public.orders_dashboard_summary(uuid, text[]) to service_role;

commit;