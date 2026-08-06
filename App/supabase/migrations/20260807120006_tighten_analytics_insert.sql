-- 3Diner — perketat policy INSERT Analytics_Logs.
--
-- Sebelumnya policy "anon insert analytics" memakai `wITH CHECK (true)`, sehingga
-- siapa pun dengan anon key bisa memasukkan baris analitik asal (cafe_id tak
-- ada, event_type sembarang, duration negatif) dan mengotori laporan omzet.
--
-- Policy baru memvalidasi: cafe benar-benar ada, jenis peristiwa dikenal,
-- dan durasi tidak negatif. Logging sisi klien sah tetap jalan (anon/authenticated).
-- Aman diulang.

begin;

drop policy if exists "anon insert analytics" on public."Analytics_Logs";

create policy "anon insert analytics" on public."Analytics_Logs"
  for insert
  to anon, authenticated
  with check (
    cafe_id is not null
    and event_type in ('click_menu', 'view_3d', 'click_order')
    and duration is not null
    and duration >= 0
    and exists (select 1 from public."Cafes" c where c.id_cafe = cafe_id)
  );

commit;