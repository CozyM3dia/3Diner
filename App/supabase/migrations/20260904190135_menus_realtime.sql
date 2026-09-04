-- Menu tamu yang sudah terbuka di HP ikut berubah saat owner menekan Simpan.
--
-- Sebelum ini halaman /[slug] hanya di-ISR: `revalidatePath` + `revalidateTag`
-- pada aksi simpan sudah membatalkan cache dengan benar, tetapi itu hanya
-- mengubah apa yang diterima PERMINTAAN BERIKUTNYA. Telepon yang layarnya
-- sedang menyala tetap memegang HTML lama sampai tamu memuat ulang sendiri.
--
-- Menus sudah boleh dibaca peran anon lewat kebijakan "public read menus paid",
-- jadi menyiarkan perubahannya TIDAK membuka baris baru apa pun: Realtime tetap
-- menerapkan RLS yang sama. Ini berbeda dari Orders, yang dicabut dari anon dan
-- karenanya harus dipoll di OrderView.
--
-- REPLICA IDENTITY FULL diperlukan supaya cafe_id ikut terkirim pada DELETE.
-- Dengan identitas bawaan (kunci primer saja) payload hapus hanya memuat
-- id_menu, sehingga filter `cafe_id=eq.…` tidak pernah cocok dan menu yang
-- DIHAPUS akan tetap tampil di telepon tamu sampai ia memuat ulang. Menus
-- adalah tabel kecil dengan tulis yang jarang, jadi tambahan WAL-nya sepadan.
alter table public."Menus" replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'public'
      and c.relname = 'Menus'
  ) then
    alter publication supabase_realtime add table public."Menus";
  end if;
end
$$;

-- Membatalkan:
--   alter publication supabase_realtime drop table public."Menus";
--   alter table public."Menus" replica identity default;
