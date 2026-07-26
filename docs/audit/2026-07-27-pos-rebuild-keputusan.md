# Rebuild Dashboard → "Kelas POS": Riset & Keputusan

**Tanggal:** 2026-07-27
**Metode:** 8 agen riset paralel (POS global, POS Indonesia, domain kasir/pajak, metodologi referensi, craft dashboard, audit codebase) + verifikasi manual di repo.
**Status:** menunggu keputusan user. Belum ada kode ditulis.

---

## 0. Temuan yang harus dibaca lebih dulu

**Struk 3Diner menyatakan pajak Rp0 pada transaksi yang secara hukum terutang 10%.**

Terverifikasi langsung, bukan klaim agen:

- `App/src/components/CartView.tsx:211` — baris "Pajak & Layanan" bernilai `formatRupiah(0)`, hardcoded.
- `grep -rniE "pajak|tax|service_charge|PB1|PPN|PBJT" App/src/` mengembalikan **satu hit**: label di baris itu sendiri. Tidak ada tarif, tidak ada DPP, tidak ada service charge — tidak di database, tidak di server action, tidak di struk termal.

Perda Kota Bandar Lampung 1/2024 Pasal 27(1) menetapkan PBJT 10%. Pengecualian Pasal 20(2)a hanya untuk omzet ≤ Rp9 juta/bulan — seluruh target pasar mid-high 3Diner ada di atas ambang itu.

Ini bukan "fitur POS yang belum dibangun". Ini cacat pada produk yang sudah menerima uang.

> **Catatan koordinasi:** `CartView.tsx` ada di wilayah agent menu/customer, bukan wilayah dashboard. Perbaikannya lintas-wilayah dan harus dikoordinasikan, bukan dikerjakan sepihak.

---

## 1. Jurangnya berapa besar

### Yang sudah ada dan kuat

| Area | Catatan |
|---|---|
| Inventory berbasis resep | Sampai level **varian** (`MenuOptionRecipe`) — tidak semua POS Indonesia punya ini |
| Varian/add-on | `SelectedOption` dibekukan ke baris pesanan supaya riwayat tidak berubah. Keputusan yang benar |
| Pesanan realtime | `OrdersClient.tsx:455`, channel Supabase + penanganan disconnect + Web Notification |
| Jadwal & diskon per menu | `schedule_days`, `discount_pct`, `is_active` |
| Analitik pra-transaksi | `Analytics_Logs`: `click_menu`, `view_3d`, `click_order` + durasi |

Basisnya tidak lemah.

### Yang tidak ada, sebagai entitas

Staff/Role, Shift, Cash_Movement, Payment, Order_Item, Order_Event, Void, Refund, Diskon manual, Tax_Profile, Receipt_Sequence, Day_Close, Device, Audit_Log.

Plus tiga hal struktural:

- **Nol identitas.** `grep "role|permission"` di `src/` = nol hit terkait peran. Satu login = satu kafe = akses penuh.
- **Riwayat tidak bisa direkonstruksi.** `Order.status` di-UPDATE. Transisi received→preparing→ready tidak meninggalkan jejak. Perda Pasal 109: kedaluwarsa pidana pajak 5 tahun.
- **Order = check = payment digabung.** `items` JSONB + satu kolom `total`. Satu bill tidak bisa punya dua pembayaran.

### Kuantifikasi

- **10–12 tabel baru**, 5 di antaranya tidak bisa ditunda (Tax_Profiles, Order_Items, Payments, Order_Events, Receipt_Sequences).
- **Minimal 10 kolom uang baru** di `Orders` (sekarang cuma `total`).
- **Tiga perubahan yang bukan penambahan** — dan ini yang mahal:
  1. Model autentikasi: PIN switch di tablet bersama tidak bisa pakai alur email/password Supabase. Menyentuh setiap kebijakan RLS.
  2. Arah tulis data: offline-first membalik server-as-truth jadi client-as-truth. Supabase tidak punya offline native; semua jalur pihak ketiga (PowerSync/RxDB/WatermelonDB). Ini penulisan ulang lapisan data.
  3. Model mutasi: dari UPDATE kolom ke INSERT event. Setiap server action yang menyentuh Orders berubah.

