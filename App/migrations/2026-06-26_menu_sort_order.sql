-- Tambah kolom "sort_order" pada tabel Menus untuk urutan tampil custom (drag).
-- Jalankan di Supabase Dashboard -> SQL Editor (project zvkmcbvckuupjsdftsyz).
-- Aman dijalankan berulang (idempotent).

alter table "Menus"
  add column if not exists "sort_order" integer;

-- Backfill urutan awal mengikuti created_at per cafe (baris lama dapat 0,1,2,...).
with ranked as (
  select
    id_menu,
    row_number() over (partition by cafe_id order by created_at asc) - 1 as rn
  from "Menus"
  where sort_order is null
)
update "Menus" m
set sort_order = ranked.rn
from ranked
where m.id_menu = ranked.id_menu;
