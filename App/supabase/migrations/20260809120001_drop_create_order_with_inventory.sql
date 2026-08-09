begin;
drop function if exists public.create_order_with_inventory(uuid, text, jsonb, text);
commit;
