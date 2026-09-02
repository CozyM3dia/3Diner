-- 3Diner — akses eksekusi RPC get_staff_context untuk authenticated
--
-- Sebelumnya function ini hanya bisa dipanggil service_role (revoke lama).
-- Alur login butuh memanggilnya dengan JWT user untuk memetakan peran ->
-- tujuan konsol. Service role tetap bisa (owner function-nya postgres),
-- public TETAP tidak diberi akses.

grant execute on function public.get_staff_context(uuid) to authenticated;
