-- 3Diner — Pengaturan Struk (Receipt Settings)
--
-- Satu kolom jsonb menyimpan seluruh preferensi tampilan struk termal:
-- toggle header/body/footer ala modul "Atur Tampilan Struk" Dream POS.
-- Additive & nullable: baris lama = NULL = komponen memakai default bawaan,
-- jadi tidak ada backfill dan tidak ada perilaku lama yang berubah.

alter table public."Cafes"
  add column if not exists receipt_settings jsonb;
