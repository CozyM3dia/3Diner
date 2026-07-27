# Usulan Arsitektur Informasi Dashboard 3Diner

**Tanggal:** 2026-07-27
**Dasar:** bedah Tantri + 4D Smart Menu, riset POS global, inventaris 564 fitur 3Diner.
**Status:** usulan. Butuh persetujuan + observasi lapangan sebelum wireframe.

---

## 0. Konflik referensi yang ternyata bukan konflik

Sebelumnya saya laporkan Tantri dan 4D memberi jawaban berlawanan soal layar default:

- Tantri Backoffice (desktop) → dashboard **finansial**, ada date-range picker
- 4D Admin Console → **Active Kitchen**, operasional, tanpa rentang tanggal

Screenshot produk Tantri yang lain membatalkan pembacaan itu. **Dashboard mobile Tantri** (`pos-digital.png`, iPad) justru operasional:

> Kartu **"Pesanan"** dengan sub-judul *"Aktivitas pesanan yang perlu dituntaskan"*, berisi 2×2 hitungan: Belum Dibayar 16 · Siap Diproses 24 · Dalam Pengiriman 32 · Pesanan Selesai 56. Plus dua spanduk peringatan menetap: "Pembaruan Pesanan Reservasi Baru!" dan "Pembaruan Pesanan Baru!". Tab bar bawah 5 item, tab Pesanan membawa lencana angka **60**.

Jadi bukan Tantri vs 4D. **Ini desktop vs perangkat genggam** — pola yang sama persis dengan temuan riset POS global: Toast Web berkadens mingguan sementara Toast Now sengaja dibatasi satu tanggal; Square menaruh Live Sales hanya di aplikasi HP, tidak di dashboard desktop.

Ketiganya sepakat: **perangkat yang dipegang menampilkan pekerjaan, perangkat yang didudukkan menampilkan analisis.**

Konsekuensinya untuk observasi lapangan (`A1-1`): pertanyaannya bukan lagi "referensi mana yang benar", tapi **"pemilik kafemu buka dashboard dari HP atau laptop, dan pada jam berapa"**. Itu satu pertanyaan yang bisa dijawab dalam 90 menit duduk di kafe.

---

## 1. Perbandingan IA

| | Tantri | 4D Smart Menu | 3Diner sekarang |
|---|---|---|---|
| Tingkat atas | 10 pilar, ~38 tujuan di 2 level | 3 item + 1 grup "Management" berisi 4 = 7 tujuan | 8 item, datar, tanpa grup |
| Dasar pengelompokan | **Domain operasional** (pesanan/kasir/gudang/meja/orang/uang) | **Kadensi pakai** — tiap menit di atas, tiap minggu di grup Management, sekali seumur hidup keluar dari nav | **Tidak ada** |
| Layar default | Bercabang per peran & perangkat: owner desktop→angka bisnis, owner HP→pesanan, kasir→grid menu di balik PIN | **Active Kitchen**, analitik diturunkan satu level dan bisa dikunci password | `/dashboard` = Analitik |
| Chrome nav | Selector Cabang di puncak sidebar, lencana `[New]` per item, tombol lipat sidebar | — | — |

**Masalah struktural 3Diner yang terbaca:** tidak ada satu pun layar yang menjawab *"apa yang harus saya kerjakan sekarang"*. Layar pertama menjawab *"apa yang terjadi dua minggu terakhir"*, dan pekerjaan hari ini disembunyikan di item ketiga. `/dashboard` juga mencampur tiga kadensi sekaligus — KPI hari ini, KPI 14 hari, dan seluruh `InventoryWorkspace` yang sudah punya rutenya sendiri.

---

## 2. Bentuk besar: dua permukaan, bukan satu

**Konsol Lantai (`/kasir`)** — sesi terikat orang + PIN, hidup selama jam layanan. Ambil pesanan, tagihan meja berjalan, tutup bill, cetak. **Tidak ada satu pun angka omzet kumulatif.**

**Konsol Kelola (`/dashboard`)** — 10 item dalam 3 grup:

