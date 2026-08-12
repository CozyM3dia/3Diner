-- Settle a QRIS payment only when the callback still belongs to the active
-- Midtrans transaction. The order lock, inventory confirmation, payment write,
-- and QRIS identity cleanup share one database transaction.
begin;

create or replace function public.settle_payment_order(
  p_order_id text,
  p_transaction_id text,
  p_payment_type text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_result jsonb;
  v_confirm_error text;
  v_payment_method text;
  v_rows integer;
  v_status text;
begin
  if nullif(trim(p_order_id), '') is null
     or nullif(trim(p_transaction_id), '') is null
     or nullif(trim(p_payment_type), '') is null then
    return jsonb_build_object('error', 'payment_identity_missing');
  end if;

  select payment_status, status, payment_transaction_id
    into v_order
  from public."Orders"
  where id_order = p_order_id
  for update;

  if not found then
    return jsonb_build_object('error', 'order_not_found');
  end if;

  -- Duplicate settlement callbacks are harmless. A paid order is already
  -- reconciled, regardless of which duplicate callback arrives later.
  if v_order.payment_status = 'paid' then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  -- A late callback from an expired/cleared attempt must never settle a newer
  -- attempt. The caller acknowledges this result without changing the order.
  if v_order.payment_transaction_id is distinct from p_transaction_id then
    return jsonb_build_object('ok', true, 'stale', true);
  end if;

  v_payment_method := case p_payment_type
    when 'gopay' then 'gopay'
    when 'shopeepay' then 'shopeepay'
    when 'bank_transfer' then 'bank_transfer'
    when 'echannel' then 'bank_transfer'
    when 'qris' then 'qris'
    else 'qris'
  end;

  -- confirm_order locks the same row and atomically reserves inventory. It
  -- returns insufficient_inventory without changing the order, allowing the
  -- payment to be recorded and surfaced to staff for manual reconciliation.
  v_result := public.confirm_order(p_order_id);
  v_confirm_error := v_result->>'error';
  if v_confirm_error is not null and v_confirm_error <> 'insufficient_inventory' then
    return v_result;
  end if;

  update public."Orders"
  set payment_status = 'paid',
      payment_method = v_payment_method,
      payment_qr_url = null,
      payment_transaction_id = null,
      payment_idempotency_key = null
  where id_order = p_order_id
    and payment_status <> 'paid'
    and payment_transaction_id = p_transaction_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    return jsonb_build_object('error', 'payment_identity_race');
  end if;

  if v_confirm_error = 'insufficient_inventory' then
    update public."Orders"
    set status = 'received'
    where id_order = p_order_id
      and status = 'awaiting';
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      select status into v_status
      from public."Orders"
      where id_order = p_order_id;
      if v_status is distinct from 'received' then
        return jsonb_build_object('error', 'order_reconciliation_failed');
      end if;
    elsif v_rows <> 1 then
      return jsonb_build_object('error', 'order_reconciliation_failed');
    end if;
  end if;

  return v_result;
end;
$$;

revoke all on function public.settle_payment_order(text, text, text) from public, anon, authenticated;
grant execute on function public.settle_payment_order(text, text, text) to service_role;

commit;
