-- App/supabase/migrations/20260809120005_fix_checkin_code_search_path.sql
-- 3Diner — fix: pay-at-cashier order creation failed with
--   "function gen_random_bytes(integer) does not exist".
--
-- create_order (pay-at-cashier branch) generates the 8-char check-in code with
-- pgcrypto's gen_random_bytes(). On Supabase pgcrypto lives in the `extensions`
-- schema, but create_order_payment_lifecycle_v1 was defined with
-- `set search_path = public`, so the function was invisible and every cashier
-- order insert aborted. Online orders were unaffected (they never call
-- gen_random_bytes). Widen the function's search_path to include `extensions`.
begin;

alter function public.create_order_payment_lifecycle_v1(uuid, text, jsonb, text, text)
  set search_path = public, extensions;

commit;
