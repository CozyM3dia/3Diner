# Keputusan: dashboard untuk banyak kafe, bukan untuk satu kafe

**Tanggal:** 2026-07-27
**Konteks:** user meminta dashboard dibuat umum supaya layanannya bisa dipakai banyak kafe, dan menyerahkan keputusannya.
**Prinsip pengatur:** produk umum menang lewat **default yang kuat**, bukan lewat konfigurasi. Kafe harus bisa dipakai hari pertama tanpa mengatur apa pun. Setiap sakelar yang ditambahkan adalah pertanyaan yang dipaksakan ke pemilik yang belum tahu jawabannya.

---

## K1. Dua tahap kerja, bukan tiga

**Sebelumnya:** Masuk → Disiapkan → Siap → Selesai.
**Diputuskan:** Masuk → Disiapkan → **Selesai** (hilang dari layar).

Alasannya bukan penyederhanaan demi sederhana. Tahap "Siap" hanya membawa informasi kalau **orang yang membuat berbeda dari orang yang mengantar**. Di kafe 1–3 orang, barista menyelesaikan minuman lalu langsung memanggil nomor meja atau mengantarnya sendiri — "siap" dan "diantar" adalah satu gerakan. Menambah tahap ketiga di situ berarti menambah satu ketuk yang tidak menghasilkan informasi apa pun, dan ketukan tanpa informasi adalah cara tercepat membuat staf berhenti memperbarui status.

Di kafe yang punya *runner* terpisah, "Siap" adalah serah terima yang nyata dan layak jadi tahap.

**Karena mayoritas pasar awal adalah kafe kecil, default-nya dua tahap.**

Skema tidak berubah: `OrderStatus` sudah punya `received | preparing | ready`. Dua tahap memetakan `received` → Masuk, `preparing` → Disiapkan. `ready` **dipertahankan di database** dan menjadi tahap opsional yang bisa dinyalakan kafe ber-runner nanti — konfigurasi, bukan migrasi.

**Yang harus ditambahkan:** status terminal. Hari ini `ready` adalah akhir, sehingga pesanan yang selesai **tidak pernah keluar dari daftar**. Butuh status "selesai/diserahkan" supaya antrean bisa mencapai nol.

> **Sakelar tahap ketiga tidak dibangun di v1.** Skemanya siap; UI-nya menunggu ada kafe yang benar-benar meminta.

## K2. Tujuh rute, bukan sepuluh

Makin sedikit rute, makin cepat dipelajari kafe baru — dan itu yang menentukan apakah layanan ini bisa dijual berlangganan.

```
Konsol Kasir   /kasir          satu layar, antrean pesanan

Konsol Owner   /dashboard      1. Beranda
                               2. Pesanan      riwayat & semua pesanan
                               3. Menu
                               4. Stok
                               5. Promo        jadwal + diskon + pengumuman
                               6. Laporan      penjualan + analitik, satu rute
                               7. Pengaturan   profil, QR, staf, branding, langganan
```

Perubahan dari usulan 10 rute:

| Sebelumnya | Sekarang | Alasan |
|---|---|---|
| Hari Ini + Pesanan + Meja & Tagihan | **Kasir** (permukaan sendiri) + **Pesanan** | Meja & Tagihan dibantah bukti — meja adalah papan baca, bukan pemegang tagihan |
| Pengumuman + Jadwal & Diskon | **Promo** | Tiga hal yang sama-sama menjawab "apa yang tamu lihat hari ini" |
| Penjualan + Analitik | **Laporan** dengan pemilih mode | Bukti Tantri: mereka menambah **scope**, bukan rute. Dua rute datar akan jadi empat begitu ada laporan pajak |
| Staf & Shift (rute sendiri) | dalam **Pengaturan** | Kafe satu orang tidak butuh destinasi nav untuk ini |

## K3. Satu kolom bergulir, bukan kanban

Tiga kolom kanban lebih enak di tablet landscape, tapi pecah di HP. Satu kolom jalan di keduanya.

Karena perangkat pemilik belum diverifikasi (`ASUMSI-A1`), pilih yang tidak bisa salah. Naik ke kanban nanti adalah perubahan kecil; turun dari kanban ke satu kolom adalah perombakan.

## K4. Nol konfigurasi wajib saat onboarding

Kafe baru harus sampai "menu tayang dan bisa dipesan" tanpa menyentuh satu pun pengaturan. Yang wajib diisi hanya: nama kafe, satu menu, cetak QR.

Semua yang lain punya default yang masuk akal:

| Hal | Default | Bisa diubah? |
|---|---|---|
| Tahap kerja | 2 tahap | ya, nanti |
| Ambang "terlambat" | 10 mnt / 15 mnt | ya, per outlet |
| Jam buka | 24 jam sampai diisi | ya |
| Label meja | teks bebas | — |
| Pajak & service charge | **0%, dan ditulis eksplisit di struk sebagai 0%** | ya, wajib diisi sebelum jualan serius |
| Suara notifikasi | mati, dinyalakan oleh gestur | ya |

Pengecualian yang disengaja: **pajak tidak boleh punya default diam-diam.** Struk hari ini mencetak nol tanpa mengatakannya, dan itu cacat produksi. Nol harus tertulis sebagai nol yang dipilih, bukan nol yang kebetulan.

## K5. Kosakata yang tidak mengunci ke satu jenis usaha

Hindari istilah yang hanya benar untuk kafe tertentu.

| Dipakai | Dihindari | Alasan |
|---|---|---|
| Meja *(teks bebas, ada opsi "Bawa pulang")* | Nomor meja | Tidak semua tempat menomori meja; ada takeaway |
| Pesanan | Tiket, bill, check | "Tiket" bahasa dapur, "check" bahasa POS Amerika |
| Bahan | SKU, item stok | Kafe bicara bahan, bukan SKU |
| Selesai | Served, closed | — |
| Menunggu N menit | Elapsed | — |

Status wajib menyebut **siapa pemegang bola** — "Pending" dilarang.

## K6. Yang sengaja TIDAK dibuat umum

Menggeneralisasi semuanya berarti tidak memutuskan apa pun. Tiga hal sengaja dikunci:

1. **Rupiah saja.** Tanpa multi-currency. Pasar awal Indonesia.
2. **Bahasa Indonesia saja** di dashboard. Menu tamu boleh multi-bahasa nanti; dashboard tidak.
3. **Satu outlet.** Selektor cabang tidak dibangun, tapi **scope outlet ditaruh di shell sejak awal** — supaya menambahkannya nanti bukan refactor yang menyentuh setiap query.

---

## Yang berubah di wireframe

- Kelompok "Siap" dihapus dari Konsol Kasir; aksi terminal jadi **Selesai**
- Pesanan belum lunas: aksi terminal jadi **Terima tunai**, lalu **Selesai**
- Nav Konsol Owner turun jadi 7 rute

## Yang masih menunggu observasi

`ASUMSI-A1` (perangkat pemilik) tetap penentu terbesar dan belum terjawab. Semua keputusan di atas dipilih supaya **tetap benar di kedua kemungkinan** — itu sebabnya satu kolom, bukan kanban.
