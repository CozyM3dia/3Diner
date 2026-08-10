-- App/supabase/migrations/20260809120004_cash_pay_before_kitchen.sql
-- 3Diner — tutup celah tunai: uang diterima saat check-in (sebelum masuk dapur),
-- dan pesanan tunai tidak bisa diselesaikan sebelum lunas.
--
-- Sebelumnya check-in hanya mengonfirmasi pesanan (potong stok + status→received)
-- lalu pembayaran tunai dicatat terpisah lewat tombol kasir — sehingga pesanan
-- tunai bisa masuk dapur, dimasak, bahkan diselesaikan tanpa pernah dibayar.
-- Karena check-in secara fisik terjadi di counter dengan tamu berdiri di depan
-- kasir, itulah momen uang berpindah tangan. Di sini kedua langkah disatukan.
begin;

-- ── checkin_order: konfirmasi + tandai lunas, atomik ────────────────
-- confirm_order dan update lunas berjalan dalam satu transaksi fungsi ini, jadi
-- status='received' dan payment_status='paid' commit bersama. Dapur tidak pernah
-- melihat pesanan tunai yang belum dibayar.
create or replace function public.checkin_order(
  p_cafe_id uuid, p_checkin_code text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id text;
  v_result jsonb;
begin
  if p_cafe_id is null or nullif(trim(p_checkin_code), '') is null
     or upper(trim(p_checkin_code)) !~ '^[A-Z0-9]{8}$' then
    return jsonb_build_object('error', 'checkin_invalid');
  end if;

  select id_order into v_order_id
  from public."Orders"
  where cafe_id = p_cafe_id
    and checkin_code = upper(trim(p_checkin_code))
    and payment_method = 'cash'
    and status = 'awaiting'
  for update;
  if not found then
    return jsonb_build_object('error', 'checkin_invalid');
  end if;

  -- Bila stok kurang, confirm_order mengembalikan error tanpa mengubah apa pun.
  -- Jangan tandai lunas: kasir tidak jadi menerima uang, pesanan tetap menunggu.
  v_result := public.confirm_order(v_order_id);
  if v_result ? 'error' then
    return v_result;
  end if;

  update public."Orders"
  set payment_status = 'paid'
  where id_order = v_order_id
    and payment_method = 'cash'
    and payment_status = 'awaiting_checkin';

  return v_result;
end;
$$;

-- ── advance_order_status: pertahanan berlapis terhadap penyelesaian belum-bayar ─
-- Alur normal sudah menagih tunai saat check-in, jadi guard ini hanya menjaring
-- baris warisan atau klien usang yang mencoba menyelesaikan pesanan tunai yang
-- belum lunas.
create or replace function public.advance_order_status(
  p_cafe_id uuid,
  p_order_id text,
  p_next text,
  p_actor uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_payment_method text;
  v_payment_status text;
  v_now timestamptz := now();
begin
  if p_next not in ('preparing', 'ready', 'completed') then
    raise exception 'invalid_status_transition' using errcode = '22023';
  end if;

  select status, payment_method, payment_status
    into v_status, v_payment_method, v_payment_status
  from public."Orders"
  where id_order = p_order_id and cafe_id = p_cafe_id
  for update;

  if v_status is null then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  if v_status in ('completed', 'cancelled') then
    raise exception 'order_already_final' using errcode = 'P0001';
  end if;

  if not (
    (v_status = 'received'  and p_next in ('preparing', 'completed'))
    or (v_status = 'preparing' and p_next in ('ready', 'completed'))
    or (v_status = 'ready'     and p_next = 'completed')
  ) then
    raise exception 'invalid_status_transition' using errcode = '22023';
  end if;

  if p_next = 'completed'
     and v_payment_method = 'cash'
     and v_payment_status <> 'paid' then
    raise exception 'cash_payment_required' using errcode = 'P0001';
  end if;

  update public."Orders"
  set status = p_next,
      completed_at = case when p_next = 'completed' then v_now else completed_at end
  where id_order = p_order_id and cafe_id = p_cafe_id;

  return jsonb_build_object('status', p_next, 'actor', p_actor, 'at', v_now);
end;
$$;

-- ── Hak akses ───────────────────────────────────────────────────────
revoke all on function public.checkin_order(uuid, text) from public, anon, authenticated;
revoke all on function public.advance_order_status(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.checkin_order(uuid, text) to service_role;
grant execute on function public.advance_order_status(uuid, text, text, uuid) to service_role;

commit;
