# 3Diner dashboard and kitchen audit

Audit ini mencakup dashboard-v2, POS, Pesanan, Dapur, Kasir check-in, permission gate, order lifecycle, cache invalidation, serta query dan RPC Supabase yang dipakai oleh alur tersebut.

## Perubahan utama

- Dapur mendapat papan baru dengan lane Antre / Dimasak / Siap, area pesanan tertahan, filter waktu, pencarian meja/menu/catatan, mode Semua Item, dark/light theme, sound toggle, refresh manual, indikator sinkronisasi, timer WIB, dan empty/error states.
- Dapur tidak lagi bergantung pada browser `SELECT` atau Supabase realtime yang terblokir RLS. Feed staff-authorized `/api/kitchen` mengambil snapshot penuh, melakukan polling saat halaman aktif, menghentikan polling saat hidden, dan menjaga tiket lokal saat koneksi terputus.
- Query dapur dan Pesanan menggunakan pagination, mempertahankan semua order terbuka tanpa batas umur, dan tidak mengubah kegagalan database menjadi daftar kosong.
- Status order dari dashboard melewati server actions dan permission `operate_orders`; status `awaiting` diberi jalur check-in Kasir yang jelas.
- POS mencegah submit ganda, mempertahankan quote/idempotency key untuk retry yang aman, menghitung pilihan add-on sesuai grup, dan menampilkan pesan pembayaran yang benar.
- Tambah item ke pesanan pending sekarang satu transaksi database: validasi tenant/permission, batalkan dan lepaskan reservasi lama, quote ulang, buat pengganti, lalu commit. Kegagalan mengembalikan seluruh transaksi. Catatan item dan dua baris menu yang catatannya berbeda tetap terpisah.
- RPC sensitif (`get_staff_context`, `set_cafe_tax`, quote/commit/amend) hanya dapat dipanggil `service_role`; `anon` dan `authenticated` tidak memiliki execute privilege.
- Pembatalan order otomatis melepaskan reservasi stok.
- Halaman dashboard menampilkan error boundary dan melempar error query penting, sehingga outage tidak tampil sebagai dashboard kosong.
- Overflow permissions matrix dan dashboard routes diperbaiki; granular permission yang belum ditegakkan backend kini tampil sebagai informasi saja dan tidak bisa memberi kesan seolah-olah sudah aktif.
- Nomor order diseragamkan di POS, Dapur, Pesanan, pencarian, dan struk.

## Verifikasi

- `npm run typecheck` — lulus.
- `npm run build` — lulus; seluruh route Next.js terkompilasi.
- `npm run test:ci` — **85 test files / 731 tests lulus**.
- `npm run lint` — 0 error, 8 warning lama pada skrip aset 3D (`scripts/*.mjs`).
- Browser audit lokal memakai sesi dashboard terautentikasi pada lebar CSS 390, 768, dan 1440; seluruh 13 rute dashboard tidak memiliki horizontal overflow.
- Alur browser yang diverifikasi: POS membuat order audit, catatan tampil di Dapur sebagai tiket tertahan, lalu setelah backend check-in/confirm tiket dapat dijalankan Mulai Masak → Tandai Siap → Serahkan. Pembayaran tunai yang belum lunas ditolak dan pembatalan mengembalikan tiket serta reservasi.
- Transaksi database rollback menguji amendment atomik, idempotency, pemisahan catatan, guard pembayaran, dan lifecycle penuh tanpa meninggalkan data pembayaran palsu.

## Menjalankan preview

Dev server tetap berjalan di [http://localhost:3000/dashboard-v2/dapur](http://localhost:3000/dashboard-v2/dapur). Preview ini memakai environment lokal dan sesi Clerk yang sedang aktif.

Perubahan belum di-push atau dideploy ke Vercel. URL produksi yang diberikan pengguna tidak diubah oleh audit ini.

## Batas yang masih berlaku

Granular aksi `Tambah/Ubah/Hapus/Ekspor/Setujui` pada halaman Roles & Permissions masih belum menjadi permission backend terpisah; UI sekarang menguncinya sebagai informasi saja. Pemetaan `Lihat` untuk modul yang sudah memiliki permission tetap disimpan dan ditegakkan server-side.
