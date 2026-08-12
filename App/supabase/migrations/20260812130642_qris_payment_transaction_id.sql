-- Keep the Midtrans transaction identity with the active QRIS attempt so
-- delayed notifications from an older attempt cannot reset a newer QR.
begin;

alter table public."Orders"
  add column if not exists payment_transaction_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'Orders_payment_transaction_id_valid'
      and conrelid = 'public."Orders"'::regclass
  ) then
    alter table public."Orders"
      add constraint "Orders_payment_transaction_id_valid"
      check (
        payment_transaction_id is null
        or payment_transaction_id ~ '^[A-Za-z0-9._:-]{1,128}$'
      );
  end if;
end $$;

commit;