**Estimasi kasar (judgment, bukan verifikasi):** paritas POS penuh ≈ 6–10 bulan satu orang. ~60% ada di offline + identitas, bukan di layar baru.

---

## 2. Apakah 3Diner sebaiknya jadi POS?

### Argumen YA (terkuat)

1. **Setengah jalan adalah posisi terburuk.** 3Diner sudah menerima pesanan, menentukan harga, memotong stok, mencetak struk, menerima QRIS. Ini sudah mesin transaksi — hanya mesin transaksi yang salah hitung pajak.
2. **Lock-in.** Menu 3D bisa dibatalkan bulan depan tanpa sakit. POS tidak.
3. **QR ordering sudah bukan pembeda.** Matriks harga Moka memuat baris eksplisit "Menu Digital & Pemesanan Menu Melalui Scan QR".
4. **Kepuasan pasar rendah.** Qasir 3,61 dari 31.660 rating, di band harga yang sama.

### Argumen TIDAK

1. **Ekonominya tidak menutup.** Moka Rp299–799rb, Majoo Rp249–999rb, iSeller Rp300rb–2jt, semua per outlet/bulan. 3Diner Rp50–150rb. Support POS jauh lebih mahal dari support menu — POS rusak = kafe tidak bisa jualan = telepon jam 9 malam.
2. **Band harga 3Diner ternyata tidak kosong.** Qasir Pro ~Rp58rb/bulan, Olsera Basic ~Rp107rb/bulan — POS beneran, band yang sama, sudah punya offline dan tutup kasir.
3. **Tapping box adalah tembok fisik.** Bandar Lampung sudah memasang 700+ unit dengan ancaman pencabutan izin. Alat itu menyadap perangkat kasir fisik. 3Diner adalah web app di Vercel — tidak ada yang bisa di-tap.
4. **Offline adalah taruhan meja, bukan fitur lanjutan.** Keluhan nomor satu POS cloud Indonesia adalah sinkronisasi gagal saat sinyal jelek.
5. **Peluang yang belum diklaim ada di arah berlawanan.** Menelusuri kategori fitur Moka, Majoo, Olsera, iSeller, Pawoon: semuanya Point of Sale, Payment, Stok, Meja, Karyawan. **Tidak satu pun** menempatkan tampilan menu, daya tarik visual hidangan, atau konversi lihat→pesan sebagai kategori utama. Semua POS merekam transaksi yang **sudah terjadi**. Tidak ada yang mengerjakan bagian **sebelum** transaksi terjadi.

### Rekomendasi

**Jangan jadi POS. Tapi jangan tetap seperti sekarang — karena posisi sekarang bukan "bukan POS", melainkan "POS yang salah hitung pajak".**

Posisi yang disarankan: **kanal pemesanan dine-in yang sadar-uang dan sadar-pajak, berdampingan dengan POS kafe.**

- **Ambil** dari POS hanya yang menyangkut kebenaran uang: mesin pajak PBJT yang benar, nomor struk urut, snapshot transaksi yang tidak berubah diam-diam, rekonsiliasi QRIS gross vs net setelah MDR.
- **Tolak secara sadar dan tertulis:** kasir, shift, laci kas, split bill, void/refund, offline-first, integrasi GoFood/GrabFood. Siapkan jawaban penjualan untuk masing-masing.
- **Jawab tapping box duluan** di materi penjualan: "3Diner tidak menggantikan kasir Anda. Tapping box tetap di POS. 3Diner memberi angka yang cocok dengannya."
- **Pindahkan investasi ke sudut pandang yang belum diklaim:** menu sebagai etalase.

Keputusannya bukan "POS atau bukan POS". Keputusannya adalah **apakah 3Diner system of record untuk uang**. Rekomendasi: tidak — tapi harus akurat terhadap system of record itu, dan hari ini belum.

---

## 3. Dekomposisi

