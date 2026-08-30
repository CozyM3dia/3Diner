-- 3Diner — 5 peran staf (Word §4 / lama §3)
--
-- Owner/Admin, Manager, Kasir (cashier), Kitchen/Bar (kitchen), Staf (staff).
-- Perluasan additive dari konsol-split 2026-07-03 ('owner','cashier','kitchen')
-- dan dari migrasi kitchen-role 2026-08-30: hanya constraint yang diganti.
--
-- Pemetaan home per peran (homeRouteForRole): owner/manager → /dashboard,
-- cashier → /kasir, kitchen → /dapur, staff → /kasir.

alter table public."Staff" drop constraint if exists "Staff_role_check";

alter table public."Staff"
  add constraint "Staff_role_check"
  check (role in ('owner', 'manager', 'cashier', 'kitchen', 'staff'));
