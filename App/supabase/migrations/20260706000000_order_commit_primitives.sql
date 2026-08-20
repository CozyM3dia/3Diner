begin;

create table if not exists public."Order_Quotes" (
  quote_id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public."Cafes"(id_cafe) on delete cascade,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  canonical_payload jsonb not null,
  pricing_snapshot jsonb not null,
  status text not null default 'issued' check (status in ('issued', 'consumed', 'expired')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint order_quotes_expiry_after_issue check (expires_at > issued_at),
  constraint order_quotes_consumed_consistency check (
    (status = 'consumed') = (consumed_at is not null)
  )
);

create index if not exists "Order_Quotes_cafe_status_expiry_idx"
  on public."Order_Quotes" (cafe_id, status, expires_at);

create table if not exists public."Order_Idempotency_Keys" (
  cafe_id uuid not null references public."Cafes"(id_cafe) on delete cascade,
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9._:-]{16,128}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  quote_id uuid references public."Order_Quotes"(quote_id) on delete restrict,
  order_id text references public."Orders"(id_order) on delete restrict,
  response_payload jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint order_idempotency_expiry_after_create check (expires_at > created_at),
  constraint order_idempotency_response_consistency check (
    (order_id is null) = (response_payload is null)
  ),
  primary key (cafe_id, idempotency_key)
);

create index if not exists "Order_Idempotency_Keys_expiry_idx"
  on public."Order_Idempotency_Keys" (expires_at);
create unique index if not exists "Order_Idempotency_Keys_order_id_idx"
  on public."Order_Idempotency_Keys" (order_id)
  where order_id is not null;

create table if not exists public."Order_Reservations" (
  reservation_id uuid primary key default gen_random_uuid(),
  order_id text not null references public."Orders"(id_order) on delete cascade,
  cafe_id uuid not null references public."Cafes"(id_cafe) on delete cascade,
  inventory_item_id uuid not null references public."Inventory_Items"(id_inventory_item) on delete restrict,
  requested_qty numeric(12,3) not null check (requested_qty > 0),
  reserved_qty numeric(12,3) not null check (reserved_qty > 0 and reserved_qty <= requested_qty),
  status text not null default 'reserved' check (status in ('reserved', 'consumed', 'released', 'expired')),
  reserved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  released_at timestamptz,
  constraint order_reservations_expiry_after_reserve check (expires_at > reserved_at),
  constraint order_reservations_terminal_timestamp check (
    (status = 'consumed') = (consumed_at is not null)
    and (status in ('released', 'expired')) = (released_at is not null)
  ),
  unique (order_id, inventory_item_id)
);

create index if not exists "Order_Reservations_cafe_status_expiry_idx"
  on public."Order_Reservations" (cafe_id, status, expires_at);
create index if not exists "Order_Reservations_inventory_status_idx"
  on public."Order_Reservations" (inventory_item_id, status);

alter table public."Order_Quotes" enable row level security;
alter table public."Order_Idempotency_Keys" enable row level security;
alter table public."Order_Reservations" enable row level security;

revoke all on table
  public."Order_Quotes",
  public."Order_Idempotency_Keys",
  public."Order_Reservations"
from public, anon, authenticated;
grant select, insert, update, delete on table
  public."Order_Quotes",
  public."Order_Idempotency_Keys",
  public."Order_Reservations"
to service_role;
grant usage, select on all sequences in schema public to service_role;

commit;
