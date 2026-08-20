begin;

create extension if not exists pgcrypto;

create table if not exists public."Cafes" (
  id_cafe uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  nama_cafe text not null,
  alamat_cafe text,
  slug_url text not null unique,
  qr_token_customer text unique default gen_random_uuid()::text,
  subscription_type text not null default 'Tier 50k' check (subscription_type in ('Tier 50k', 'Tier 100k', 'Tier 150k')),
  status_lunas boolean not null default false,
  created_at timestamptz not null default now(),
  logo_url text,
  cover_url text,
  greeting text,
  brand_color text,
  google_maps_review_url text,
  ai_credits_quota integer not null default 5,
  ai_credits_used integer not null default 0,
  ai_credits_period_start date not null default date_trunc('month', now())::date,
  tax_rate_pct numeric(5,2) not null default 0,
  service_charge_pct numeric(5,2) not null default 0,
  prices_include_tax boolean not null default false,
  tax_configured_at timestamptz,
  tax_pending_rate_pct numeric(5,2),
  tax_pending_service_pct numeric(5,2),
  tax_pending_include boolean,
  tax_pending_from date,
  constraint cafes_ai_credits_nonnegative check (ai_credits_quota >= 0 and ai_credits_used >= 0),
  constraint cafes_tax_rates_sane check (
    tax_rate_pct between 0 and 100 and service_charge_pct between 0 and 100
    and (tax_pending_rate_pct is null or tax_pending_rate_pct between 0 and 100)
    and (tax_pending_service_pct is null or tax_pending_service_pct between 0 and 100)
  )
);

create table if not exists public."Menus" (
  id_menu uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public."Cafes"(id_cafe) on delete cascade,
  nama_menu text not null,
  harga_menu numeric not null default 0,
  description_menu text,
  model_3d_url text,
  usdz_url text,
  redirect_link text,
  created_at timestamptz not null default now(),
  image_url text,
  category text default 'Lainnya',
  prep_time_minutes integer,
  calories integer,
  ingredients text,
  is_active boolean default true,
  discount_pct integer default 0,
  schedule_days text,
  schedule_start text,
  schedule_end text,
  sort_order integer,
  model_scale numeric not null default 1.0
);

create table if not exists public."Analytics_Logs" (
  id_log uuid primary key default gen_random_uuid(),
  cafe_id uuid references public."Cafes"(id_cafe) on delete set null,
  menu_id uuid references public."Menus"(id_menu) on delete set null,
  event_type text not null check (event_type in ('click_menu', 'view_3d', 'click_order')),
  duration integer default 0,
  created_at timestamptz not null default now()
);

create table if not exists public."Announcements" (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public."Cafes"(id_cafe) on delete cascade,
  message text not null,
  bg_color text default '#FD5002',
  is_active boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  type text not null default 'info' check (type in ('info', 'promo', 'event', 'warning'))
);

create table if not exists public."Orders" (
  id_order text primary key,
  cafe_id uuid not null references public."Cafes"(id_cafe) on delete cascade,
  table_number text not null,
  items jsonb not null default '[]'::jsonb,
  total integer not null default 0 check (total >= 0),
  status text not null default 'received' check (status in ('awaiting', 'received', 'preparing', 'ready', 'completed', 'cancelled')),
  payment_method text check (payment_method is null or payment_method in ('cash', 'qris', 'gopay', 'shopeepay', 'bank_transfer')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'awaiting_payment', 'awaiting_checkin', 'pending', 'paid')),
  created_at timestamptz not null default now(),
  notes text,
  customer_token uuid not null default gen_random_uuid(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_reason text,
  cancelled_by uuid references auth.users(id) on delete set null,
  subtotal integer not null default 0,
  tax_pct numeric(5,2) not null default 0,
  tax_amount integer not null default 0,
  service_pct numeric(5,2) not null default 0,
  service_amount integer not null default 0,
  prices_include_tax boolean not null default false,
  checkin_code text,
  payment_qr_url text,
  payment_transaction_id text,
  payment_idempotency_key text,
  constraint orders_cancel_requires_reason check (
    status <> 'cancelled' or (cancelled_at is not null and nullif(trim(cancelled_reason), '') is not null)
  )
);

create index if not exists cafes_owner_id_idx on public."Cafes" (owner_id);
create index if not exists menus_cafe_created_idx on public."Menus" (cafe_id, created_at desc);
create index if not exists analytics_logs_cafe_created_idx on public."Analytics_Logs" (cafe_id, created_at desc);
create index if not exists announcements_cafe_active_idx on public."Announcements" (cafe_id, is_active);
create index if not exists orders_cafe_created_idx on public."Orders" (cafe_id, created_at desc);
create index if not exists orders_customer_token_idx on public."Orders" (customer_token);

alter table public."Cafes" enable row level security;
alter table public."Menus" enable row level security;
alter table public."Analytics_Logs" enable row level security;
alter table public."Announcements" enable row level security;
alter table public."Orders" enable row level security;

revoke all on table public."Orders" from anon;
revoke all on table public."Orders" from authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on table
  public."Cafes",
  public."Menus",
  public."Analytics_Logs",
  public."Announcements",
  public."Orders"
to service_role;
grant usage, select on all sequences in schema public to service_role;

commit;
