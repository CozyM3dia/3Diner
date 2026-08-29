-- 3Diner — Role_Permissions: override wewenang per kafe (runtime).
-- Melengkapi PERMISSIONS di src/lib/authorization.ts yang menjadi BAWAAN KODE:
-- bila kafe tidak punya baris override untuk sebuah permission, bawaan kode
-- yang dipakai. Tabel ini membuat matriks Roles & Permissions di konsol
-- owner bisa disunting tanpa deploy ulang.
--
-- Aman diulang. Idempoten.

begin;

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

-- Tanpa policy: akses hanya lewat service role di server (supabase-admin).
-- Klien tidak pernah membaca/menulis tabel ini langsung.

commit;
