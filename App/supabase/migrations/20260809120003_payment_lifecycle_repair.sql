-- 3Diner — repair environments that applied 20260809120000 before its
-- lifecycle constraints and tax snapshots were corrected. Safe after either
-- version: the public RPC signature remains singular and service-role-only.
begin;

-- Replace only single-column lifecycle checks. Composite business checks such as
-- Orders_cancel_requires_reason are deliberately outside this loop.
do $$
declare
  v_column text;
  v_attnum smallint;
  v_constraint record;
begin
  foreach v_column in array array['status', 'payment_status', 'payment_method']
  loop
    select attnum into v_attnum
    from pg_attribute
    where attrelid = 'public."Orders"'::regclass
      and attname = v_column
      and not attisdropped;

    for v_constraint in
      select conname
      from pg_constraint
      where conrelid = 'public."Orders"'::regclass
        and contype = 'c'
        and cardinality(conkey) = 1
        and conkey[1] = v_attnum
    loop
      execute format('alter table public."Orders" drop constraint if exists %I', v_constraint.conname);
    end loop;
  end loop;

  alter table public."Orders"
    add constraint "Orders_status_valid"
      check (status in ('awaiting', 'received', 'preparing', 'ready', 'completed', 'cancelled')),
    add constraint "Orders_payment_status_valid"
      check (payment_status in ('unpaid', 'awaiting_payment', 'awaiting_checkin', 'pending', 'paid')),
    add constraint "Orders_payment_method_valid"
      check (payment_method is null or payment_method in
        ('cash', 'qris', 'gopay', 'shopeepay', 'bank_transfer'));
end $$;

-- Preserve every established create_order validation path in the renamed v1
-- implementation. The public function below only repairs pre-snapshot rows;
-- fresh 20260809120000 rows already carry subtotal and are returned untouched.
alter function public.create_order(uuid, text, jsonb, text, text)
  rename to create_order_payment_lifecycle_v1;