```
LANTAI       1. Hari Ini             /dashboard
             2. Pesanan              /dashboard/orders
             3. Meja & Tagihan       /dashboard/tables

KATALOG      4. Menu                 /dashboard/menu
             5. Stok                 /dashboard/inventory
             6. Promo & Pengumuman   /dashboard/promo

KELOLA  🔒   7. Penjualan            /dashboard/revenue
             8. Analitik             /dashboard/analitik
             9. Staf & Shift         /dashboard/staff
            10. Pengaturan           /dashboard/settings
```

---

## 3. Lima belas keputusan, alasan, dan referensinya

Aturan yang dipatuhi: **satu referensi menyumbang satu keputusan**, dan tiap keputusan butuh **≥2 referensi produk berbeda**.

| # | Keputusan | Referensi |
|---|---|---|
| **D1** | `/dashboard` berhenti jadi halaman analitik, jadi layar kerja **"Hari Ini"**. Grafik 14 hari tidak mengubah keputusan apa pun jam 12 siang | 4D Active Kitchen sebagai default + Tantri layar pertama ditentukan peran/perangkat |
| **D2** | Konsol lantai jadi **permukaan terpisah dengan login sendiri**, bukan tab di dashboard | 4D Staff Console + Tantri Waiter App |
| **D3** | Grup KELOLA **dikunci** dan diturunkan satu level — kafe kecil pakai satu perangkat bersama di konter | 4D "lock management section" + Tantri PIN wajib untuk laporan keuangan |
| **D4** | Pesanan dikelompokkan **per nomor meja**, bukan kronologis | 4D kartu Active Kitchen per meja + Tantri Open Bill |
| **D5** | Rute Meja memegang **tagihan**, bukan sekadar status warna | 4D Table View (dipakai sebagai **batas yang dilewati**, bukan ditiru) + Tantri peta meja real-time |
| **D6** | Tagihan punya **tiga tempat**, bukan satu daftar dengan filter status | 4D arsip terpisah + Tantri Save Bill |
| **D7** | Aksi berisiko **tidak tinggal di baris daftar**; wajib alasan, meninggalkan jejak permanen | Tantri void/refund wajib alasan+approval + 4D penanda complimentary di kartu dapur |
| **D8** | Pisahkan **editor menu** dari **kontrol menu saat operasi** | 4D Menu Designer vs Menu Control + Tantri ketersediaan terpusat |
| **D9** | Analitik satu rute dipecah tab per subjek dengan satu filter periode global; **Penjualan tetap rute sendiri** (kadensinya beda) | 4D Analytics 4 tab + Tantri laporan dipisah per jenis |
| **D10** | Label nav memakai **nama tempat kerja**, bukan nama fitur. Hindari KDS/POS/funnel/konversi di level nav | Tantri satu taksonomi konsisten + 4D "Active Kitchen / Live Feed / Guest Feedback" |
| **D11** | Kendali kepadatan diserahkan ke pengguna **di layar lantai**, tidak di layar kelola | 4D sakelar sembunyikan meja idle + Tantri Custom Struk (lahir dari keluhan struk kepanjangan) |
| **D12** | Batas kuota & status langganan **punya wajah di dalam produk**, sebelum dan sesudah tercapai — termasuk di sisi tamu | 4D kuota dengan peringatan mendekati limit + Tantri nonaktif otomatis hari ke-15 |
| **D13** | Onboarding jadi **jalur berlangkah di dalam produk**, bukan urusan sales | 4D wizard berlangkah + Tantri pendaftaran digerbang sales (terbukti penyebab uninstall) |
| **D14** | Pajak & service charge jadi **baris berurutan terpisah di semua permukaan uang**, diatur di satu tempat | Tantri komponen terpisah di struk & laporan + 4D sengaja tidak membangun permukaan fiskal |
| **D15** | Pisahkan pengaturan yang menempel ke **perangkat** dari yang menempel ke **kafe** | — |

### Konsekuensi D1 yang harus dieksekusi

Seluruh isi `/dashboard` sekarang — LineChart harian, FunnelBars, HeatmapGrid, WeekdayBars, DonutChart, top dishes, aktivitas terakhir, DateRangePicker — **pindah utuh** ke `/dashboard/analitik`.

`InventoryWorkspace` yang tertanam **dihapus dari layar depan** (sudah punya rute sendiri).

