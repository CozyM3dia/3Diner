-- 3Diner — kueri dapur + muatan analitik dashboard.
--
-- 1. Orders_cafe_open_idx sebelumnya hanya status received/preparing/ready.
--    Papan KDS juga menarik `awaiting` (macet di kasir). Tanpa awaiting,
--    Postgres tidak bisa memakai indeks parsial itu untuk kueri KDS.
--
-- 2. Menus_cafe_sort_idx — daftar menu tamu/POS mengurut sort_order lalu
--    created_at per cafe_id. Indeks lama hanya (cafe_id, created_at).
--
-- 3. dashboard_order_rows — Ringkasan/Penjualan menarik sampai 4000 baris
--    Orders.items JSONB lengkap (opsi, catatan). Metrik hanya butuh
--    id_menu/nama/harga/qty. RPC memangkas payload di database.

begin;

drop index if exists public."Orders_cafe_open_idx";

create index if not exists "Orders_cafe_open_idx"
  on public."Orders" (cafe_id, created_at)
  where status in ('awaiting', 'received', 'preparing', 'ready');

create index if not exists "Menus_cafe_sort_idx"
  on public."Menus" (cafe_id, sort_order, created_at);

create or replace function public.dashboard_order_rows(
  p_cafe_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_limit integer default 4000
)
returns table (
  id_order text,
  total integer,
  status text,
  payment_status text,
  payment_method text,
  table_number text,
  items jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id_order,
    o.total,
    o.status,
    o.payment_status,
    o.payment_method,
    o.table_number,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id_menu', elem->'id_menu',
          'nama_menu', elem->'nama_menu',
          'harga_menu', elem->'harga_menu',
          'qty', elem->'qty'
        )
      )
      from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) as elem
    ), '[]'::jsonb) as items,
    o.created_at
  from public."Orders" o
  where o.cafe_id = p_cafe_id
    and o.created_at >= p_start
    and o.created_at <= p_end
  order by o.created_at desc
  limit greatest(1, least(coalesce(p_limit, 4000), 4000));
$$;

revoke all on function public.dashboard_order_rows(uuid, timestamptz, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.dashboard_order_rows(uuid, timestamptz, timestamptz, integer)
  to service_role;

commit;
