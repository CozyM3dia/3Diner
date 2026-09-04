-- 3Diner — tabel Notifications yang juga hilang dari rantai migrasi.
--
-- Sama seperti Role_Permissions: sudah ada di produksi, tidak pernah punya
-- berkas migrasi. Bedanya tabel ini tidak meledakkan `db reset` — tak satu pun
-- migrasi lain menyentuhnya, jadi rantainya tetap jalan dan ketiadaannya baru
-- terasa saat kode dijalankan: lonceng notifikasi di bilah atas konsol membaca
-- tabel ini lewat notification-actions, dan di lingkungan yang dibangun dari
-- nol tabel itu tidak ada.
--
-- (Jangan tertukar dengan 20260901000000_notification_settings.sql. Yang itu
-- menambah kolom `notification_settings` di Cafes — preferensi kafe. Yang ini
-- kotak masuknya.)
--
-- Bentuk disalin dari produksi apa adanya. Policy bacanya IKUT disalin,
-- termasuk `using (true)`-nya, supaya berkas ini jujur mencatat keadaan yang
-- sebenarnya; pengetatannya berdiri sebagai migrasi tersendiri sesudah ini
-- (20260830030100) agar riwayatnya terbaca sebagai "begini dulu, begini
-- perbaikannya" alih-alih diam-diam ditulis ulang.

create table if not exists public."Notifications" (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public."Cafes" (id_cafe) on delete cascade,
  type text not null default 'inbox' check (type in ('order', 'kitchen', 'inbox')),
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Lonceng selalu membaca "notifikasi terbaru kafe ini", jadi indeksnya
-- (cafe_id, created_at desc) — bukan cafe_id saja.
create index if not exists notifications_cafe_created_idx
  on public."Notifications" (cafe_id, created_at desc);

alter table public."Notifications" enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'Notifications'
      and policyname = 'Notifications read by cafe staff'
  ) then
    create policy "Notifications read by cafe staff"
      on public."Notifications" for select using (true);
  end if;
end
$$;
