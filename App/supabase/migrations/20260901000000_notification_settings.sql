-- 3Diner — Pengaturan Notifikasi (Notification Settings)
--
-- Satu kolom jsonb menyimpan preferensi notifikasi per-kafe: matriks
-- event × channel (ala modul "Notifications" Dream POS), perangkat, dan
-- jam tenang. Additive & nullable: baris lama = NULL = komponen memakai
-- default bawaan, jadi tidak ada backfill dan tidak ada perilaku lama
-- yang berubah.

alter table public."Cafes"
  add column if not exists notification_settings jsonb;
