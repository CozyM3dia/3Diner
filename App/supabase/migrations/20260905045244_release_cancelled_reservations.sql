-- Every cancellation path must release its temporary stock hold atomically.
create or replace function public.release_cancelled_order_reservations()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.release_order_reservations(new.id_order, 'released');
  return new;
end;
$$;
revoke all on function public.release_cancelled_order_reservations() from public, anon, authenticated;
create trigger release_cancelled_order_reservations
after update of status on public."Orders"
for each row when (new.status = 'cancelled' and old.status is distinct from new.status)
execute function public.release_cancelled_order_reservations();
