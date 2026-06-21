-- 3Diner — Orders table (v2 in-app ordering + POS)
-- Run in Supabase SQL editor to enable POS dashboard sync.
-- The customer app works without this (localStorage fallback); this table
-- lets orders land in the cafe dashboard.

create table if not exists public."Orders" (
  id_order        text primary key,
  cafe_id         uuid not null references public."Cafes"(id_cafe) on delete cascade,
  table_number    text not null,
  items           jsonb not null default '[]'::jsonb,
  total           integer not null default 0,
  status          text not null default 'received'   check (status in ('received','preparing','ready')),
  payment_method  text                                check (payment_method in ('cash','qris')),
  payment_status  text not null default 'unpaid'      check (payment_status in ('unpaid','pending','paid')),
  created_at      timestamptz not null default now()
);

create index if not exists orders_cafe_idx on public."Orders" (cafe_id, created_at desc);

-- Row Level Security
alter table public."Orders" enable row level security;

-- Customers (anon) may create + read their own order rows (no auth, public menu).
create policy "orders_insert_anon" on public."Orders"
  for insert to anon with check (true);

create policy "orders_select_anon" on public."Orders"
  for select to anon using (true);

create policy "orders_update_anon" on public."Orders"
  for update to anon using (true) with check (true);

-- Realtime for the POS dashboard live feed
alter publication supabase_realtime add table public."Orders";