| # | Sub-proyek | Nilai sendiri | Kenapa di urutan ini |
|---|---|---|---|
| **S1** | Kontrak angka & mesin pajak | Struk sah, laporan bisa direkonsiliasi ke SPTPD | Satu-satunya yang **salah sekarang, di produksi, pada uang**. Semua layar menampilkan angka ini — bangun dashboard di atas bentuk angka yang belum final = bangun dua kali |
| **S2** | Identitas transaksi (nomor struk urut + snapshot beku) | Bisa menunjuk satu nomor saat sengketa | Murah, dan format nomor sangat mahal diubah belakangan |
| **S3** | Pemisahan surface "Sekarang" vs "Analisis" | Membereskan masalah desain yang sudah didiagnosis | **Nol perubahan skema.** Bisa paralel dengan S1/S2 asal kontrak angka sudah ditandatangani |
| **S4** | Ringkasan harian via WhatsApp | Untuk pemilik yang jarang buka laptop, mungkin lebih berdampak dari seluruh redesign | Butuh angka S1 benar dulu — mengirim PBJT yang salah lebih buruk dari tidak mengirim |
| **S5** | Sudut pandang etalase | Alasan tier Rp100–150k masuk akal; tidak bisa ditiru Moka karena mereka tidak punya datanya | Butuh S3 (ada tempat menaruhnya) + volume data |
| **S6** | Event log append-only | Menjawab "kenapa Selasa turun 30%", tahan periksa pajak | Biaya migrasi naik tiap hari, tapi nilainya baru terasa setelah ada volume |
| **S7** | Identitas & peran | Barista pegang tablet tanpa lihat omzet | Penulisan ulang auth. Hanya kalau ada permintaan nyata. **Tapi keputusan arsitekturnya harus sekarang** |

**Sengaja tidak masuk daftar:** shift, laci kas, void/refund, split bill, Z-report, offline-first, integrasi GoFood/GrabFood. Semua ini masuk hanya kalau D1 dijawab "system of record".

---

## 4. Sepuluh keputusan sebelum satu baris kode

Diurutkan dari yang paling mahal dibalik.

| | Keputusan | Kenapa mahal kalau salah |
|---|---|---|
| **D1** | 3Diner system of record untuk uang, atau kanal di samping POS? | Menentukan D2–D10 sekaligus. **Tidak boleh ambigu** — ambigu adalah keadaan sekarang, dan itu yang menghasilkan struk Rp0 |
| **D2** | Harga menu inclusive atau exclusive pajak? | Makna setiap `harga_menu` dan `total` historis berubah; tidak ada cara membedakan baris lama tanpa kolom penanda. Harus kolom per kafe sejak migrasi pertama |
| **D3** | Tarif pajak konfigurabel per kafe atau hardcode 10%? | Tarif ditetapkan per perda. Hardcode = setiap ekspansi ke luar Bandar Lampung adalah migrasi. Biaya konfigurabel sekarang ≈ satu kolom |
| **D4** | Order/check/payment: satu entitas atau tiga? | Memisahkan belakangan = backfill dari JSONB; pesanan lama kehilangan info yang tidak pernah disimpan |
| **D5** | Format & cakupan nomor struk | Bertabrakan dengan D7: dua perangkat offline yang sama-sama menerbitkan nomor akan bentrok. Prefix perangkat harus ada sejak nomor pertama |
| **D6** | Status pesanan: kolom mutable atau turunan event log? | Biaya migrasi naik tiap hari. Kalau tetap mutable, tulis alasannya — artinya menerima riwayat transisi hilang selamanya |
| **D7** | Offline-first akan pernah dibangun? | **Biner, harus sekarang.** Kalau jawabannya "mungkin", perlakukan sebagai "ya": ID dibuat di klien, setiap tulis idempoten, nomor struk ber-prefix perangkat |
| **D8** | Satu login per kafe, atau staff + PIN? | Menentukan bentuk RLS dan sesi. Meski S7 ditunda, arsitekturnya harus diputuskan: kalau peran akan ada, dashboard harus dibangun sebagai **registry kartu yang difilter permission**, bukan layout tetap. Gratis kalau diputuskan saat dashboard sedang dirombak |
| **D9** | Harga per outlet atau per bisnis? | Semua pemain besar menagih per outlet dan itu keluhan berulang. Biaya marginal outlet kedua untuk 3Diner ≈ nol. Mengubah setelah ada pelanggan = negosiasi ulang kontrak berjalan |
| **D10** | Retensi data | Ada `analytics_logs_retention.sql`. Pastikan tidak pernah dikenakan ke Orders — audit pajak 5 tahun mengharuskan transaksi bisa direkonstruksi |

