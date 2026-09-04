-- 3Diner — persempit apa yang bisa dijangkau kunci anon.
--
-- NEXT_PUBLIC_SUPABASE_ANON_KEY dikirim ke setiap peramban tamu. Kunci itu
-- memang publik dan memang seharusnya begitu — konsekuensinya, apa pun yang
-- bisa dijangkau peran `anon` sama artinya dengan "terbuka untuk umum".
-- Audit lanjutan setelah kebocoran Notifications menemukan dua hal lagi.
--
-- Yang SUDAH benar, dicatat supaya audit berikutnya tak perlu mengulang:
-- · RLS menyala di seluruh 19 tabel publik; tidak ada satu pun yang mati.
-- · 12 tabel tidak punya policy sama sekali — itu tertutup rapat, bukan
--   kelalaian, karena hanya service role yang melewati RLS.
-- · Tidak satu pun dari 39 fungsi di skema public bisa dieksekusi anon.
-- · INSERT anon di Analytics_Logs memang dibutuhkan: `logEvent` dipanggil
--   dari Client Component (MenuCard, Viewer3DAnalytics) dengan kunci anon.

-- ═══ 1. Pemeriksa kafe sebagai fungsi security definer ═══════════════════
--
-- Beberapa policy perlu bertanya "kafe ini sudah lunas?" atau "kafe ini milik
-- pemanggil?". Sebelumnya pertanyaan itu ditulis sebagai subkueri langsung ke
-- Cafes DI DALAM policy. Itu tampak tidak berbahaya, tetapi mengunci satu hal
-- diam-diam: subkueri di dalam policy tetap tunduk pada hak akses pemanggil,
-- jadi tabel Cafes WAJIB terbuka penuh untuk anon agar policy Menus bisa
-- dievaluasi. Selama itu masih begitu, kolom Cafes tidak mungkin dipersempit.
--
-- Dipindahkan ke fungsi `security definer`: pemeriksaannya berjalan sebagai
-- pemilik fungsi, mengembalikan satu boolean, dan tidak membocorkan apa pun
-- selain jawaban ya/tidak yang memang sudah tersirat dari baris yang terlihat.
-- Setelah ini Cafes bebas dikunci per kolom.
--
-- `search_path` dikunci ke public: fungsi security definer tanpa itu bisa
-- dibelokkan ke skema lain oleh pemanggilnya.

create or replace function public.is_cafe_paid(p_cafe_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public."Cafes" c
    where c.id_cafe = p_cafe_id and c.status_lunas = true
  );
$$;

create or replace function public.cafe_exists(p_cafe_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public."Cafes" c where c.id_cafe = p_cafe_id);
$$;

create or replace function public.is_cafe_owner(p_cafe_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public."Cafes" c
    where c.id_cafe = p_cafe_id and c.owner_id = auth.uid()
  );
$$;

revoke all on function public.is_cafe_paid(uuid) from public;
revoke all on function public.cafe_exists(uuid) from public;
revoke all on function public.is_cafe_owner(uuid) from public;
grant execute on function public.is_cafe_paid(uuid) to anon, authenticated;
grant execute on function public.cafe_exists(uuid) to anon, authenticated;
grant execute on function public.is_cafe_owner(uuid) to anon, authenticated;

-- ═══ 2. Policy yang menyentuh Cafes ditulis ulang lewat fungsi ═══════════
--
-- Menus punya DUA policy yang berlaku untuk SELECT, dan Postgres meng-OR
-- semuanya — jadi `owner manage menus` (cmd ALL) ikut dievaluasi pada setiap
-- pembacaan tamu, bukan hanya pada tulisan pemilik. Mengganti satu policy
-- saja tidak cukup: selama salah satunya masih menyubkueri Cafes, hak tabel
-- penuh tetap diperlukan. Ini terbukti saat percobaan pertama — menu tamu
-- membalas 401 "permission denied for table Cafes" sampai keduanya diubah.

drop policy if exists "public read menus paid" on public."Menus";
create policy "public read menus paid" on public."Menus" for select
  using (public.is_cafe_paid(cafe_id));

drop policy if exists "owner manage menus" on public."Menus";
create policy "owner manage menus" on public."Menus" for all
  using (public.is_cafe_owner(cafe_id))
  with check (public.is_cafe_owner(cafe_id));

