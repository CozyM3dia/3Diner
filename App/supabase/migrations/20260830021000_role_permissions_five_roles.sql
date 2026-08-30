-- 3Diner — override wewenang per-peran penuh (5 kolom) di Role_Permissions
--
-- Sebelumnya baris override hanya menyimpan owner_allowed & cashier_allowed;
-- Manager/Kitchen/Staf tidak bisa diatur. Lima kolom boolean (owner, manager,
-- cashier, kitchen, staff) + migrasi backfill: nilai lama disalin ke kolomnya,
-- peran baru mengikuti bawaan kode (manager: menu+inventory+orders;

alter table public."Role_Permissions"
  add column if not exists manager_allowed boolean;
alter table public."Role_Permissions"
  add column if not exists kitchen_allowed boolean;
alter table public."Role_Permissions"
  add column if not exists staff_allowed boolean;

-- Backfill: baris yang sudah ada tapi kolom baru masih NULL.
-- manager = bawaan kode (orders ✓, menu ✓, inventory ✓, settings ✗),
-- kitchen = bawaan kode (orders ✓, lainnya ✗),
-- staff   = bawaan kode (orders ✓, lainnya ✗).
update public."Role_Permissions"
  set manager_allowed = (permission in ('operate_orders', 'manage_menu', 'manage_inventory')),
      kitchen_allowed = (permission = 'operate_orders'),
      staff_allowed   = (permission = 'operate_orders')
  where manager_allowed is null
     or kitchen_allowed is null
     or staff_allowed is null;
