-- 3Diner — persist the active dynamic QRIS image URL so an order link can be
-- reopened on another device without creating a second Midtrans transaction.
begin;

alter table public."Orders"
  add column if not exists payment_qr_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'Orders_payment_qr_url_valid'
      and conrelid = 'public."Orders"'::regclass
  ) then
    alter table public."Orders"
      add constraint "Orders_payment_qr_url_valid"
      check (
        payment_qr_url is null
        or payment_qr_url ~ '^https://api(\.sandbox)?\.midtrans\.com/'
      );
  end if;
end $$;

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
         o.payment_method, o.payment_status, o.notes, o.created_at,
         o.checkin_code, o.payment_qr_url
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
      'created_at', v_order.created_at,
      -- QRIS hanya perlu diketahui selama transaksi masih menunggu bayar.
      'payment_qr_url', case when v_order.payment_status = 'pending'
                             then v_order.payment_qr_url else null end,
      -- Jangan bocorkan kode check-in setelah order masuk ke dapur.
      'checkin_code', case when v_order.payment_status = 'awaiting_checkin'
                          then v_order.checkin_code else null end
    ),
    'reviewUrl', v_cafe.google_maps_review_url
  );
end;
$$;

commit;