Enam KPI sekarang **dibelah dua**: yang berbasis hari ini (`getTodayOps`) tinggal di layar Hari Ini **tanpa rentang tanggal**; yang berbasis 14 hari (`getDashboardData`) ikut pindah.

Rentang tanggal **tidak boleh ada** di layar Hari Ini — layar itu selalu "sekarang".

---

## 4. Temuan visual dari produk asli Tantri

Dari 31 gambar produk yang diunduh:

### Dashboard mobile (`pos-digital.png`)

- **Tab bar bawah 5 item**: Dashboard · Produk · Pesanan · Pelanggan · Pengaturan. Bukan sidebar. Tab Pesanan membawa **lencana angka**.
- Kartu pertama: "Estimasi Pendapatan Hari Ini" + tombol **Lihat Dompet**. Satu angka, satu tindakan.
- **Blok berbagi ada di layar depan**: nama kafe, URL `tantryapp.com/kurosuke` dengan ikon salin, tombol **Lihat Toko** + **Bagikan Link**, dan *"Cetak dan Sebarkan QR Code Toko!"*.
  → 3Diner menyembunyikan QR di `/settings`. Ini fitur akuisisi, tempatnya salah.
- **Spanduk peringatan menetap** untuk pesanan & reservasi baru, bukan toast yang hilang.

### Grup Meja (`floor-management.png`)

- **Selector Cabang di puncak sidebar** — multi-outlet jadi warga kelas satu di chrome nav.
- Lencana **`[New]`** menempel di item nav "Pengelolaan Meja" — pengumuman fitur di dalam nav.
- Tombol **lipat sidebar** (`«`).
- Pola tabel: pencarian kiri + tombol aksi utama kanan-atas, kolom bisa diurut, menu `⋮` per baris berisi tepat 3 aksi (Lihat Map Meja · Edit · Hapus), paginasi bawah.
- **Grup meja adalah entitas di atas meja** — "Floor 4 Smoking Area, 10 meja". Bukan daftar meja datar.
- Status = titik + label (Aktif / Non Aktif) — sama dengan vocabulary `StatusBadge` 3Diner. Jangan diubah.

### Kosakata yang dipinjam

| Tantri | 3Diner sekarang |
|---|---|
| Belum Dibayar | tersembunyi di kolom `payment_status` |
| Siap Diproses | Diproses (`preparing`) |
| Pesanan Selesai | Siap (`ready`) |
| **Pesanan Dibatalkan** | **tidak ada sama sekali** |
| Aktivitas pesanan yang perlu dituntaskan | — |
| Estimasi Pendapatan Hari Ini | Omzet Hari Ini |

**Lubang nyata:** pembatalan pesanan tidak ada di `OrderStatus` maupun di database 3Diner. Kafe pasti perlu membatalkan pesanan salah.

---

## 5. Keputusan yang sengaja DITAHAN

Belum bisa diambil dari referensi. Butuh observasi lapangan lebih dulu — memaksakannya sekarang berarti mengulang kesalahan Efferd dengan cara lain.

1. **Perangkat utama pemilik** — HP atau laptop, dan pada jam berapa. Menentukan apakah layar Hari Ini berupa tab bar bawah (pola Tantri mobile) atau sidebar (pola 4D desktop).
2. **Kepadatan layar lantai** — jarak baca sebenarnya, ditatap terus atau dilirik sesekali.
3. **Apakah kafe target benar-benar butuh entitas meja** — kalau mereka tidak menomori meja, D4 dan D5 runtuh.
4. **Apakah ada lebih dari satu orang menyentuh sistem** — kalau owner sendirian, seluruh D2/D3/D7 (PIN, konsol terpisah, jejak audit) jadi biaya tanpa manfaat.
5. **Berapa lama pesanan boleh menganggur sebelum dianggap telat** — menentukan ambang indikator, dan itu angka per kafe, bukan konstanta.

---

## 6. Belum diverifikasi

- IA aplikasi Tantri yang sesungguhnya **tidak terverifikasi** — tidak ada demo atau dokumentasi publik. Rekonstruksi dari materi pemasaran dan screenshot produk.
- Struktur Admin Console 4D sebagian dari transkrip video Juni 2026, belum dikonfirmasi ke produk hidup.
- Belum ada akses akun ke produk hidup keduanya.
