-- 3Diner — gabing pemeriksaan rate limit untuk rute publik.
--
-- POST /api/orders sebelumnya memanggil consume_rate_limit dua kali (per-IP lalu
-- per-kafe) = dua roundtrip DB berurutan sebelum RPC pembuat pesanan dijalankan.
-- consume_rate_limits memproses beberapa bucket dalam SATU panggilan dan
-- mengembalikan kegagalan pertama. Menghemat satu roundtrip pada aksi pelanggan
-- yang paling sering. Aman diulang.

begin;

create or replace function public.consume_rate_limits(
  p_keys text[],
  p_limits integer[],
  p_window_seconds integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if p_keys is null or p_limits is null
     or array_length(p_keys, 1) is null
     or array_length(p_keys, 1) <> array_length(p_limits, 1)
     or array_length(p_keys, 1) = 0 then
    raise exception 'invalid_rate_limit_config' using errcode = '22023';
  end if;

  for i in 1..array_length(p_keys, 1) loop
    v_result := public.consume_rate_limit(p_keys[i], p_limits[i], p_window_seconds);
    if (v_result->>'allowed')::boolean = false then
      return v_result;
    end if;
  end loop;

  return jsonb_build_object('allowed', true, 'count', 0, 'limit', 0, 'reset_at', null);
end;
$$;

revoke all on function public.consume_rate_limits(text[], integer[], integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limits(text[], integer[], integer) to service_role;

commit;