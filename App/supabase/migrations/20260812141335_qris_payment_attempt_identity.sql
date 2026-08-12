-- Make a QRIS attempt retryable without creating a second Midtrans charge.
-- The key is generated once per attempt and reused for lost-response retries.
begin;

alter table public."Orders"
  add column if not exists payment_idempotency_key text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'Orders_payment_qr_identity_pair_valid'
      and conrelid = 'public."Orders"'::regclass
  ) then
    alter table public."Orders"
      add constraint "Orders_payment_qr_identity_pair_valid"
      check (
        (payment_qr_url is null and payment_transaction_id is null)
        or (payment_qr_url is not null and payment_transaction_id is not null)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'Orders_payment_idempotency_key_valid'
      and conrelid = 'public."Orders"'::regclass
  ) then
    alter table public."Orders"
      add constraint "Orders_payment_idempotency_key_valid"
      check (
        payment_idempotency_key is null
        or payment_idempotency_key ~ '^[A-Za-z0-9._:-]{1,46}$'
      );
  end if;
end $$;

commit;
