begin;

create table if not exists public."Payment_Attempts" (
  payment_attempt_id uuid primary key default gen_random_uuid(),
  order_id text not null references public."Orders"(id_order) on delete restrict,
  cafe_id uuid not null references public."Cafes"(id_cafe) on delete cascade,
  provider text not null default 'midtrans' check (provider = 'midtrans'),
  provider_order_id text not null check (provider_order_id ~ '^[A-Za-z0-9._:-]{1,100}$'),
  provider_transaction_id text check (provider_transaction_id is null or provider_transaction_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9._:-]{16,128}$'),
  payment_method text not null check (payment_method in ('qris', 'gopay', 'shopeepay', 'bank_transfer')),
  amount integer not null check (amount >= 0),
  status text not null default 'created' check (status in ('created', 'pending', 'settled', 'expired', 'cancelled', 'refund_pending', 'refunded', 'manual_review')),
  provider_payload jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  settled_at timestamptz,
  constraint payment_attempt_settled_identity check (
    status not in ('settled', 'refund_pending', 'refunded') or provider_transaction_id is not null
  ),
  unique (provider, provider_order_id),
  unique (provider, idempotency_key)
);

create index if not exists "Payment_Attempts_order_status_idx"
  on public."Payment_Attempts" (order_id, status, created_at desc);
create index if not exists "Payment_Attempts_reconciliation_idx"
  on public."Payment_Attempts" (status, expires_at)
  where status in ('created', 'pending', 'refund_pending', 'manual_review');

create table if not exists public."Payment_Webhook_Events" (
  webhook_event_id uuid primary key default gen_random_uuid(),
  provider text not null default 'midtrans' check (provider = 'midtrans'),
  provider_order_id text,
  provider_transaction_id text,
  event_key text not null check (length(trim(event_key)) between 16 and 200),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  signature_valid boolean not null,
  normalized_status text,
  gross_amount integer,
  payload jsonb,
  processing_status text not null default 'received' check (processing_status in ('received', 'processed', 'rejected', 'retryable')),
  processing_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_key),
  unique (provider, payload_hash)
);

create index if not exists "Payment_Webhook_Events_processing_idx"
  on public."Payment_Webhook_Events" (processing_status, received_at)
  where processing_status in ('received', 'retryable');

alter table public."Payment_Attempts" enable row level security;
alter table public."Payment_Webhook_Events" enable row level security;
revoke all on table public."Payment_Attempts", public."Payment_Webhook_Events" from public, anon, authenticated;
grant select, insert, update, delete on table public."Payment_Attempts", public."Payment_Webhook_Events" to service_role;
grant usage, select on all sequences in schema public to service_role;

commit;