---

## 5. Apa yang harus disiapkan (checklist)

**[BLOKIR]** = harus selesai sebelum satu baris kode UI ditulis.

### Riset & bukti

- **[BLOKIR] Observasi langsung 2 kafe Bandar Lampung, jam ramai, 90 menit/kafe.** Murni mengamati — tidak bertanya, tidak mengoreksi. Catat log tatap layar (jam, pemicu, durasi detik, jarak, sambil melakukan apa), log interupsi, artefak manual, kosakata verbatim.
  *Selesai kalau:* tabel log ≥20 baris per kafe + satu kalimat "layar dilihat N kali/jam, X detik, jarak Y, sambil Z".
  *Kenapa:* keputusan paling menentukan di `/dashboard` adalah "ditatap terus" (density rendah, teks besar) vs "dibuka sesekali" (boleh padat, berlapis). Tidak bisa diambil dari referensi mana pun.
- **[BLOKIR] Contextual inquiry 1 sesi dengan pemilik, hari berbeda.** Model master–apprentice, bukan wawancara opini, bukan sesi feedback desain.
  *Selesai kalau:* ≥5 momen "kalau X terjadi saya langsung Y", dan pemilik sudah mengonfirmasi tafsiranmu.
- **[BLOKIR] Inventaris artefak manual.** Foto semua yang dipakai di luar aplikasi — kertas tempel, grup WhatsApp, buku stok. Setiap artefak manual = fitur yang hilang.
- **Kosakata verbatim.** ≥15 istilah yang benar-benar diucapkan barista/pemilik. Label UI meminjam kosakata mereka, bukan kosakata POS Amerika (86'd, void, comp, check).
- **Teardown Loyverse.** Satu-satunya pesaing kelas F&B yang bisa dipakai penuh gratis tanpa bicara sales.
- **Teardown Moka + satu dari Olsera/Majoo.** help.mokapos.com terbuka penuh. Kafe target kemungkinan sudah pakai — kebiasaan yang sudah terbentuk tidak boleh dilawan tanpa alasan.
- **Tarik data pemakaian 3Diner sendiri.** Berapa sesi buka `/dashboard` per pemilik per hari, jam puncak, device (mobile vs desktop), halaman paling jarang dibuka. Bukti termurah dan paling jujur — kalau ternyata dibuka dari HP jam 21.00 sekali sehari, seluruh arah layout berubah.
- **Tutup tiga unknown:** (a) tarif PBJT Bandar Lampung yang berlaku, konfirmasi Perda 1/2024 Ps.27(1) masih berlaku; (b) apakah tapping box BPPRD menyentuh sistem non-POS — **tanya langsung ke BPPRD, tidak ada di web**; (c) kategori MDR QRIS kafe target (0,3% UMI vs 0,7% UKE).

### Keputusan produk

- **[BLOKIR] Kalimat posisi produk, satu kalimat, tertulis di `docs/STRATEGY.md`.** Semua keputusan layout harus bisa ditarik balik ke sini.
- **[BLOKIR] Tipe tiap rute: operational / analytical / manajemen.** Kalau tipe tidak dinyatakan, bentuk default yang menang adalah deretan KPI + grafik tren — karena itu yang paling banyak ada di template. 10 kartu KPI di layar operasional adalah **pelanggaran tipe**, bukan sekadar selera.
- **[BLOKIR] Primary object + pertanyaan-3-detik per rute.** Begitu primary object dinyatakan, banyak keputusan layout jadi otomatis tanpa butuh referensi.
- Pemisahan tiga surface waktu: SEKARANG / HARI SELESAI / ANALISIS. Termasuk keputusan apakah `/dashboard` boleh punya date-range picker sama sekali.
- Keputusan ringkasan harian WhatsApp. Catatan: Majoo menjual notifikasi laporan via WhatsApp sebagai add-on Rp499.000/outlet/bulan — nilai jualnya terbukti.
- Keputusan arsitektur peran (walau belum dibangun) — lihat D8.

### Artefak desain & fondasi teknis

- Anggaran elemen berangka (maks objek KPI di layar operasional, jumlah hue, jumlah sistem animasi, level skala tipe) — ditulis sebagai batas yang bisa **gagal-review**.
- Wireframe abu-abu, diuji dengan 5 state: kosong, error, loading, data berlebih, izin terbatas.
- `brand/LAYOUT_CONTRACT.md` menggantikan `DASHBOARD_REDESIGN_DIRECTION.md`.

---

## 6. Cara mencari referensi (supaya kegagalan Efferd tidak terulang)

### Diagnosis akar

Dokumen arahan lama mengunci lapisan **permukaan** (warna, logo, bahasa, data model, rute) dan membiarkan lapisan **struktur** kosong. Struktur justru satu-satunya lapisan yang bisa dimodelkan mesin, jadi otomatis terisi — oleh satu screenshot yang kebetulan ada.

Bagian "Required Homepage Sections" di dokumen itu berisi 10 butir wajib. **Itulah asal 10 kartu KPI seragam.**

### B0 — Pensiunkan sumber kegagalan secara eksplisit

Tulis `DEPRECATED` di paling atas `brand/DASHBOARD_REDESIGN_DIRECTION.md`, sebutkan kesalahannya, tunjuk penggantinya. Selama file itu masih terbaca sebagai arahan aktif, orang atau agen berikutnya akan membacanya lagi dan mengulangi hasil yang sama.

Audit dokumen sekerabat dengan risiko sama: `brand/MASTER_DASHBOARD_REBUILD_PROMPT.md`, `App/docs/STITCH-DASHBOARD-REDESIGN-PROMPT.md`, `docs/stitch-rebuild/STITCH-PROMPT.md`. Cari kalimat berpola **"gunakan X sebagai fondasi/base/reference"**. Setiap kalimat seperti itu adalah lubang yang sama.

### B1 — Gerbang urutan: struktur dulu, gambar belakangan

Aturan tunggal paling menentukan.

1. **Fase teks.** Setiap layar menjawab pertanyaan apa, urutan apa, untuk siapa, dalam berapa detik. Belum boleh ada gambar apa pun di folder kerja.
2. **Fase wireframe abu-abu.** Tanpa warna, ikon, font pilihan, atau nama komponen library.
3. **Fase buka arsip referensi.** Baru sekarang — dan tujuannya **memvalidasi keputusan yang sudah diambil**, bukan mencari layout.
4. **Fase token brand.**

Rebuild kemarin memulai dari fase 4 lalu mundur.

Penegakan praktis: buat `Asset/referensi/` dan biarkan **kosong** sampai wireframe fase 2 disetujui. Tanggal folder pertama diisi harus lebih baru dari tanggal persetujuan wireframe. Itu jejak yang bisa diperiksa.

### B4 — Sumber mana untuk apa

Efferd gagal bukan karena template-nya jelek, tapi karena diambil dari **kelas sumber yang salah untuk masalahnya**.

**Boleh untuk halaman di balik login:** Nicelydone (arsip layar SaaS web), Mobbin web (flow & urutan layar, bukan komposisi satu layar), SaaSUI (dikelompokkan per jenis layar termasuk empty state), SaaS Interface, Page Flows (rekaman video user flow), **help center produk nyata** (Loyverse, Moka — sumber terbaik untuk state kosong/error/izin, karena dokumentasi memang harus menunjukkannya).

**Dilarang untuk halaman di balik login:** Land-book, Godly, Lapa Ninja, SaaSFrame, Saaspo. Semuanya galeri halaman marketing — katalog SaaSFrame membuktikannya sendiri: Landing Page 286, Pricing 211, About 127, **tidak ada kategori dashboard sama sekali**. Kelimanya boleh, tapi hanya untuk landing page.

**Kenapa Dribbble/Behance/marketplace menghasilkan tampilan generik:** unit produknya adalah gambar yang dinilai dalam satu frame. Tidak ada state kosong, data panjang, error, frekuensi pemakaian, atau kendala — persis hal-hal yang menentukan layout dashboard operasional. 10 kartu seragam adalah komposisi yang enak dalam satu tangkapan layar; 7 warna aksen adalah cara membuat gambar terlihat kaya dalam satu frame; 8 sistem animasi tidak pernah diuji dengan orang yang melirik layar sepuluh kali per jam sambil menuang susu.

**Saringan tiga pertanyaan** untuk referensi apa pun: (1) benar-benar dibangun sampai jadi dan dipakai orang? (2) masalah yang diselesaikan nyata dan bisa disebutkan? (3) state tidak-ideal-nya bisa dilihat? Satu "tidak" → kategori inspirasi visual, boleh dilihat, tidak boleh masuk kolom bukti.

### B5 — Dua aturan angka yang membuat penyalinan mustahil

1. **Satu referensi maksimal menyumbang satu keputusan.** Antidot langsung: kalau aturan ini berlaku kemarin, Efferd paling banter menyumbang satu hal, sisanya wajib dari sumber lain.
2. **Setiap keputusan layout wajib ≥2 referensi dari produk berbeda + 1 observasi lapangan.** Kalau hanya didukung satu referensi, itu bukan pola — itu selera satu tim desain.

Konsekuensi: kerja jadi lebih lambat. Itu memang tujuannya.

### B6 — Boleh vs tidak boleh diambil

Kontrak yang absen dari dokumen lama: di sana tertulis apa yang tidak boleh **diganti**, tapi tidak pernah tertulis apa yang tidak boleh **diambil**.

| Boleh diambil | Tidak boleh diambil |
|---|---|
| Urutan keputusan | Grid & komposisi kartu |
| Hierarki informasi | Palet & alokasi warna |
| Density untuk konteks pemakaian tertentu | Ritme spacing |
| Kosakata & label | Ikonografi |
| Penanganan state (kosong/error/loading/berlebih/izin) | Jumlah & bentuk KPI |
| Penempatan aksi berisiko & bentuk konfirmasinya | Sistem motion |
| Anggaran latensi & bentuk umpan baliknya | Bentuk sidebar & header |
| Apa yang sengaja tidak ditampilkan, dan alasannya | "Fondasi" apa pun |

Cara menerjemahkan yang benar: pahami **mekanisme** kenapa sesuatu bekerja, lalu terjemahkan mekanismenya — bukan bentuk visualnya.

### B7 — `brand/LAYOUT_CONTRACT.md`

Tujuh bagian. Bagian 1–4 harus terisi dan disetujui sebelum bagian 5 boleh diisi.

1. Posisi produk (satu kalimat).
2. Tipe & primary object per rute.
3. Anggaran elemen, berangka, bisa gagal-review.
4. **Daftar larangan eksplisit, menyebut nama.** Termasuk: kata "foundation/base/reference" tidak boleh muncul bersanding dengan nama produk lain; galeri halaman marketing dilarang untuk apa pun di balik login; dilarang menambah warna aksen tanpa arti status; dilarang menambah sistem animasi kedua; komponen library mengisi slot, tidak menentukan slot.
5. **Tabel keputusan dengan kolom bukti.** Baris tanpa bukti terisi = ditolak, tanpa diskusi.
6. Peta drill-down: angka → rute tujuan. Angka tanpa tujuan klik tidak boleh ada di layar operasional.
7. (lihat dokumen sumber)

---

## 7. Yang belum diverifikasi

- Estimasi 6–10 bulan adalah judgment, bukan hasil pengukuran.
- Tapping box vs sistem non-POS: **tidak ada sumber web**. Harus tanya BPPRD langsung.
- Harga pesaing dari halaman publik per 2026-07; bisa berubah.
- Riset ini tidak melihat dashboard 3Diner dalam keadaan ter-render — QA visual butuh login owner.
