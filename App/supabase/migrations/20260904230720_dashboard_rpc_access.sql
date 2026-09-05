-- Staff context and tax changes are authorized by server code before using
-- the service-role client. Neither function checks the caller's membership.
-- Direct authenticated EXECUTE would allow cross-cafe reads/tax changes.
revoke all on function public.get_staff_context(uuid) from public, anon, authenticated;
revoke all on function public.set_cafe_tax(uuid, numeric, numeric, boolean, date) from public, anon, authenticated;
grant execute on function public.get_staff_context(uuid) to service_role;
grant execute on function public.set_cafe_tax(uuid, numeric, numeric, boolean, date) to service_role;
