-- 3Diner — tabel Role_Permissions yang selama ini hilang dari rantai migrasi.
--
-- Tabel ini sudah ada di produksi sejak lama, tetapi dibuat MANUAL lewat
-- Supabase Dashboard → SQL Editor: DDL-nya masih tertanam sebagai string
-- `SETUP_SQL` di komponen PermissionsMatrix, lengkap dengan komentar
-- "Jalankan di Supabase Dashboard → SQL Editor (sekali)". Tidak pernah ada
-- berkas migrasinya.
--
-- Akibatnya rantai migrasi putus di lingkungan kosong mana pun. Migrasi
-- berikutnya, 20260830021000_role_permissions_five_roles.sql, menjalankan
-- `alter table public."Role_Permissions" add column …` dan gagal dengan
--
--   ERROR: relation "public.Role_Permissions" does not exist (SQLSTATE 42P01)
--
-- Karena `supabase db reset` berhenti di situ, langkah "Start local Supabase
-- stack" di CI keluar dengan kode 1 SEBELUM satu tes pun dijalankan. CI merah
-- sejak 2 September 2026 bukan karena ada tes yang gagal, melainkan karena
-- basis datanya tidak pernah selesai dibangun.
--
-- Bentuk di bawah disalin dari produksi apa adanya (kolom, tipe, default,
-- nama constraint, indeks), supaya basis data yang dibangun dari nol identik
-- dengan yang sedang melayani. Kolom manager/kitchen/staff SENGAJA tidak ada
-- di sini: itu pekerjaan migrasi 20260830021000 yang menyusul, dan menaruhnya
-- di sini akan membuat `add column if not exists` di sana tidak pernah
-- benar-benar teruji.
--
-- RLS menyala tanpa satu pun policy — itu memang disengaja, bukan kelalaian:
-- seluruh akses ke tabel ini lewat service role (requireStaffPermission,
-- role-permission-actions), yang melewati RLS. Tanpa policy, peran anon dan
-- authenticated tidak bisa membaca atau menulis apa pun di sini.

create table if not exists public."Role_Permissions" (
  id_role_permission uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public."Cafes" (id_cafe) on delete cascade,
  permission text not null check (permission in (
    'operate_orders', 'manage_menu', 'manage_inventory', 'manage_settings'
  )),
  owner_allowed boolean not null default true,
  cashier_allowed boolean not null default false,
  updated_at timestamptz,
  unique (cafe_id, permission)
);

create index if not exists "Role_Permissions_cafe_idx"
  on public."Role_Permissions" (cafe_id);

alter table public."Role_Permissions" enable row level security;