-- Announcements: "announcements_select_anon" berisi `using (true)` — pola
-- yang sama persis dengan bug Notifications, jadi siapa pun pemegang kunci
-- anon bisa membaca pengumuman SEMUA kafe, termasuk sesama pengguna 3Diner.
-- Tidak bisa sekadar dicabut seperti Notifications, karena di sini anon
-- memang jalur yang dipakai: `getActiveAnnouncement` di lib/supabase.ts
-- membaca dengan kunci anon. Jadi dipersempit ke yang memang ditampilkan:
-- pengumuman AKTIF milik kafe yang sudah lunas.
drop policy if exists "announcements_select_anon" on public."Announcements";
create policy "announcements_select_anon" on public."Announcements" for select to anon
  using (is_active = true and public.is_cafe_paid(cafe_id));

drop policy if exists "anon insert analytics" on public."Analytics_Logs";
create policy "anon insert analytics" on public."Analytics_Logs" for insert to anon, authenticated
  with check (
    cafe_id is not null
    and event_type = any (array['click_menu', 'view_3d', 'click_order'])
    and duration is not null and duration >= 0
    and public.cafe_exists(cafe_id)
  );

drop policy if exists "owner read analytics" on public."Analytics_Logs";
create policy "owner read analytics" on public."Analytics_Logs" for select
  using (public.is_cafe_owner(cafe_id));

-- ═══ 3. Cafes: dari seluruh kolom terbuka jadi sembilan ══════════════════
--
-- Policy "public read paid cafes" hanya menyaring BARIS (`status_lunas`).
-- RLS tidak bisa menyaring kolom, jadi anon ikut membaca kolom yang tidak ada
-- urusannya dengan halaman menu — diverifikasi dengan memanggil PostgREST
-- memakai kunci anon yang sebenarnya:
--
--   qr_token_customer      → token per-kafe
--   owner_id               → id pemilik
--   receipt_settings       → seluruh konfigurasi struk (json)
--   notification_settings  → seluruh preferensi notifikasi (json)
--   ai_credits_*           → kuota & pemakaian kredit AI
--   tax_* / subscription_type
--
-- Penyaringan kolom di Postgres adalah urusan GRANT, bukan policy. Hak SELECT
-- tingkat-tabel mencakup SEMUA kolom, jadi ia harus dicabut lebih dulu baru
-- diberikan per kolom; mencabut satu kolom saja tidak berpengaruh selama hak
-- tingkat-tabelnya masih menempel.
--
-- Daftar yang disisakan bukan tebakan: persis CAFE_PUBLIC_COLUMNS di
-- lib/supabase.ts, ditambah slug_url dan status_lunas yang dipakai sebagai
-- filter WHERE. Seluruh pembacaan Cafes di konsol memakai service role, jadi
-- tidak ada layar dashboard yang bergantung pada hak ini.

revoke select on public."Cafes" from anon, authenticated;

grant select (
  id_cafe,
  slug_url,
  nama_cafe,
  cover_url,
  logo_url,
  greeting,
  alamat_cafe,
  google_maps_review_url,
  status_lunas
) on public."Cafes" to anon, authenticated;

-- ═══ 4. Hak tulis anon yang tidak pernah dipakai ═════════════════════════
--
-- Supabase memberi anon INSERT/UPDATE/DELETE tingkat-tabel secara bawaan.
-- Hari ini RLS menahannya — tidak ada policy tulis yang cocok untuk anon —
-- jadi ini bukan lubang yang menganga. Yang dihindari adalah keadaan di mana
-- satu policy permisif yang tak sengaja ditambahkan nanti langsung berubah
-- jadi akses tulis dari internet. Setelah ini RLS bukan satu-satunya lapisan.
--
-- Analytics_Logs dikecualikan untuk INSERT: itu satu-satunya tulisan sah dari
-- peramban tamu. UPDATE/DELETE tetap dicabut — tamu boleh menambah jejak,
-- tidak boleh menyunting atau menghapusnya.

revoke insert, update, delete, truncate on
  public."Cafes",
  public."Menus",
  public."Announcements",
  public."Notifications",
  public."Role_Permissions",
  public."Staff"
from anon;

revoke update, delete, truncate on public."Analytics_Logs" from anon;
