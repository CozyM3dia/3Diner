-- Cancellation, stock release, repricing and replacement share one transaction.
create or replace function public.amend_pending_order(
  p_cafe_id uuid, p_order_id text, p_additions jsonb, p_actor uuid default null
) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare
  v_old public."Orders"%rowtype;
  v_items jsonb;
  v_quote jsonb;
  v_result jsonb;
  v_key text;
begin
  if jsonb_typeof(p_additions) is distinct from 'array'
     or jsonb_array_length(p_additions) not between 1 and 50 then
    raise exception 'invalid_order_items';
  end if;
  select * into v_old from public."Orders"
  where id_order = p_order_id and cafe_id = p_cafe_id for update;
  if not found then raise exception 'order_not_found'; end if;
  v_key := 'amend:' || p_order_id || ':' || encode(digest(p_additions::text, 'sha256'), 'hex');
  select response_payload into v_result from public."Order_Idempotency_Keys"
  where cafe_id = p_cafe_id and idempotency_key = v_key and order_id is not null;
  if found then return v_result; end if;
  if v_old.status <> 'awaiting' or coalesce(v_old.payment_status, '') not in ('awaiting_checkin', 'unpaid')
     or coalesce(v_old.payment_method, 'cash') <> 'cash' then
    raise exception 'order_not_editable';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id_menu', line->>'id_menu', 'qty', line->'qty',
    'note', coalesce(line->>'notes', line->>'note'),
    'options', coalesce((select jsonb_agg(opt->>'id_option_value')
      from jsonb_array_elements(coalesce(line->'options', '[]'::jsonb)) opt), '[]'::jsonb)
  )), '[]'::jsonb) into v_items from jsonb_array_elements(v_old.items) line;
  v_items := v_items || p_additions;
  if jsonb_array_length(v_items) > 50 then raise exception 'invalid_order_items'; end if;
  perform public.cancel_order(p_cafe_id, p_order_id, 'Diperbarui kasir: item ditambahkan', p_actor);
  perform public.release_order_reservations(p_order_id, 'released');
  v_quote := public.issue_order_quote(p_cafe_id, v_old.table_number, v_items, v_old.notes, 'cashier');
  v_result := public.commit_order_atomic(p_cafe_id, v_old.table_number, v_items, v_old.notes,
    'cashier', (v_quote->>'quote_id')::uuid, v_key);
  if v_result ? 'error' or v_result->'order'->>'id_order' is null then raise exception 'replacement_failed'; end if;
  return v_result;
end;
$$;
revoke all on function public.amend_pending_order(uuid, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.amend_pending_order(uuid, text, jsonb, uuid) to service_role;
