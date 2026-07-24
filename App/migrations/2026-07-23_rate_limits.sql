begin;

-- Penghitung fixed-window untuk rute publik. Disimpan di Postgres, bukan di
-- memori proses, karena fungsi Vercel berjalan di banyak instance sekaligus —
-- penghitung in-memory akan direset tiap cold start dan tidak dibagi.
create table if not exists public."Rate_Limits" (
  bucket_key text primary key,
  window_start timestamptz not null,
  hit_count integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Dipakai oleh pembersihan baris kedaluwarsa.
create index if not exists "Rate_Limits_window_start_idx"
  on public."Rate_Limits" (window_start);

-- Menaikkan penghitung untuk satu bucket dan melaporkan apakah permintaan
-- masih dalam kuota. Satu pernyataan upsert agar atomik terhadap permintaan
-- bersamaan; window dihitung dengan membulatkan epoch ke bawah sehingga
-- semua instance sepakat soal batas window tanpa perlu koordinasi.
create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  if p_key is null or length(trim(p_key)) = 0 then
    raise exception 'invalid_rate_limit_key';
  end if;
  if p_limit is null or p_limit < 1 or p_window_seconds is null or p_window_seconds < 1 then
    raise exception 'invalid_rate_limit_config';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public."Rate_Limits" as rl (bucket_key, window_start, hit_count, updated_at)
  values (p_key, v_window_start, 1, now())
  on conflict (bucket_key) do update
    set hit_count = case
          when rl.window_start = v_window_start then rl.hit_count + 1
          else 1
        end,
        window_start = v_window_start,
        updated_at = now()
  returning rl.hit_count into v_count;

  return jsonb_build_object(
    'allowed', v_count <= p_limit,
    'count', v_count,
    'limit', p_limit,
    'reset_at', v_window_start + make_interval(secs => p_window_seconds)
  );
end;
$$;

-- Baris hanya berguna selama window-nya berjalan. Dipanggil terjadwal
-- (pg_cron / Supabase scheduled function) agar tabel tidak tumbuh tanpa batas.
create or replace function public.prune_rate_limits(p_older_than_seconds integer default 86400)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public."Rate_Limits"
  where window_start < now() - make_interval(secs => p_older_than_seconds);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- Tabel diakses hanya lewat fungsi security definer di atas, dan fungsinya
-- hanya boleh dipanggil oleh service_role dari route handler.
alter table public."Rate_Limits" enable row level security;

revoke all on table public."Rate_Limits" from public, anon, authenticated;
revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.prune_rate_limits(integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
grant execute on function public.prune_rate_limits(integer) to service_role;

commit;