create or replace function public.create_order(
  p_cafe_id uuid,
  p_table_number text,
  p_items jsonb,
  p_notes text default null,
  p_channel text default 'online'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_order jsonb;
  v_order_id text;
  v_subtotal integer;
  v_total integer;
  v_tax jsonb;
  v_tax_pct numeric(5,2);
  v_service_pct numeric(5,2);
  v_tax_amount integer;
  v_service_amount integer;
  v_include boolean;
begin
  v_result := public.create_order_payment_lifecycle_v1(
    p_cafe_id, p_table_number, p_items, p_notes, p_channel
  );
  v_order_id := v_result #>> '{order,id_order}';

  select subtotal, total
    into v_subtotal, v_total
  from public."Orders"
  where id_order = v_order_id
  for update;

  -- Old 20260809120000 inserts omitted the snapshot columns, which therefore
  -- have the schema default subtotal=0. New rows have a real subtotal and must
  -- not have tax applied twice.
  if v_subtotal = 0 and v_total > 0 then
    v_subtotal := v_total;
    v_tax := public.effective_tax_settings(p_cafe_id);
    v_tax_pct := coalesce((v_tax->>'tax_pct')::numeric, 0);
    v_service_pct := coalesce((v_tax->>'service_pct')::numeric, 0);
    v_include := coalesce((v_tax->>'include')::boolean, false);
    v_service_amount := round(v_subtotal * v_service_pct / 100.0)::integer;
    if v_include then
      v_tax_amount := round(
        (v_subtotal + v_service_amount)
        - (v_subtotal + v_service_amount) / (1 + v_tax_pct / 100.0)
      )::integer;
      v_total := v_subtotal + v_service_amount;
    else
      v_tax_amount := round((v_subtotal + v_service_amount) * v_tax_pct / 100.0)::integer;
      v_total := v_subtotal + v_service_amount + v_tax_amount;
    end if;

    update public."Orders"
    set subtotal = v_subtotal,
        tax_pct = v_tax_pct,
        tax_amount = v_tax_amount,
        service_pct = v_service_pct,
        service_amount = v_service_amount,
        prices_include_tax = v_include,
        total = v_total
    where id_order = v_order_id;

    v_order := (v_result->'order') || jsonb_build_object(
      'subtotal', v_subtotal, 'tax_pct', v_tax_pct, 'tax_amount', v_tax_amount,
      'service_pct', v_service_pct, 'service_amount', v_service_amount,
      'prices_include_tax', v_include, 'total', v_total
    );
    v_result := jsonb_set(v_result, '{order}', v_order, true);
  end if;

  return v_result;
end;
$$;

-- Server-side guard: a cashier may settle only cash orders that are awaiting
-- check-in (new lifecycle) or unpaid (legacy lifecycle). Online rows never get
-- rewritten into cash, even if a stale dashboard tries this RPC.
create or replace function public.mark_order_cash_paid(
  p_cafe_id uuid,
  p_order_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_method text;
  v_status text;
begin
  if p_cafe_id is null or p_order_id is null then
    return jsonb_build_object('error', 'order_not_found');
  end if;

  select payment_method, payment_status into v_method, v_status
  from public."Orders"
  where id_order = p_order_id and cafe_id = p_cafe_id
  for update;
  if not found then
    return jsonb_build_object('error', 'order_not_found');
  end if;
  if v_method is distinct from 'cash' then
    return jsonb_build_object('error', 'cash_only');
  end if;
  if v_status = 'paid' then
    return jsonb_build_object('ok', true, 'alreadyPaid', true);
  end if;
  if v_status not in ('awaiting_checkin', 'unpaid') then
    return jsonb_build_object('error', 'invalid_cash_payment_state');
  end if;

  update public."Orders"
  set payment_status = 'paid'
  where id_order = p_order_id
    and cafe_id = p_cafe_id
    and payment_method = 'cash'
    and payment_status in ('awaiting_checkin', 'unpaid');
  return jsonb_build_object('ok', true);
end;
$$;

-- Keep the historical aggregation intact and replace only its payment buckets.
alter function public.revenue_analytics(uuid, timestamptz, timestamptz)
  rename to revenue_analytics_payment_lifecycle_v1;

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
  v_result jsonb;
  v_payment jsonb;
begin
  v_result := public.revenue_analytics_payment_lifecycle_v1(p_cafe_id, p_start, p_end);
  select jsonb_build_object(
    'cash', count(*) filter (where payment_status = 'paid' and payment_method = 'cash'),
    'qris', count(*) filter (where payment_status = 'paid' and payment_method = 'qris'),
    'gopay', count(*) filter (where payment_status = 'paid' and payment_method = 'gopay'),
    'shopeepay', count(*) filter (where payment_status = 'paid' and payment_method = 'shopeepay'),
    'bank_transfer', count(*) filter (where payment_status = 'paid' and payment_method = 'bank_transfer'),
    'unpaid', count(*) filter (where payment_status <> 'paid')
  ) into v_payment
  from public."Orders"
  where cafe_id = p_cafe_id
    and (p_start is null or created_at >= p_start)
    and (p_end is null or created_at <= p_end);
  return jsonb_set(v_result, '{payment_counts}', v_payment, true);
end;
$$;

revoke all on function public.create_order_payment_lifecycle_v1(uuid, text, jsonb, text, text) from public, anon, authenticated, service_role;
revoke all on function public.create_order(uuid, text, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.mark_order_cash_paid(uuid, text) from public, anon, authenticated;
revoke all on function public.revenue_analytics_payment_lifecycle_v1(uuid, timestamptz, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.revenue_analytics(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.create_order(uuid, text, jsonb, text, text) to service_role;
grant execute on function public.mark_order_cash_paid(uuid, text) to service_role;
grant execute on function public.revenue_analytics(uuid, timestamptz, timestamptz) to service_role;

commit;
