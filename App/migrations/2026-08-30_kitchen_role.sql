-- ════════════════════════════════════════════════════════════════════
-- Role KITCHEN (30 Aug 2026)
-- Peran ketiga: staf dapur. Login → /dapur (papan KDS read-only).
-- Owner & Kasir tidak berubah; hanya constraint Staff.role yang
-- diperluas. RPC get_staff_context tidak disentuh — ia membaca
-- Staff.role apa adanya (teks), tanpa daftar peran sendiri.
-- ════════════════════════════════════════════════════════════════════

-- Nama constraint lama dibuat inline (check (role in ('owner','cashier')))
-- sehingga namanya otomatis; cari dinamis supaya idempoten walau nama
-- hasil generate beda antar environment.
do $$
declare
  con text;
begin
  select c.conname into con
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where t.relname = 'Staff'
    and n.nspname = 'public'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%role%';

  if con is not null then
    execute format('alter table public."Staff" drop constraint %I', con);
  end if;
end $$;

alter table public."Staff"
  add constraint "Staff_role_check"
  check (role in ('owner', 'cashier', 'kitchen'));
