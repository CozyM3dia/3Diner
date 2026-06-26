-- Tambah kolom "type" pada tabel Announcements untuk jenis pengumuman.
-- Jalankan di Supabase Dashboard → SQL Editor (project zvkmcbvckuupjsdftsyz).
-- Aman dijalankan berulang (idempotent).

alter table "Announcements"
  add column if not exists "type" text not null default 'info';

-- Batasi nilai ke jenis yang valid.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'announcements_type_check'
  ) then
    alter table "Announcements"
      add constraint announcements_type_check
      check ("type" in ('info', 'promo', 'event', 'warning'));
  end if;
end $$;
