-- 3Diner — Notifications: pusat notifikasi ala template (bell + panel bertab).
-- Satu baris = satu kejadian operasional (order baru, masuk dapur, siap,
-- lunas, dibatalkan). Ditulis oleh kode server setelah event terjadi.

create table if not exists public."Notifications" (
  id          uuid primary key default gen_random_uuid(),
  cafe_id     uuid not null references public."Cafes"(id_cafe) on delete cascade,
  type        text not null default 'inbox'
              check (type in ('order', 'kitchen', 'inbox')),
  title       text not null,
  body        text,
  href        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_cafe_created_idx
  on public."Notifications" (cafe_id, created_at desc);

alter table public."Notifications" enable row level security;

drop policy if exists "Notifications read by cafe staff" on public."Notifications";
create policy "Notifications read by cafe staff"
  on public."Notifications"
  for select
  using (true);
-- Tulis hanya lewat service role (server actions), bukan klien.
