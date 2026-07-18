begin;

alter table public."Orders"
  add column if not exists customer_token uuid default gen_random_uuid();

update public."Orders"
set customer_token = gen_random_uuid()
where customer_token is null;

alter table public."Orders"
  alter column customer_token set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'Orders_total_nonnegative'
      and conrelid = 'public."Orders"'::regclass
  ) then
    alter table public."Orders"
      add constraint "Orders_total_nonnegative" check (total >= 0) not valid;
  end if;
end $$;

alter table public."Orders"
  validate constraint "Orders_total_nonnegative";

create index if not exists "Orders_customer_token_idx"
  on public."Orders" (customer_token);
create index if not exists "Announcements_cafe_id_idx"
  on public."Announcements" (cafe_id);
create index if not exists "Cafes_owner_id_idx"
  on public."Cafes" (owner_id);
create index if not exists "Analytics_Logs_cafe_id_created_at_idx"
  on public."Analytics_Logs" (cafe_id, created_at desc);

drop policy if exists "orders_select_anon" on public."Orders";
drop policy if exists "orders_update_anon" on public."Orders";
drop policy if exists "orders_insert_anon" on public."Orders";
revoke all on table public."Orders" from anon;

commit;
