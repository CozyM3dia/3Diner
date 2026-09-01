-- 3Diner — akses eksekusi RPC set_cafe_tax untuk authenticated
--
-- Sama kasusnya dengan get_staff_context: revoke lama menyisakan hanya
-- postgres & service_role. UI Tax Settings memanggilnya dengan JWT user
-- (requireStaffPermission -> sesi user), jadi butuh grant ini.
-- Pemanggil tetap divalidasi di dalam function (keanggotaan cafe & peran).

grant execute on function public.set_cafe_tax(uuid, numeric, numeric, boolean, date) to authenticated;
