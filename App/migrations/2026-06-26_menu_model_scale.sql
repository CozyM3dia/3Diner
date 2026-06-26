-- Tambah kolom "model_scale" pada tabel Menus: skala default model 3D per menu.
-- Jalankan di Supabase Dashboard -> SQL Editor (project zvkmcbvckuupjsdftsyz).
-- Aman dijalankan berulang (idempotent).

alter table "Menus"
  add column if not exists "model_scale" numeric not null default 1.0;
