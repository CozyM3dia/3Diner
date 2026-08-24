-- App/supabase/migrations/20260825000000_fix_issue_order_quote.sql
--
-- 3Diner — fix: pelanggan tidak bisa membuat pesanan sama sekali. Layar
-- checkout selalu kembali ke tahap "review" dengan tombol "Coba lagi".
--
-- Ada DUA bug independen di jalur checkout, keduanya mematikan:
--
-- 1. `issue_order_quote` menghitung request_hash memakai `p_quote_id`, padahal
--    fungsi itu tidak punya parameter/variabel bernama demikian — id quote yang
--    baru dibuat ada di `v_quote_id`. PL/pgSQL tidak bisa meresolusi identifier
--    itu dalam ekspresi tanpa FROM, sehingga setiap panggilan gagal dengan
--    `42703 column "p_quote_id" does not exist`. Bug ini lolos CI karena
--    PL/pgSQL hanya memvalidasi sintaks body saat CREATE FUNCTION, bukan
--    resolusi identifier, jadi `supabase db reset` tetap bersih dan kegagalan
--    baru muncul saat fungsi dipanggil.
--
--    Akibatnya `POST /api/orders/quote` membalas 502, `quoteOrder()` melempar
--    "Gagal memuat ringkasan pesanan", dan CartView menyetel `needsQuoteRetry`
--    sehingga tombol berubah jadi "Coba lagi" — berulang selamanya karena
--    percobaan berikutnya memanggil fungsi rusak yang sama. Pelanggan tidak
--    pernah sampai ke layar konfirmasi, jadi `POST /api/orders` tak pernah
--    dipanggil. Tabel "Order_Quotes" terbukti kosong (0 baris) walau ada 41
--    pesanan lama dari sebelum checkout berbasis quote dirilis.
--
--    Perbaikan: pakai `v_quote_id`. Ini juga satu-satunya nilai yang membuat
--    kontrak hash konsisten — `commit_order_atomic` mem-hash `p_quote_id`
--    (parameter asli di sana) yang berisi id quote yang sama, sehingga
--    pemeriksaan `v_quote.request_hash <> v_hash` bisa lolos.
--
-- 2. Kedua fungsi checkout memanggil `digest()` (pgcrypto) tetapi dipin dengan
--    `set search_path = public`. Di Supabase pgcrypto tinggal di skema
--    `extensions`, jadi fungsinya tidak terlihat dan panggilan gagal dengan
--    `42883 function digest(bytea, unknown) does not exist`. Ini persis kelas
--    kegagalan yang sudah pernah menjatuhkan pesanan bayar-di-kasir dan
--    diperbaiki di 20260809120005 untuk `gen_random_bytes()`; dua fungsi ini
--    terlewat. Lokal lolos karena base_schema/seed menjalankan
--    `create extension pgcrypto` tanpa SCHEMA sehingga terpasang di `public`,
--    sedangkan proyek Supabase terkelola sudah membawanya di `extensions`.
--
--    Perbaikan: lebarkan search_path kedua fungsi ke `public, extensions`.
--
-- Memperbaiki hanya satu di antaranya tidak cukup: `issue_order_quote`
-- memanggil `digest()` juga, jadi bug 1 hanya berpindah ke bug 2.
--
-- Tidak ada data yang perlu dimigrasi. "Order_Quotes" dan
-- "Order_Idempotency_Keys" sama-sama kosong karena kedua fungsi selalu gagal
-- sebelum sempat menulis, jadi tidak ada request_hash lama yang formulanya
-- berubah.
begin;

create or replace function public.issue_order_quote(
  p_cafe_id uuid,
  p_table_number text,
  p_items jsonb,
  p_notes text,
  p_channel text
) returns jsonb
language plpgsql
security definer
-- `extensions` wajib: digest() berasal dari pgcrypto.
set search_path = public, extensions
as $$
declare
  v_quote jsonb;
  v_quote_id uuid := gen_random_uuid();
  v_hash text;
  v_expires timestamptz := now() + interval '5 minutes';
begin
  if nullif(trim(p_table_number), '') is null or p_channel not in ('online', 'cashier') then
    raise exception 'invalid_order_commit' using errcode = '22023';
  end if;

  v_quote := public.quote_order(p_cafe_id, p_items);
  -- Rumus ini WAJIB identik dengan commit_order_atomic, termasuk urutan field.
  -- `v_quote_id` (bukan `p_quote_id`): id quote yang baru diterbitkan, yaitu
  -- nilai yang dikirim balik ke klien dan kelak diterima commit sebagai
  -- p_quote_id.
  v_hash := encode(digest(convert_to(jsonb_build_object(
    'cafe_id', p_cafe_id,
    'table_number', left(trim(p_table_number), 30),
    'items', p_items,
    'notes', nullif(left(coalesce(trim(p_notes), ''), 500), ''),
    'channel', p_channel,
    'quote_id', v_quote_id
  )::text, 'utf8'), 'sha256'), 'hex');

  insert into public."Order_Quotes" (
    quote_id, cafe_id, request_hash, canonical_payload, pricing_snapshot, expires_at
  ) values (
    v_quote_id, p_cafe_id, v_hash, p_items, v_quote, v_expires
  );

  return jsonb_build_object(
    'quote_id', v_quote_id,
    'request_hash', v_hash,
    'expires_at', v_expires,
    'quote', v_quote
  );
end;
$$;

-- Body commit_order_atomic sudah benar (20260824000000); yang salah hanya
-- search_path-nya, jadi cukup dilebarkan tanpa mendefinisikan ulang.
alter function public.commit_order_atomic(uuid, text, jsonb, text, text, uuid, text)
  set search_path = public, extensions;

revoke all on function public.issue_order_quote(uuid, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.issue_order_quote(uuid, text, jsonb, text, text) to service_role;

commit;
