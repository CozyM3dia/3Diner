-- Customer order payload must include the same pricing snapshot used by
-- checkout and payment. Without these fields the client rejects an otherwise
-- valid order response before it can start QRIS.
begin;

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

  select o.id_order, o.cafe_id, o.table_number, o.items, o.subtotal,
         o.tax_pct, o.tax_amount, o.service_pct, o.service_amount,
         o.prices_include_tax, o.total, o.status, o.payment_method,
         o.payment_status, o.notes, o.created_at, o.checkin_code,
         o.payment_qr_url
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
      'subtotal', v_order.subtotal,
      'tax_pct', v_order.tax_pct,
      'tax_amount', v_order.tax_amount,
      'service_pct', v_order.service_pct,
      'service_amount', v_order.service_amount,
      'prices_include_tax', v_order.prices_include_tax,
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

revoke all on function public.get_order_for_customer(text, uuid) from public, anon, authenticated;
grant execute on function public.get_order_for_customer(text, uuid) to service_role;

commit;
